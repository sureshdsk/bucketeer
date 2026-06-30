use aws_sdk_s3::primitives::ByteStream;
use tauri::State;

use crate::clients::map_sdk_error;
use crate::error::AppError;
use crate::s3ops;
use crate::state::AppState;

/// Result of fetching an object for in-app editing (versioning-aware).
#[derive(Debug, serde::Serialize)]
pub struct EditorFetch {
    pub key: String,
    pub bytes: Vec<u8>,
    pub version_id: Option<String>,
    pub content_type: Option<String>,
    pub etag: Option<String>,
    pub last_modified: Option<i64>,
    /// True when the underlying bucket has versioning enabled.
    pub versioned: bool,
}

/// Download an object into memory for editing. Capped at the passed `max_bytes`
/// so the webview never ingests a multi-GB blob.
pub async fn fetch_for_edit(
    state: &State<'_, AppState>,
    bucket_id: &str,
    bucket: &str,
    key: &str,
    max_bytes: u64,
) -> Result<EditorFetch, AppError> {
    let client = s3ops::get_client(state, bucket_id).await?;
    let versioned = is_versioned(&client, bucket).await;

    let resp = client
        .get_object()
        .bucket(bucket)
        .key(key)
        .send()
        .await
        .map_err(map_sdk_error)?;

    let content_length = resp.content_length().unwrap_or(0) as u64;
    if content_length > max_bytes {
        return Err(AppError::Provider(format!(
            "object is {} bytes; editor cap is {} bytes",
            content_length, max_bytes
        )));
    }

    let bytes = resp
        .body
        .collect()
        .await
        .map_err(|e| AppError::Provider(format!("read body: {e}")))?
        .into_bytes()
        .to_vec();

    if bytes.len() as u64 > max_bytes {
        return Err(AppError::Provider(format!(
            "downloaded {} bytes; editor cap is {} bytes",
            bytes.len(),
            max_bytes
        )));
    }

    Ok(EditorFetch {
        key: key.to_string(),
        bytes,
        version_id: resp.version_id,
        content_type: resp.content_type,
        etag: resp.e_tag.map(|s| s.trim_matches('"').to_string()),
        last_modified: resp
            .last_modified
            .map(|d| (d.as_secs_f64() * 1000.0) as i64),
        versioned,
    })
}

#[derive(Debug, serde::Serialize)]
pub struct EditorSaveResult {
    pub key: String,
    pub version_id: Option<String>,
    pub etag: Option<String>,
}

/// Save edited bytes back to S3 as a new object version (or overwrite if
/// unversioned). Returns the new version-id and etag.
pub async fn save_edit(
    state: &State<'_, AppState>,
    bucket_id: &str,
    bucket: &str,
    key: &str,
    bytes: Vec<u8>,
    content_type: Option<String>,
) -> Result<EditorSaveResult, AppError> {
    let client = s3ops::get_client(state, bucket_id).await?;
    let mut request = client
        .put_object()
        .bucket(bucket)
        .key(key)
        .body(ByteStream::from(bytes));
    if let Some(ct) = content_type {
        request = request.content_type(ct);
    }
    let resp = request.send().await.map_err(map_sdk_error)?;
    Ok(EditorSaveResult {
        key: key.to_string(),
        version_id: resp.version_id,
        etag: resp.e_tag.map(|s| s.trim_matches('"').to_string()),
    })
}

#[derive(Debug, serde::Serialize)]
pub struct ObjectVersion {
    pub version_id: String,
    pub etag: Option<String>,
    pub last_modified: Option<i64>,
    pub size: i64,
    pub is_latest: bool,
    pub storage_class: Option<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct VersionList {
    pub versioned: bool,
    pub versions: Vec<ObjectVersion>,
}

/// List versions of an object (versioning-enabled buckets only).
pub async fn list_versions(
    state: &State<'_, AppState>,
    bucket_id: &str,
    bucket: &str,
    key: &str,
) -> Result<VersionList, AppError> {
    let client = s3ops::get_client(state, bucket_id).await?;
    let versioned = is_versioned(&client, bucket).await;
    if !versioned {
        return Ok(VersionList {
            versioned: false,
            versions: Vec::new(),
        });
    }
    let resp = client
        .list_object_versions()
        .bucket(bucket)
        .prefix(key)
        .send()
        .await
        .map_err(map_sdk_error)?;
    let mut versions: Vec<ObjectVersion> = resp
        .versions()
        .iter()
        .filter(|v| v.key() == Some(key))
        .map(|v| ObjectVersion {
            version_id: v.version_id().unwrap_or_default().to_string(),
            etag: v.e_tag().map(|s| s.trim_matches('"').to_string()),
            last_modified: v.last_modified().map(|d| (d.as_secs_f64() * 1000.0) as i64),
            size: v.size().unwrap_or_default(),
            is_latest: v.is_latest().unwrap_or_default(),
            storage_class: v.storage_class().map(|s| s.as_str().to_string()),
        })
        .collect();
    versions.sort_by_key(|v| std::cmp::Reverse(v.last_modified.unwrap_or(0)));
    Ok(VersionList {
        versioned: true,
        versions,
    })
}

#[derive(Debug, serde::Serialize)]
pub struct RestoreResult {
    pub version_id: Option<String>,
    pub etag: Option<String>,
}

/// Restore a prior object version by copying it over the current key.
pub async fn restore_version(
    state: &State<'_, AppState>,
    bucket_id: &str,
    bucket: &str,
    key: &str,
    version_id: &str,
) -> Result<RestoreResult, AppError> {
    let client = s3ops::get_client(state, bucket_id).await?;
    let source = format!("{bucket}/{key}?versionId={version_id}");
    let resp = client
        .copy_object()
        .bucket(bucket)
        .key(key)
        .copy_source(source)
        .send()
        .await
        .map_err(map_sdk_error)?;
    let new_version = resp.version_id;
    let new_etag = resp
        .copy_object_result
        .and_then(|r| r.e_tag.map(|s| s.trim_matches('"').to_string()));
    Ok(RestoreResult {
        version_id: new_version,
        etag: new_etag,
    })
}

async fn is_versioned(client: &aws_sdk_s3::Client, bucket: &str) -> bool {
    match client.get_bucket_versioning().bucket(bucket).send().await {
        Ok(resp) => resp
            .status()
            .map(|s| s.as_str() == "Enabled")
            .unwrap_or(false),
        Err(_) => false,
    }
}
