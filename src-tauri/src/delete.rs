use std::collections::HashSet;

use aws_sdk_s3::types::{Delete, ObjectIdentifier};
use aws_smithy_types::error::metadata::ProvideErrorMetadata;
use tauri::State;

use crate::clients::map_sdk_error;
use crate::error::AppError;
use crate::s3ops;
use crate::state::AppState;

/// Outcome of a delete operation, reported back so the UI can show whether the
/// bulk path was used or the per-object fallback fired.
#[derive(Debug, serde::Serialize)]
pub struct DeleteOutcome {
    pub deleted: Vec<String>,
    pub errors: Vec<DeleteError>,
    /// `true` when the provider rejected bulk delete and we fell back to
    /// per-object `DeleteObject`. (`feature.md:5`)
    pub used_fallback: bool,
}

#[derive(Debug, serde::Serialize)]
pub struct DeleteError {
    pub key: String,
    pub code: String,
    pub message: String,
}

/// Delete up to 1000 keys in a single `DeleteObjects` call. If the provider
/// responds with `NotImplemented` / `MethodNotAllowed` (R2, MinIO), retry each
/// key individually. Recursive folder deletes expand the prefix first.
pub async fn delete_objects(
    state: &State<'_, AppState>,
    bucket_id: &str,
    bucket: &str,
    keys: Vec<String>,
    recursive: bool,
) -> Result<DeleteOutcome, AppError> {
    let client = s3ops::get_client(state, bucket_id).await?;

    let mut targets: Vec<String> = keys.into_iter().collect();
    if recursive {
        targets = expand_folders(&client, bucket, targets)
            .await
            .map_err(|e| AppError::Provider(format!("folder expand: {e}")))?;
    }
    // De-duplicate but keep order deterministic.
    let mut seen = HashSet::new();
    targets.retain(|k| seen.insert(k.clone()));

    if targets.is_empty() {
        return Ok(DeleteOutcome {
            deleted: Vec::new(),
            errors: Vec::new(),
            used_fallback: false,
        });
    }

    let mut outcome = bulk_delete(&client, bucket, targets.clone()).await;
    if outcome.used_fallback {
        outcome = per_object_delete(&client, bucket, targets).await;
    }
    Ok(outcome)
}

async fn bulk_delete(
    client: &aws_sdk_s3::Client,
    bucket: &str,
    keys: Vec<String>,
) -> DeleteOutcome {
    let mut objects: Vec<ObjectIdentifier> = Vec::with_capacity(keys.len());
    for key in &keys {
        let built = ObjectIdentifier::builder().key(key).build();
        match built {
            Ok(id) => objects.push(id),
            Err(err) => {
                return DeleteOutcome {
                    deleted: Vec::new(),
                    errors: vec![DeleteError {
                        key: key.clone(),
                        code: "BuildError".into(),
                        message: err.to_string(),
                    }],
                    used_fallback: false,
                };
            }
        }
    }

    let delete = match Delete::builder().set_objects(Some(objects)).build() {
        Ok(d) => d,
        Err(err) => {
            return DeleteOutcome {
                deleted: Vec::new(),
                errors: vec![DeleteError {
                    key: "*".into(),
                    code: "BuildError".into(),
                    message: err.to_string(),
                }],
                used_fallback: false,
            };
        }
    };
    let request = client.delete_objects().bucket(bucket).delete(delete);
    match request.send().await {
        Ok(resp) => {
            let mut deleted: Vec<String> = resp
                .deleted()
                .iter()
                .filter_map(|d| d.key().map(|s| s.to_string()))
                .collect();
            let mut errors: Vec<DeleteError> = resp
                .errors()
                .iter()
                .map(|e| DeleteError {
                    key: e.key().unwrap_or_default().to_string(),
                    code: e.code().unwrap_or_default().to_string(),
                    message: e.message().unwrap_or_default().to_string(),
                })
                .collect();
            // Anything not in `deleted` (and without an error entry) is presumed
            // missing from the response — surface as a soft error.
            let surfaced: HashSet<String> = deleted
                .iter()
                .chain(errors.iter().map(|e| &e.key))
                .cloned()
                .collect();
            for k in &keys {
                if !surfaced.contains(k) {
                    errors.push(DeleteError {
                        key: k.clone(),
                        code: "NoResponse".into(),
                        message: "provider did not acknowledge delete".into(),
                    });
                }
            }
            deleted.sort();
            DeleteOutcome {
                deleted,
                errors,
                used_fallback: false,
            }
        }
        Err(err) => {
            let code = err.code().unwrap_or_default().to_string();
            let message = err
                .message()
                .map(str::to_string)
                .unwrap_or_else(|| err.to_string());
            let lower = code.to_ascii_lowercase();
            if lower == "notimplemented"
                || lower == "methodnotallowed"
                || lower == "x_amz_unsupported_operation"
                || lower.contains("notimplemented")
                || message.to_ascii_lowercase().contains("method not allowed")
            {
                DeleteOutcome {
                    deleted: Vec::new(),
                    errors: Vec::new(),
                    used_fallback: true,
                }
            } else {
                let mapped = map_sdk_error(err);
                DeleteOutcome {
                    deleted: Vec::new(),
                    errors: vec![DeleteError {
                        key: "*".into(),
                        code: format!("{:?}", mapped)
                            .split('(')
                            .next()
                            .unwrap_or("")
                            .into(),
                        message: mapped.to_string(),
                    }],
                    used_fallback: false,
                }
            }
        }
    }
}

async fn per_object_delete(
    client: &aws_sdk_s3::Client,
    bucket: &str,
    keys: Vec<String>,
) -> DeleteOutcome {
    let mut deleted: Vec<String> = Vec::new();
    let mut errors: Vec<DeleteError> = Vec::new();
    for key in keys {
        match client.delete_object().bucket(bucket).key(&key).send().await {
            Ok(_) => deleted.push(key),
            Err(err) => errors.push(DeleteError {
                key,
                code: err.code().unwrap_or_default().to_string(),
                message: err
                    .message()
                    .map(str::to_string)
                    .unwrap_or_else(|| err.to_string()),
            }),
        }
    }
    deleted.sort();
    DeleteOutcome {
        deleted,
        errors,
        used_fallback: true,
    }
}

/// Recursively expand a list of keys (folders end with `/`) into the full set
/// of real object keys under each prefix.
async fn expand_folders(
    client: &aws_sdk_s3::Client,
    bucket: &str,
    seeds: Vec<String>,
) -> Result<Vec<String>, String> {
    let mut out: Vec<String> = Vec::new();
    for seed in seeds {
        if seed.ends_with('/') {
            let mut continuation: Option<String> = None;
            loop {
                let mut request = client.list_objects_v2().bucket(bucket).prefix(&seed);
                if let Some(token) = continuation.take() {
                    request = request.continuation_token(token);
                }
                let response = request.send().await.map_err(|e| e.to_string())?;
                for obj in response.contents() {
                    if let Some(key) = obj.key() {
                        if !key.is_empty() {
                            out.push(key.to_string());
                        }
                    }
                }
                match response.next_continuation_token {
                    Some(token) => continuation = Some(token.to_string()),
                    None => break,
                }
            }
        } else {
            out.push(seed);
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dedup_preserves_order() {
        let mut seen = HashSet::new();
        let mut v = vec!["a".to_string(), "b".into(), "a".into(), "c".into()];
        v.retain(|k| seen.insert(k.clone()));
        assert_eq!(v, vec!["a", "b", "c"]);
    }
}
