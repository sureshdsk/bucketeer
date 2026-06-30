use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::AsyncWriteExt;

use crate::error::AppError;
use crate::s3ops;
use crate::state::AppState;
use crate::transfers::{new_transfer_id, TransferHandle, TransferKind, TransferPhase, CHANNEL};

/// Live state for in-progress downloads so a `cancel_download` IPC can abort.
#[derive(Default)]
pub struct DownloadRegistry {
    pub handles: Mutex<HashMap<String, TransferHandle>>,
}

#[derive(Debug, serde::Serialize)]
#[allow(dead_code)] // surfaced for future "reveal in Finder" expansion
pub struct DownloadResult {
    pub key: String,
    pub saved_to: String,
    pub bytes: u64,
}

/// Default download directory: `~/Downloads/bucketeer`. Created lazily.
pub fn default_download_dir() -> Result<PathBuf, AppError> {
    let dir = dirs::download_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join("Downloads")))
        .unwrap_or_else(|| PathBuf::from("."))
        .join("bucketeer");
    std::fs::create_dir_all(&dir)
        .map_err(|e| AppError::Internal(format!("create download dir: {e}")))?;
    Ok(dir)
}

/// Enqueue a streaming download. Spawns a detached task that streams the
/// response body to disk and emits `transfer://progress` events. Returns the
/// transfer id immediately so the UI can render the row.
pub fn enqueue_download(
    app: AppHandle,
    state: State<'_, AppState>,
    bucket_id: String,
    bucket: String,
    key: String,
    target_dir: Option<PathBuf>,
) -> Result<String, AppError> {
    let id = new_transfer_id();
    let handle = TransferHandle::new(TransferKind::Download);
    let cancel = handle.cancel.clone();
    {
        let registry = app.state::<DownloadRegistry>();
        let mut handles = registry.handles.lock().unwrap();
        handles.insert(id.clone(), handle);
    }

    let app_for_task = app.clone();
    let id_for_task = id.clone();
    let _ = state;
    tokio::spawn(async move {
        let state = app_for_task.state::<AppState>();
        run_download(
            app_for_task.clone(),
            state,
            bucket_id,
            bucket,
            key,
            target_dir,
            id_for_task.clone(),
            cancel,
        )
        .await;
        let registry = app_for_task.state::<DownloadRegistry>();
        registry.handles.lock().unwrap().remove(&id_for_task);
    });

    Ok(id)
}

#[allow(clippy::too_many_arguments)]
async fn run_download(
    app: AppHandle,
    state: State<'_, AppState>,
    bucket_id: String,
    bucket: String,
    key: String,
    target_dir: Option<PathBuf>,
    id: String,
    cancel: Arc<AtomicBool>,
) {
    emit(
        &app,
        &id,
        &key,
        TransferKind::Download,
        TransferPhase::Queued,
        0,
        0,
        None,
    );

    let outcome = download(
        &state,
        &bucket_id,
        &bucket,
        &key,
        target_dir.as_deref(),
        &id,
        &app,
        &cancel,
    )
    .await;

    match outcome {
        Ok((bytes, path)) => {
            emit(
                &app,
                &id,
                &key,
                TransferKind::Download,
                TransferPhase::Completed,
                bytes,
                bytes,
                None,
            );
            // Best-effort OS reveal.
            #[cfg(target_os = "macos")]
            {
                let _ = std::process::Command::new("open")
                    .arg("-R")
                    .arg(&path)
                    .spawn();
            }
            #[cfg(not(target_os = "macos"))]
            {
                let _ = path; // no reveal command on this OS; avoid unused binding
            }
        }
        Err(err) => {
            let phase = if cancel.load(Ordering::Relaxed) {
                TransferPhase::Cancelled
            } else {
                TransferPhase::Failed
            };
            emit(
                &app,
                &id,
                &key,
                TransferKind::Download,
                phase,
                0,
                0,
                Some(err),
            );
        }
    }
}

#[allow(clippy::too_many_arguments)]
async fn download(
    state: &State<'_, AppState>,
    bucket_id: &str,
    bucket: &str,
    key: &str,
    target_dir: Option<&Path>,
    id: &str,
    app: &AppHandle,
    cancel: &Arc<AtomicBool>,
) -> Result<(u64, PathBuf), String> {
    let client = s3ops::get_client(state, bucket_id)
        .await
        .map_err(|e| e.to_string())?;

    emit(
        app,
        id,
        key,
        TransferKind::Download,
        TransferPhase::Starting,
        0,
        0,
        None,
    );

    let resp = client
        .get_object()
        .bucket(bucket)
        .key(key)
        .send()
        .await
        .map_err(|e| crate::clients::map_sdk_error(e).to_string())?;
    let total = resp.content_length().unwrap_or(0) as u64;

    let dir = match target_dir.map(Path::to_path_buf) {
        Some(d) => d,
        None => default_download_dir().map_err(|e| e.to_string())?,
    };
    let file_name = key_filename(key);
    let mut out_path = dir.clone();
    out_path.push(&file_name);
    // De-duplicate collisions while preserving extension.
    if out_path.exists() {
        let stem = out_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("download")
            .to_string();
        let ext = out_path
            .extension()
            .and_then(|s| s.to_str())
            .map(String::from);
        let mut counter = 1;
        loop {
            let candidate_name = match &ext {
                Some(ext) => format!("{stem} ({counter}).{ext}"),
                None => format!("{stem} ({counter})"),
            };
            out_path = dir.join(candidate_name);
            if !out_path.exists() {
                break;
            }
            counter += 1;
        }
    }

    let mut file = tokio::fs::File::create(&out_path)
        .await
        .map_err(|e| format!("create file: {e}"))?;

    let mut stream = resp.body;
    let mut written: u64 = 0;
    while let Some(chunk) = stream.next().await {
        if cancel.load(Ordering::Relaxed) {
            // Clean up partial file.
            drop(file);
            let _ = tokio::fs::remove_file(&out_path).await;
            return Err("cancelled".into());
        }
        let bytes = chunk.map_err(|e| format!("read chunk: {e}"))?;
        file.write_all(&bytes)
            .await
            .map_err(|e| format!("write chunk: {e}"))?;
        written += bytes.len() as u64;
        emit(
            app,
            id,
            key,
            TransferKind::Download,
            TransferPhase::Active,
            written,
            total,
            None,
        );
    }
    file.flush().await.map_err(|e| format!("flush: {e}"))?;
    Ok((written, out_path))
}

fn key_filename(key: &str) -> String {
    let name = key.rsplit('/').next().unwrap_or(key);
    if name.is_empty() {
        "download".to_string()
    } else {
        name.to_string()
    }
}

#[allow(clippy::too_many_arguments)]
fn emit(
    app: &AppHandle,
    id: &str,
    key: &str,
    kind: TransferKind,
    phase: TransferPhase,
    bytes: u64,
    total: u64,
    error: Option<String>,
) {
    let payload = crate::transfers::TransferProgress {
        id: id.to_string(),
        kind,
        phase,
        key: key.to_string(),
        bytes,
        total,
        progress: if total == 0 {
            0.0
        } else {
            (bytes as f64 / total as f64).clamp(0.0, 1.0)
        },
        error,
    };
    let _ = app.emit(CHANNEL, payload);
}

/// Cancel an in-flight download. Cancellation is cooperative.
pub async fn cancel_download(app: &AppHandle, id: &str) -> Result<(), AppError> {
    let registry = app.state::<DownloadRegistry>();
    let guard = registry.handles.lock().unwrap();
    if let Some(handle) = guard.get(id) {
        handle.cancel.store(true, Ordering::Relaxed);
    }
    Ok(())
}
