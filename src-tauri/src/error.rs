use serde::Serialize;

/// Typed errors that cross the IPC bridge as `{ "code": <variant>, "message": <string> }`.
/// Mirrors `AppErrorCode` in `src/lib/ipc.ts`.
#[allow(dead_code)] // forward-looking IPC contract; variants are constructed from Phase 1.
#[derive(Debug, thiserror::Error, Serialize)]
#[serde(tag = "code", content = "message")]
pub enum AppError {
    #[error("access denied: {0}")]
    AccessDenied(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("network error: {0}")]
    Network(String),
    #[error("provider error: {0}")]
    Provider(String),
    #[error("internal error: {0}")]
    Internal(String),
}

impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        AppError::Internal(err.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Internal(err.to_string())
    }
}

/// Lock-poisoning is treated as internal corruption; map it at call sites with
/// `.map_err(poisoned)?`.
pub fn poisoned<E: std::fmt::Display>(err: E) -> AppError {
    AppError::Internal(format!("state lock poisoned: {err}"))
}
