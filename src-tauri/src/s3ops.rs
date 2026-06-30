use std::time::Duration;

use aws_sdk_s3::types::Object;
use tauri::State;

use crate::clients::{build_client, map_sdk_error};
use crate::error::{poisoned, AppError};
use crate::models::{ListPage, ObjectDetails, ObjectMeta, RemoteBucket};
use crate::state::AppState;

/// Look up a cached client for `bucket_id`, or build + cache a new one.
pub async fn get_client(
    state: &State<'_, AppState>,
    bucket_id: &str,
) -> Result<aws_sdk_s3::Client, AppError> {
    {
        let clients = state.clients.lock().await;
        if let Some(client) = clients.get(bucket_id) {
            return Ok(client.clone());
        }
    }

    let bucket = {
        let guard = state.buckets.lock().map_err(poisoned)?;
        guard
            .iter()
            .find(|p| p.id == bucket_id)
            .cloned()
            .ok_or_else(|| AppError::NotFound(format!("bucket '{bucket_id}'")))?
    };

    let client = build_client(&bucket).await?;
    let mut clients = state.clients.lock().await;
    clients.insert(bucket_id.to_string(), client.clone());
    Ok(client)
}

/// Convert an SDK `Object` into our serializable `ObjectMeta`.
fn object_to_meta(obj: &Object) -> ObjectMeta {
    ObjectMeta {
        key: obj.key().unwrap_or_default().to_string(),
        size: obj.size().unwrap_or_default(),
        etag: obj.e_tag().map(|s| s.trim_matches('"').to_string()),
        last_modified: obj
            .last_modified()
            .map(|d| (d.as_secs_f64() * 1000.0) as i64),
        storage_class: obj.storage_class().map(|s| s.as_str().to_string()),
        is_dir: obj.key().is_some_and(|k| k.ends_with('/')),
    }
}

/// List buckets that exist on the remote account for `bucket_id`. Returns
/// `AppError::AccessDenied` when the caller lacks `s3:ListAllMyBuckets` so the
/// UI can fall back to direct-path entry.
pub async fn list_remote_buckets(
    state: &State<'_, AppState>,
    bucket_id: &str,
) -> Result<Vec<RemoteBucket>, AppError> {
    let client = get_client(state, bucket_id).await?;
    let response = client.list_buckets().send().await.map_err(|err| {
        use aws_smithy_types::error::metadata::ProvideErrorMetadata;
        tracing::warn!(
            "list_buckets failed for {bucket_id}: code={:?} message={:?}",
            err.code(),
            err.message()
        );
        map_sdk_error(err)
    })?;
    let buckets = response
        .buckets()
        .iter()
        .map(|b| RemoteBucket {
            name: b.name().unwrap_or_default().to_string(),
            creation_date: b.creation_date().map(|d| (d.as_secs_f64() * 1000.0) as i64),
        })
        .collect();
    Ok(buckets)
}

/// Paginated object listing for `bucket` + `prefix`. Uses S3's native
/// `delimiter=/` pagination so the first page returns after a single round
/// trip and memory stays bounded by `page_size` regardless of bucket size.
/// `cursor` is the opaque S3 continuation token returned in the previous
/// `ListPage`; pass `None` for the first page. Folders come from
/// `common_prefixes`, real objects from `contents`.
pub async fn list_objects(
    state: &State<'_, AppState>,
    bucket_id: &str,
    bucket: &str,
    prefix: &str,
    cursor: Option<String>,
    page_size: usize,
) -> Result<ListPage, AppError> {
    let client = get_client(state, bucket_id).await?;
    let mut request = client
        .list_objects_v2()
        .bucket(bucket)
        .prefix(prefix)
        .delimiter('/')
        .max_keys(page_size as i32);
    if let Some(token) = cursor {
        request = request.continuation_token(token);
    }
    let response = request.send().await.map_err(map_sdk_error)?;

    let mut items: Vec<ObjectMeta> = Vec::new();
    for cp in response.common_prefixes() {
        if let Some(p) = cp.prefix() {
            if !p.is_empty() {
                items.push(ObjectMeta {
                    key: p.to_string(),
                    size: 0,
                    etag: None,
                    last_modified: None,
                    storage_class: None,
                    is_dir: true,
                });
            }
        }
    }
    for obj in response.contents() {
        if obj.key().is_some_and(|k| !k.is_empty()) {
            items.push(object_to_meta(obj));
        }
    }
    // Folders-first within the page. S3 paginates both groups together via the
    // continuation token, so within-page reordering is purely cosmetic and
    // never shifts the next page's boundary.
    items.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then_with(|| a.key.cmp(&b.key)));

    let next_cursor = response.next_continuation_token.map(|s| s.to_string());

    Ok(ListPage {
        total: items.len(),
        items,
        next_cursor,
    })
}

/// Rich metadata for the details drawer via `HeadObject`.
pub async fn head_object(
    state: &State<'_, AppState>,
    bucket_id: &str,
    bucket: &str,
    key: &str,
) -> Result<ObjectDetails, AppError> {
    let client = get_client(state, bucket_id).await?;
    let response = client
        .head_object()
        .bucket(bucket)
        .key(key)
        .send()
        .await
        .map_err(map_sdk_error)?;
    Ok(ObjectDetails {
        key: key.to_string(),
        size: response.content_length.unwrap_or_default(),
        etag: response
            .e_tag
            .as_deref()
            .map(|s| s.trim_matches('"').to_string()),
        last_modified: response
            .last_modified
            .map(|d| (d.as_secs_f64() * 1000.0) as i64),
        storage_class: response.storage_class.map(|s| s.as_str().to_string()),
        content_type: response.content_type,
        server_side_encryption: response
            .server_side_encryption
            .map(|s| s.as_str().to_string()),
        version_id: response.version_id,
        cache_control: response.cache_control,
    })
}

/// Generate a presigned GET URL so the webview can stream rich media directly
/// without the bytes crossing the IPC bridge.
pub async fn presign_get(
    state: &State<'_, AppState>,
    bucket_id: &str,
    bucket: &str,
    key: &str,
    ttl_secs: u64,
) -> Result<String, AppError> {
    let client = get_client(state, bucket_id).await?;
    let config =
        aws_sdk_s3::presigning::PresigningConfig::expires_in(Duration::from_secs(ttl_secs))
            .map_err(|err| AppError::Internal(err.to_string()))?;
    let presigned = client
        .get_object()
        .bucket(bucket)
        .key(key)
        .presigned(config)
        .await
        .map_err(map_sdk_error)?;
    Ok(presigned.uri().to_string())
}

/// No-op since the move to native S3 pagination — every folder click is a
/// single round-trip already, so there is nothing to warm. Retained as an IPC
/// target so the webview's hover-prefetch call site keeps working unchanged.
pub async fn prefetch_prefix(
    _state: &State<'_, AppState>,
    _bucket_id: &str,
    _bucket: &str,
) -> Result<(), AppError> {
    Ok(())
}
