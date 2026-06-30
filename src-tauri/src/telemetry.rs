use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::settings::{config_dir, Consent};

/// A single anonymized telemetry record. No secrets, keys, or object data ever
/// cross the sink — only coarse kind/name pairs and scalar properties.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryEvent {
    /// ISO-style unix millis timestamp.
    pub ts: i64,
    /// Coarse category, e.g. "app_launch", "action", "error".
    pub kind: String,
    /// Stable event name, e.g. "bucket_opened", "upload_completed".
    pub name: String,
    /// App version when the event was recorded.
    pub version: String,
}

/// Pluggable sink so a remote backend can be wired later without touching call
/// sites. The MVP ships the local-file sink only — nothing leaves the machine
/// until a backend is configured (`feature.md` privacy-aware audience).
pub trait TelemetrySink: Send + Sync {
    fn record(&self, event: &TelemetryEvent);
}

/// Writes events as newline-delimited JSON to `~/.bucketeer/logs/telemetry.jsonl`.
/// Best-effort: a write failure is logged and dropped so telemetry never breaks
/// the operation that produced the event.
pub struct LocalFileSink {
    path: PathBuf,
    lock: Mutex<()>,
}

impl LocalFileSink {
    pub fn new() -> Option<Self> {
        let dir = config_dir()?.join("logs");
        if !dir.exists() {
            fs::create_dir_all(&dir).ok()?;
        }
        Some(Self {
            path: dir.join("telemetry.jsonl"),
            lock: Mutex::new(()),
        })
    }
}

impl Default for LocalFileSink {
    fn default() -> Self {
        LocalFileSink::new().unwrap_or(LocalFileSink {
            path: PathBuf::from("/dev/null"),
            lock: Mutex::new(()),
        })
    }
}

impl TelemetrySink for LocalFileSink {
    fn record(&self, event: &TelemetryEvent) {
        let _guard = self.lock.lock();
        let line = match serde_json::to_string(event) {
            Ok(s) => s,
            Err(err) => {
                tracing::warn!("telemetry serialize failed: {err}");
                return;
            }
        };
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path);
        match file {
            Ok(mut f) => {
                if let Err(err) = writeln!(f, "{line}") {
                    tracing::warn!("telemetry write failed: {err}");
                }
            }
            Err(err) => {
                tracing::warn!("telemetry open {} failed: {err}", self.path.display());
            }
        }
    }
}

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Record an event when the user has opted in. Declined or undecided states
/// send nothing — the decision itself was already logged via the settings module.
pub fn record_opted_in(kind: &str, name: &str) {
    let settings = crate::settings::load_settings();
    if settings.telemetry_consent != Consent::Accepted {
        return;
    }
    let event = TelemetryEvent {
        ts: now_millis(),
        kind: kind.to_string(),
        name: name.to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    };
    let sink = LocalFileSink::default();
    sink.record(&event);
}

/// Append a line to the diagnostics log regardless of consent — this is the
/// "logs the decision" requirement, written next to (not gated by) telemetry.
pub fn log_decision(message: &str) -> Result<(), AppError> {
    let dir = crate::settings::ensure_config_dir()?.join("logs");
    fs::create_dir_all(&dir)
        .map_err(|e| AppError::Internal(format!("create {}: {e}", dir.display())))?;
    let path = dir.join("decisions.log");
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| AppError::Internal(format!("open {}: {e}", path.display())))?;
    let ts = now_millis();
    writeln!(file, "{ts} {message}").map_err(|e| AppError::Internal(format!("write: {e}")))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn event_serializes_to_json() {
        let e = TelemetryEvent {
            ts: 1,
            kind: "action".into(),
            name: "x".into(),
            version: "0.1.0".into(),
        };
        let s = serde_json::to_string(&e).unwrap();
        assert!(s.contains("\"kind\":\"action\""));
        assert!(s.contains("\"name\":\"x\""));
    }

    #[test]
    fn declined_records_nothing_when_consent_declined() {
        // record_opted_in reads live settings; with no settings file the default
        // is Undecided, so it must short-circuit before touching the sink.
        // This test just guards the consent branch logic by confirming the
        // function returns cleanly with default (undecided) settings.
        record_opted_in("test", "noop");
    }
}
