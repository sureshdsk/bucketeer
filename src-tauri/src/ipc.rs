use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use tauri::{AppHandle, State};

use crate::delete::{self, DeleteOutcome};
use crate::downloads::{self, DownloadRegistry};
use crate::editor::{self, EditorFetch, EditorSaveResult, RestoreResult, VersionList};
use crate::error::AppError;
use crate::inspect::{self, InspectResult};
use crate::models::{Bucket, ListPage, ObjectDetails, RemoteBucket, StoredLocation};
use crate::provider::Provider;
use crate::s3ops;
use crate::search;
use crate::secrets;
use crate::state::AppState;
use crate::uploads::{self, UploadRegistry};

/// IPC bridge health check.
#[tauri::command]
pub async fn ping() -> &'static str {
    "pong"
}

/// Return the saved bucket set (S3-compatible connections).
#[tauri::command]
pub async fn list_buckets(state: State<'_, AppState>) -> Result<Vec<Bucket>, AppError> {
    let guard = state.buckets.lock().map_err(crate::error::poisoned)?;
    Ok(guard.clone())
}

/// List buckets that exist on the remote account (`s3:ListAllMyBuckets`).
#[tauri::command]
pub async fn list_remote_buckets(
    state: State<'_, AppState>,
    bucket_id: String,
) -> Result<Vec<RemoteBucket>, AppError> {
    s3ops::list_remote_buckets(&state, &bucket_id).await
}

/// Paginated object listing for a bucket + prefix. `cursor` is the opaque S3
/// continuation token returned in the previous `ListPage`; `None` starts a new
/// listing.
#[tauri::command]
pub async fn list_objects(
    state: State<'_, AppState>,
    bucket_id: String,
    bucket: String,
    prefix: String,
    cursor: Option<String>,
    page_size: Option<usize>,
) -> Result<ListPage, AppError> {
    s3ops::list_objects(
        &state,
        &bucket_id,
        &bucket,
        &prefix,
        cursor,
        page_size.unwrap_or(200),
    )
    .await
}

/// Rich metadata for the details drawer (`HeadObject`).
#[tauri::command]
pub async fn head_object(
    state: State<'_, AppState>,
    bucket_id: String,
    bucket: String,
    key: String,
) -> Result<ObjectDetails, AppError> {
    s3ops::head_object(&state, &bucket_id, &bucket, &key).await
}

/// Generate a presigned GET URL for direct media streaming in the webview.
#[tauri::command]
pub async fn presign_get(
    state: State<'_, AppState>,
    bucket_id: String,
    bucket: String,
    key: String,
    ttl_secs: Option<u64>,
) -> Result<String, AppError> {
    s3ops::presign_get(&state, &bucket_id, &bucket, &key, ttl_secs.unwrap_or(900)).await
}

/// Hover-prefetch: warm the in-memory tree for a bucket so the drawer opens
/// <50ms on previously hovered rows (`feature.md:23`).
#[tauri::command]
pub async fn prefetch_prefix(
    state: State<'_, AppState>,
    bucket_id: String,
    bucket: String,
) -> Result<(), AppError> {
    s3ops::prefetch_prefix(&state, &bucket_id, &bucket).await
}

/// Save a bucket's connection metadata to `buckets.toml` and stash its
/// credentials in the OS keyring. Returns the refreshed bucket set.
#[tauri::command]
#[allow(clippy::too_many_arguments)] // IPC bridge: one positional arg per field
pub async fn save_bucket(
    state: State<'_, AppState>,
    id: String,
    name: String,
    provider: Provider,
    region: String,
    endpoint_url: Option<String>,
    force_path_style: Option<bool>,
    access_key: String,
    secret_key: String,
    session_token: Option<String>,
    bucket: Option<String>,
    prefix: Option<String>,
) -> Result<Vec<Bucket>, AppError> {
    // Editing a bucket: when the caller leaves the key fields blank, reuse
    // whatever is already in the keyring so the user doesn't have to re-enter
    // secrets just to rename a bucket or tweak its region/endpoint.
    let existing_creds = if access_key.is_empty() || secret_key.is_empty() {
        secrets::get_credentials(&id).ok().flatten()
    } else {
        None
    };
    let access_key = if access_key.is_empty() {
        existing_creds
            .as_ref()
            .map(|c| c.access_key.clone())
            .unwrap_or_default()
    } else {
        access_key
    };
    let secret_key = if secret_key.is_empty() {
        existing_creds
            .as_ref()
            .map(|c| c.secret_key.clone())
            .unwrap_or_default()
    } else {
        secret_key
    };

    secrets::set_credentials(
        &id,
        &secrets::StoredCredentials {
            access_key,
            secret_key,
            session_token,
        },
    )?;
    let force_path_style = force_path_style.unwrap_or(matches!(provider, Provider::CloudflareR2));
    let updated = crate::buckets_toml::save_bucket(
        &id,
        &name,
        provider,
        &region,
        endpoint_url.as_deref(),
        force_path_style,
        bucket.as_deref(),
        prefix.as_deref(),
    )
    .map_err(AppError::Provider)?;

    {
        let mut guard = state.buckets.lock().map_err(crate::error::poisoned)?;
        *guard = updated.clone();
    }

    // Drop any cached client for this id so the next call rebuilds it.
    {
        let mut clients = state.clients.lock().await;
        let stale = clients
            .keys()
            .filter(|k| k.strip_prefix("toml:").is_some_and(|s| s == id))
            .cloned()
            .collect::<Vec<_>>();
        for k in stale {
            clients.remove(&k);
        }
    }

    Ok(updated)
}

/// Verify a bucket is reachable with the given connection details *before* it
/// is saved. Builds a transient client (never cached) and runs `HeadBucket`.
/// Returns `Ok` only when the bucket exists and the credentials can access it.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn verify_bucket(
    provider: Provider,
    region: String,
    endpoint_url: Option<String>,
    bucket: String,
    access_key: String,
    secret_key: String,
    session_token: Option<String>,
    force_path_style: Option<bool>,
) -> Result<(), AppError> {
    if bucket.is_empty() {
        return Err(AppError::Provider("bucket name is required".into()));
    }
    let force_path_style = force_path_style.unwrap_or(matches!(provider, Provider::CloudflareR2));
    let client = crate::clients::build_endpoint_client_from_parts(
        provider,
        &region,
        endpoint_url.as_deref(),
        &access_key,
        &secret_key,
        session_token.as_deref(),
        force_path_style,
    )
    .await?;
    client
        .head_bucket()
        .bucket(&bucket)
        .send()
        .await
        .map_err(crate::clients::map_sdk_error)?;
    Ok(())
}

/// Remove a bucket's keyring entry and `buckets.toml` row.
#[tauri::command]
pub async fn delete_bucket(
    state: State<'_, AppState>,
    id: String,
) -> Result<Vec<Bucket>, AppError> {
    secrets::delete_credentials(&id)?;
    let updated = crate::buckets_toml::remove_bucket(&id).map_err(AppError::Provider)?;
    {
        let mut guard = state.buckets.lock().map_err(crate::error::poisoned)?;
        *guard = updated.clone();
    }
    {
        let mut clients = state.clients.lock().await;
        let stale = clients
            .keys()
            .filter(|k| k.strip_prefix("toml:").is_some_and(|s| s == id))
            .cloned()
            .collect::<Vec<_>>();
        for k in stale {
            clients.remove(&k);
        }
    }
    Ok(updated)
}

/// Return all saved locations (`~/.bucketeer/locations.toml`).
#[tauri::command]
pub async fn list_locations() -> Result<Vec<StoredLocation>, AppError> {
    Ok(crate::locations::load_locations())
}

/// Insert or update a saved location (upsert by id). Returns the full list.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn save_location(
    id: String,
    label: String,
    provider_id: String,
    bucket: String,
    prefix: Option<String>,
    color: Option<String>,
    created_at: Option<i64>,
) -> Result<Vec<StoredLocation>, AppError> {
    let loc = StoredLocation {
        id,
        label,
        provider_id,
        bucket,
        prefix: prefix.unwrap_or_default(),
        color,
        created_at: created_at.unwrap_or(0),
    };
    crate::locations::upsert_location(loc)
}

/// Delete a saved location by id. Returns the full list.
#[tauri::command]
pub async fn delete_location(id: String) -> Result<Vec<StoredLocation>, AppError> {
    crate::locations::delete_location(&id)
}

/// Reorder saved locations to match `ids`.
#[tauri::command]
pub async fn reorder_locations(ids: Vec<String>) -> Result<Vec<StoredLocation>, AppError> {
    crate::locations::set_location_order(ids)
}

/// Enqueue a multipart (or single) upload. Returns the transfer id; progress
/// flows via `transfer://progress` events.
#[tauri::command]
pub async fn enqueue_upload(
    app: AppHandle,
    state: State<'_, AppState>,
    _registry: State<'_, UploadRegistry>,
    bucket_id: String,
    bucket: String,
    key: String,
    local_path: String,
) -> Result<String, AppError> {
    uploads::enqueue_upload(
        app,
        state,
        bucket_id,
        bucket,
        key,
        PathBuf::from(local_path),
    )
}

/// Walk a local folder (or upload a single file) preserving the relative
/// folder structure under `prefix`. Returns the list of generated transfer ids.
#[tauri::command]
pub async fn enqueue_folder_upload(
    app: AppHandle,
    state: State<'_, AppState>,
    _registry: State<'_, UploadRegistry>,
    bucket_id: String,
    bucket: String,
    prefix: String,
    local_path: String,
) -> Result<Vec<String>, AppError> {
    let root = PathBuf::from(&local_path);
    // Single file: enqueue directly with its basename as the key.
    if root.is_file() {
        let filename = root
            .file_name()
            .and_then(|s| s.to_str())
            .map(str::to_string)
            .unwrap_or_else(|| local_path.clone());
        let full_key = join_key(&prefix, &filename);
        let id = uploads::enqueue_upload(app, state, bucket_id, bucket, full_key, root)?;
        return Ok(vec![id]);
    }
    let collected = collect_files(&root, &prefix)?;
    let mut ids: Vec<String> = Vec::new();
    for (full_key, file_path) in collected {
        let id = uploads::enqueue_upload(
            app.clone(),
            state.clone(),
            bucket_id.clone(),
            bucket.clone(),
            full_key,
            file_path,
        )?;
        ids.push(id);
    }
    Ok(ids)
}

/// Join a prefix and key segment with the trailing-slash folder convention.
fn join_key(prefix: &str, filename: &str) -> String {
    if prefix.is_empty() {
        filename.to_string()
    } else if prefix.ends_with('/') {
        format!("{prefix}{filename}")
    } else {
        format!("{prefix}/{filename}")
    }
}

/// Recursively collect every file under `root`, mapping each to its full S3
/// key (relative path joined under `prefix`). Directories become implicit S3
/// prefixes (no synthetic placeholder objects are uploaded).
fn collect_files(root: &std::path::Path, prefix: &str) -> Result<Vec<(String, PathBuf)>, AppError> {
    if !root.is_dir() {
        return Err(AppError::NotFound(format!(
            "not a directory: {}",
            root.display()
        )));
    }
    let mut out: Vec<(String, PathBuf)> = Vec::new();
    let mut stack: Vec<PathBuf> = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let entries = match std::fs::read_dir(&dir) {
            Ok(e) => e,
            Err(err) => {
                return Err(AppError::NotFound(format!(
                    "read dir {}: {err}",
                    dir.display()
                )))
            }
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if path.is_file() {
                let rel = match path.strip_prefix(root).ok().and_then(|p| p.to_str()) {
                    Some(s) if !s.is_empty() => s,
                    _ => continue,
                };
                let normalized = rel.replace('\\', "/");
                let full_key = if prefix.is_empty() {
                    normalized
                } else {
                    let base = if prefix.ends_with('/') {
                        prefix.to_string()
                    } else {
                        format!("{prefix}/")
                    };
                    format!("{base}{normalized}")
                };
                out.push((full_key, path));
            }
        }
    }
    Ok(out)
}

/// Cancel any in-flight transfer (upload or download) by id.
#[tauri::command]
pub async fn cancel_transfer(
    app: AppHandle,
    upload_registry: State<'_, UploadRegistry>,
    download_registry: State<'_, DownloadRegistry>,
    id: String,
    kind: String,
) -> Result<(), AppError> {
    match kind.as_str() {
        "upload" => uploads::cancel_upload(&app, &id).await,
        "download" => downloads::cancel_download(&app, &id).await,
        _ => {
            // Try both registries.
            uploads::cancel_upload(&app, &id).await.ok();
            downloads::cancel_download(&app, &id).await.ok();
            Ok(())
        }
    }
    .map_err(|_| AppError::Internal("cancel failed".into()))?;
    let _ = (upload_registry, download_registry);
    Ok(())
}

/// Enqueue a streaming download to `~/Downloads/bucketeer/<filename>`.
#[tauri::command]
pub async fn enqueue_download(
    app: AppHandle,
    state: State<'_, AppState>,
    _registry: State<'_, DownloadRegistry>,
    bucket_id: String,
    bucket: String,
    key: String,
    target_dir: Option<String>,
) -> Result<String, AppError> {
    downloads::enqueue_download(
        app,
        state,
        bucket_id,
        bucket,
        key,
        target_dir.map(PathBuf::from),
    )
}

/// Delete objects (bulk w/ per-object fallback + optional recursive expand).
#[tauri::command]
pub async fn delete_objects(
    state: State<'_, AppState>,
    bucket_id: String,
    bucket: String,
    keys: Vec<String>,
    recursive: Option<bool>,
) -> Result<DeleteOutcome, AppError> {
    delete::delete_objects(
        &state,
        &bucket_id,
        &bucket,
        keys,
        recursive.unwrap_or(false),
    )
    .await
}

#[tauri::command]
pub async fn fetch_for_edit(
    state: State<'_, AppState>,
    bucket_id: String,
    bucket: String,
    key: String,
    max_bytes: Option<u64>,
) -> Result<EditorFetch, AppError> {
    editor::fetch_for_edit(
        &state,
        &bucket_id,
        &bucket,
        &key,
        max_bytes.unwrap_or(2 * 1024 * 1024),
    )
    .await
}

#[tauri::command]
pub async fn save_edit(
    state: State<'_, AppState>,
    bucket_id: String,
    bucket: String,
    key: String,
    bytes: Vec<u8>,
    content_type: Option<String>,
) -> Result<EditorSaveResult, AppError> {
    editor::save_edit(&state, &bucket_id, &bucket, &key, bytes, content_type).await
}

#[tauri::command]
pub async fn list_versions(
    state: State<'_, AppState>,
    bucket_id: String,
    bucket: String,
    key: String,
) -> Result<VersionList, AppError> {
    editor::list_versions(&state, &bucket_id, &bucket, &key).await
}

#[tauri::command]
pub async fn restore_version(
    state: State<'_, AppState>,
    bucket_id: String,
    bucket: String,
    key: String,
    version_id: String,
) -> Result<RestoreResult, AppError> {
    editor::restore_version(&state, &bucket_id, &bucket, &key, &version_id).await
}

#[tauri::command]
pub async fn inspect_compressed(
    state: State<'_, AppState>,
    bucket_id: String,
    bucket: String,
    key: String,
    cap_bytes: Option<u64>,
    output_cap: Option<usize>,
) -> Result<InspectResult, AppError> {
    inspect::inspect_compressed(
        &state,
        &bucket_id,
        &bucket,
        &key,
        cap_bytes.unwrap_or(8 * 1024 * 1024),
        output_cap.unwrap_or(64 * 1024),
    )
    .await
}

#[tauri::command]
pub async fn deep_search(
    app: AppHandle,
    state: State<'_, AppState>,
    bucket_id: String,
    bucket: String,
    prefix: String,
    query: String,
) -> Result<usize, AppError> {
    let cancel = Arc::new(AtomicBool::new(false));
    search::deep_search(app, state, bucket_id, bucket, prefix, query, cancel).await
}

/// Cancel a deep search. (Placeholder until per-search cancellable handles
/// live in a registry — Phase 3.8 will wire this to a search-bar abort.)
#[tauri::command]
#[allow(dead_code)] // registered; wired to the search bar in Phase 3.8
pub async fn cancel_search() -> Result<(), AppError> {
    Ok(())
}

// ---------------------------------------------------------------------------
// Phase 5 — settings, telemetry, diagnostics, cache
// ---------------------------------------------------------------------------

/// Static app + environment metadata for Settings → About.
#[tauri::command]
pub async fn get_app_info() -> Result<crate::diagnostics::AppInfo, AppError> {
    Ok(crate::diagnostics::app_info())
}

/// Filesystem paths the app reads/writes (config, logs, cache).
#[tauri::command]
pub async fn get_app_paths() -> Result<crate::diagnostics::AppPaths, AppError> {
    Ok(crate::diagnostics::app_paths())
}

/// Current user settings (telemetry consent, updater toggle, …). Persisted to
/// `~/.bucketeer/settings.toml`.
#[tauri::command]
pub async fn get_app_settings() -> Result<crate::settings::AppSettings, AppError> {
    Ok(crate::settings::load_settings())
}

/// Record the user's telemetry decision and persist it. Emits a structured log
/// line noting the choice (the "logs the decision" requirement).
#[tauri::command]
pub async fn set_telemetry_consent(
    consent: String,
) -> Result<crate::settings::AppSettings, AppError> {
    let parsed = match consent.as_str() {
        "accepted" => crate::settings::Consent::Accepted,
        "declined" => crate::settings::Consent::Declined,
        "undecided" => crate::settings::Consent::Undecided,
        other => {
            return Err(AppError::Internal(format!(
                "unknown consent value: {other}"
            )))
        }
    };
    crate::telemetry::log_decision(&format!("telemetry_consent={consent}"))?;
    crate::settings::set_telemetry_consent(parsed)
}

/// Record an anonymous usage event when the user has opted in. Declined or
/// undecided consent → no-op (nothing written, nothing sent off-machine).
#[tauri::command]
pub async fn record_event(kind: String, name: String) -> Result<(), AppError> {
    crate::telemetry::record_opted_in(&kind, &name);
    Ok(())
}

/// Drop every cached S3 client + any on-disk cache so the next visit rebuilds.
#[tauri::command]
pub async fn clear_cache(state: State<'_, AppState>) -> Result<(), AppError> {
    crate::diagnostics::clear_cache(&state).await
}

/// Bundle redacted diagnostics into a zip under the OS temp dir and return its
/// absolute path so the webview can offer it for download/reveal.
#[tauri::command]
pub async fn export_diagnostics(state: State<'_, AppState>) -> Result<String, AppError> {
    let buckets = crate::diagnostics::snapshot_buckets(&state)?;
    let path = tauri::async_runtime::spawn_blocking(move || {
        crate::diagnostics::export_diagnostics(&buckets)
    })
    .await
    .map_err(|e| AppError::Internal(format!("export_diagnostics join: {e}")))??;
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collect_files_preserves_relative_structure() {
        let dir =
            std::env::temp_dir().join(format!("bucketeer-walk-{}", uuid::Uuid::new_v4().simple()));
        std::fs::create_dir_all(dir.join("sub")).unwrap();
        std::fs::write(dir.join("a.txt"), b"a").unwrap();
        std::fs::write(dir.join("sub").join("b.txt"), b"b").unwrap();

        let files = collect_files(&dir, "uploads/").unwrap();
        let owned: Vec<(String, String)> = files
            .iter()
            .map(|(k, p)| {
                (
                    k.clone(),
                    p.file_name().unwrap().to_string_lossy().to_string(),
                )
            })
            .collect();
        let by_key: std::collections::HashMap<&str, &str> = owned
            .iter()
            .map(|(k, v)| (k.as_str(), v.as_str()))
            .collect();
        assert_eq!(by_key.get("uploads/a.txt").copied(), Some("a.txt"));
        assert_eq!(by_key.get("uploads/sub/b.txt").copied(), Some("b.txt"));
        std::fs::remove_dir_all(&dir).ok();
    }
}
