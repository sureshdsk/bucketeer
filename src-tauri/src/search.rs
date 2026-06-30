use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use futures::stream::{FuturesOrdered, StreamExt};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Semaphore;

use crate::error::AppError;
use crate::s3ops;
use crate::state::AppState;

/// Maximum concurrency for parallel prefix listing (per `feature.md:45`).
const MAX_CONCURRENCY: usize = 10;
/// Streamed search channel name.
const CHANNEL: &str = "search://result";

#[derive(Debug, Serialize, Clone)]
pub struct SearchHit {
    pub key: String,
    pub size: i64,
    pub last_modified: Option<i64>,
    pub storage_class: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct SearchEnvelope {
    pub query: String,
    pub bucket: String,
    pub prefix: String,
    pub hit: Option<SearchHit>,
    pub done: bool,
    pub matches: usize,
}

/// Run a recursive, throttled search over `prefix` for keys containing `query`
/// (case-insensitive). Streams incremental hits via `search://result` events.
pub async fn deep_search(
    app: AppHandle,
    state: State<'_, AppState>,
    bucket_id: String,
    bucket: String,
    prefix: String,
    query: String,
    cancel: Arc<AtomicBool>,
) -> Result<usize, AppError> {
    let client = s3ops::get_client(&state, &bucket_id).await?;
    let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENCY));
    let matches = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let query_lc = query.to_ascii_lowercase();

    let mut queue: Vec<String> = vec![prefix.clone()];
    let mut inflight: FuturesOrdered<
        std::pin::Pin<Box<dyn std::future::Future<Output = Vec<String>> + Send>>,
    > = FuturesOrdered::new();

    while let Some(start_prefix) = queue.pop() {
        if cancel.load(Ordering::Relaxed) {
            break;
        }
        let permit = semaphore
            .clone()
            .acquire_owned()
            .await
            .map_err(|e| AppError::Internal(format!("semaphore closed: {e}")))?;
        let client = client.clone();
        let bucket = bucket.clone();
        let prefix_for_task = start_prefix.clone();
        let query_lc = query_lc.clone();
        let app = app.clone();
        let matches = matches.clone();
        let query_for_event = query.clone();
        let prefix_for_event = prefix.clone();
        let bucket_for_event = bucket.clone();

        inflight.push_back(Box::pin(async move {
            let _permit = permit;
            let mut next_children: Vec<String> = Vec::new();
            let mut continuation: Option<String> = None;
            loop {
                let mut request = client
                    .list_objects_v2()
                    .bucket(&bucket)
                    .prefix(&prefix_for_task)
                    .delimiter('/');
                if let Some(token) = continuation.take() {
                    request = request.continuation_token(token);
                }
                let response = match request.send().await {
                    Ok(r) => r,
                    Err(err) => {
                        tracing::warn!(prefix = %prefix_for_task, "search list failed: {err}");
                        break;
                    }
                };
                for obj in response.contents() {
                    if let Some(key) = obj.key() {
                        if key.to_ascii_lowercase().contains(&query_lc) {
                            let hit = SearchHit {
                                key: key.to_string(),
                                size: obj.size().unwrap_or_default(),
                                last_modified: obj
                                    .last_modified()
                                    .map(|d| (d.as_secs_f64() * 1000.0) as i64),
                                storage_class: obj.storage_class().map(|s| s.as_str().to_string()),
                            };
                            let prev = matches.fetch_add(1, Ordering::Relaxed);
                            let _ = app.emit(
                                CHANNEL,
                                SearchEnvelope {
                                    query: query_for_event.clone(),
                                    bucket: bucket_for_event.clone(),
                                    prefix: prefix_for_event.clone(),
                                    hit: Some(hit),
                                    done: false,
                                    matches: prev + 1,
                                },
                            );
                        }
                    }
                }
                for cp in response.common_prefixes() {
                    if let Some(p) = cp.prefix() {
                        if !p.is_empty() {
                            next_children.push(p.to_string());
                        }
                    }
                }
                match response.next_continuation_token {
                    Some(token) => continuation = Some(token.to_string()),
                    None => break,
                }
            }
            next_children
        }));

        // Bound inflight at MAX_CONCURRENCY * 2 so memory stays predictable.
        if inflight.len() >= MAX_CONCURRENCY * 2 {
            if let Some(children) = inflight.next().await {
                queue.extend(children);
            }
        }
    }

    while let Some(children) = inflight.next().await {
        queue.extend(children);
    }

    let final_matches = matches.load(Ordering::Relaxed);
    let _ = app.emit(
        CHANNEL,
        SearchEnvelope {
            query,
            bucket,
            prefix,
            hit: None,
            done: true,
            matches: final_matches,
        },
    );
    Ok(final_matches)
}
