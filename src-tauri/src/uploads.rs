use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::types::{CompletedMultipartUpload, CompletedPart};
use futures::stream::{FuturesOrdered, StreamExt};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};

use crate::error::AppError;
use crate::s3ops;
use crate::state::AppState;
use crate::transfers::{new_transfer_id, TransferKind, TransferPhase, TransferProgress};

type PartFut =
    std::pin::Pin<Box<dyn std::future::Future<Output = (usize, Option<CompletedPart>)> + Send>>;

/// Minimum object size that triggers multipart (S3's minimum part size is 5 MiB).
pub const MIN_MULTIPART_BYTES: u64 = 8 * 1024 * 1024;
const PART_SIZE: u64 = 8 * 1024 * 1024;
const MAX_PARALLEL_PARTS: usize = 4;
const PART_RETRIES: usize = 3;

/// Live state for in-progress uploads so a `cancel_upload` IPC can abort them.
#[derive(Default)]
pub struct UploadRegistry {
    pub handles: Mutex<HashMap<String, UploadHandle>>,
}

pub struct UploadHandle {
    pub cancel: Arc<AtomicBool>,
}

/// Enqueue an upload (multipart when size ≥ MIN_MULTIPART_BYTES). Spawns a
/// detached task that streams the file from disk and emits `transfer://progress`
/// events. Returns the transfer id immediately so the UI can render the row.
#[allow(clippy::too_many_arguments)]
pub fn enqueue_upload(
    app: AppHandle,
    state: State<'_, AppState>,
    bucket_id: String,
    bucket: String,
    key: String,
    local_path: PathBuf,
) -> Result<String, AppError> {
    let id = new_transfer_id();
    let size = std::fs::metadata(&local_path)
        .map_err(|err| AppError::NotFound(format!("local file missing: {err}")))?
        .len();

    let cancel = Arc::new(AtomicBool::new(false));
    {
        let registry = app.state::<UploadRegistry>();
        let mut handles = registry.handles.lock().unwrap();
        handles.insert(
            id.clone(),
            UploadHandle {
                cancel: cancel.clone(),
            },
        );
    }

    let app_for_task = app.clone();
    let id_for_task = id.clone();
    let _ = state; // State<'_, AppState> can't cross spawn boundaries; re-fetch inside.
    tokio::spawn(async move {
        let state = app_for_task.state::<AppState>();
        run_upload(
            app_for_task.clone(),
            state,
            bucket_id,
            bucket,
            key,
            local_path,
            size,
            id_for_task.clone(),
            cancel,
        )
        .await;
        let registry = app_for_task.state::<UploadRegistry>();
        registry.handles.lock().unwrap().remove(&id_for_task);
    });

    Ok(id)
}

#[allow(clippy::too_many_arguments)]
async fn run_upload(
    app: AppHandle,
    state: State<'_, AppState>,
    bucket_id: String,
    bucket: String,
    key: String,
    local_path: PathBuf,
    size: u64,
    id: String,
    cancel: Arc<AtomicBool>,
) {
    emit(
        &app,
        &id,
        &key,
        TransferKind::Upload,
        TransferPhase::Queued,
        0,
        size,
        None,
    );

    if cancel.load(Ordering::Relaxed) {
        emit(
            &app,
            &id,
            &key,
            TransferKind::Upload,
            TransferPhase::Cancelled,
            0,
            size,
            Some("cancelled before start".into()),
        );
        return;
    }

    emit(
        &app,
        &id,
        &key,
        TransferKind::Upload,
        TransferPhase::Starting,
        0,
        size,
        None,
    );

    let outcome = if size >= MIN_MULTIPART_BYTES {
        run_multipart(
            &app,
            &state,
            &bucket_id,
            &bucket,
            &key,
            &local_path,
            size,
            &id,
            &cancel,
        )
        .await
    } else {
        run_single(
            &state,
            &bucket_id,
            &bucket,
            &key,
            &local_path,
            size,
            &cancel,
        )
        .await
    };

    match outcome {
        Ok(bytes) => {
            emit(
                &app,
                &id,
                &key,
                TransferKind::Upload,
                TransferPhase::Completed,
                bytes,
                size,
                None,
            );
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
                TransferKind::Upload,
                phase,
                0,
                size,
                Some(err),
            );
        }
    }
}

async fn run_single(
    state: &State<'_, AppState>,
    bucket_id: &str,
    bucket: &str,
    key: &str,
    local_path: &Path,
    size: u64,
    cancel: &Arc<AtomicBool>,
) -> Result<u64, String> {
    let client = s3ops::get_client(state, bucket_id)
        .await
        .map_err(|e| e.to_string())?;
    let body = ByteStream::from_path(local_path)
        .await
        .map_err(|e| format!("open file: {e}"))?;
    if cancel.load(Ordering::Relaxed) {
        return Err("cancelled".into());
    }
    client
        .put_object()
        .bucket(bucket)
        .key(key)
        .body(body)
        .send()
        .await
        .map_err(|e| crate::clients::map_sdk_error(e).to_string())?;
    Ok(size)
}

#[allow(clippy::too_many_arguments)]
async fn run_multipart(
    app: &AppHandle,
    state: &State<'_, AppState>,
    bucket_id: &str,
    bucket: &str,
    key: &str,
    local_path: &Path,
    size: u64,
    id: &str,
    cancel: &Arc<AtomicBool>,
) -> Result<u64, String> {
    let client = s3ops::get_client(state, bucket_id)
        .await
        .map_err(|e| e.to_string())?;

    let create = client
        .create_multipart_upload()
        .bucket(bucket)
        .key(key)
        .send()
        .await
        .map_err(|e| format!("create multipart: {}", crate::clients::map_sdk_error(e)))?;
    let upload_id = create
        .upload_id()
        .ok_or_else(|| "no upload id returned".to_string())?
        .to_string();

    let total_parts = size.div_ceil(PART_SIZE).max(1) as usize;
    let mut parts: Vec<Option<CompletedPart>> = vec![None; total_parts];

    let mut inflight: FuturesOrdered<PartFut> = FuturesOrdered::new();

    for part_number in 1..=total_parts as u32 {
        let part_index = part_number as usize - 1;
        let offset = part_index as u64 * PART_SIZE;
        let this_size = PART_SIZE.min(size - offset).max(1);

        let client = client.clone();
        let bucket = bucket.to_string();
        let key = key.to_string();
        let upload_id = upload_id.clone();
        let path = local_path.to_path_buf();
        let cancel = cancel.clone();
        let app = app.clone();
        let id = id.to_string();
        let total = size;

        let fut = Box::pin(async move {
            if cancel.load(Ordering::Relaxed) {
                return (part_number as usize, None);
            }
            let result = upload_part_with_retry(
                &client,
                &bucket,
                &key,
                &upload_id,
                part_number,
                offset,
                this_size,
                &path,
                &cancel,
            )
            .await;
            if let Ok(etag) = result {
                emit(
                    &app,
                    &id,
                    &key,
                    TransferKind::Upload,
                    TransferPhase::Active,
                    offset + this_size,
                    total,
                    None,
                );
                let completed = CompletedPart::builder()
                    .part_number(part_number as i32)
                    .e_tag(etag)
                    .build();
                (part_number as usize, Some(completed))
            } else {
                (part_number as usize, None)
            }
        });
        inflight.push_back(fut);

        if inflight.len() >= MAX_PARALLEL_PARTS {
            if let Some((pn, completed)) = inflight.next().await {
                if pn >= 1 && pn <= parts.len() {
                    parts[pn - 1] = completed;
                }
            }
        }
    }

    while let Some((pn, completed)) = inflight.next().await {
        if pn >= 1 && pn <= parts.len() {
            parts[pn - 1] = completed;
        }
    }

    if cancel.load(Ordering::Relaxed) {
        // Best-effort abort.
        let _ = client
            .abort_multipart_upload()
            .bucket(bucket)
            .key(key)
            .upload_id(&upload_id)
            .send()
            .await;
        return Err("cancelled".into());
    }

    let completed_parts: Vec<CompletedPart> = parts.into_iter().flatten().collect();
    if completed_parts.len() != total_parts {
        let _ = client
            .abort_multipart_upload()
            .bucket(bucket)
            .key(key)
            .upload_id(&upload_id)
            .send()
            .await;
        return Err(format!(
            "missing parts: expected {total_parts}, got {}",
            completed_parts.len()
        ));
    }

    let completed = CompletedMultipartUpload::builder()
        .set_parts(Some(completed_parts))
        .build();
    client
        .complete_multipart_upload()
        .bucket(bucket)
        .key(key)
        .upload_id(&upload_id)
        .multipart_upload(completed)
        .send()
        .await
        .map_err(|e| format!("complete multipart: {}", crate::clients::map_sdk_error(e)))?;
    Ok(size)
}

#[allow(clippy::too_many_arguments)]
async fn upload_part_with_retry(
    client: &aws_sdk_s3::Client,
    bucket: &str,
    key: &str,
    upload_id: &str,
    part_number: u32,
    offset: u64,
    size: u64,
    path: &Path,
    cancel: &Arc<AtomicBool>,
) -> Result<String, String> {
    let mut attempts = 0;
    loop {
        if cancel.load(Ordering::Relaxed) {
            return Err("cancelled".into());
        }
        attempts += 1;
        let mut file = File::open(path).await.map_err(|e| format!("open: {e}"))?;
        file.seek(SeekFrom::Start(offset))
            .await
            .map_err(|e| format!("seek: {e}"))?;
        let mut buf = vec![0u8; size as usize];
        file.read_exact(&mut buf)
            .await
            .map_err(|e| format!("read: {e}"))?;
        let body = aws_sdk_s3::primitives::ByteStream::from(buf);
        match client
            .upload_part()
            .bucket(bucket)
            .key(key)
            .upload_id(upload_id)
            .part_number(part_number as i32)
            .body(body)
            .send()
            .await
        {
            Ok(resp) => return Ok(resp.e_tag().map(|s| s.to_string()).unwrap_or_default()),
            Err(err) => {
                if attempts > PART_RETRIES {
                    return Err(format!(
                        "part {part_number} failed: {}",
                        crate::clients::map_sdk_error(err)
                    ));
                }
                tokio::time::sleep(Duration::from_millis(500 * attempts as u64)).await;
            }
        }
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
    let payload = TransferProgress {
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
    let _ = app.emit("transfer://progress", payload);
}

/// Cancel an in-flight upload. Cancellation is cooperative: the part loop
/// notices the flag and aborts; the multipart upload is best-effort aborted.
pub async fn cancel_upload(app: &AppHandle, id: &str) -> Result<(), AppError> {
    let registry = app.state::<UploadRegistry>();
    let guard = registry.handles.lock().unwrap();
    if let Some(handle) = guard.get(id) {
        handle.cancel.store(true, Ordering::Relaxed);
    }
    Ok(())
}
