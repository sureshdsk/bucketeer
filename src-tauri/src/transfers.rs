use serde::{Deserialize, Serialize};

/// Stable channel name emitted over Tauri for every progress tick.
pub const CHANNEL: &str = "transfer://progress";

/// Snake-cased to match the `serde(rename_all)` convention used by Rust enums
/// mirrored to TypeScript (`src/lib/ipc.ts`).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TransferKind {
    Upload,
    Download,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TransferPhase {
    Queued,
    Starting,
    Active,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferProgress {
    pub id: String,
    pub kind: TransferKind,
    pub phase: TransferPhase,
    pub key: String,
    pub bytes: u64,
    pub total: u64,
    pub progress: f64,
    pub error: Option<String>,
}

/// Generate a fresh, opaque transfer id (URL-safe, prefixed for grep-ability).
pub fn new_transfer_id() -> String {
    format!("tr-{}", uuid::Uuid::new_v4().simple())
}

/// A handle for in-flight transfers exposed to the IPC layer.
pub struct TransferHandle {
    #[allow(dead_code)] // kept for richer future IPC (per-transfer status)
    pub kind: TransferKind,
    pub cancel: std::sync::Arc<std::sync::atomic::AtomicBool>,
}

impl TransferHandle {
    pub fn new(kind: TransferKind) -> Self {
        Self {
            kind,
            cancel: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
        }
    }
}
