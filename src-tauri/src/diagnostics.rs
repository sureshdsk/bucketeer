use std::fs;
use std::io::{Cursor, Seek, Write};

use serde::{Deserialize, Serialize};
use tauri::State;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

use crate::error::{poisoned, AppError};
use crate::models::Bucket;
use crate::provider::Provider;
use crate::settings::{config_dir, load_settings, Consent};
use crate::state::AppState;

/// Static application + environment metadata, surfaced in Settings → About and
/// bundled into diagnostics exports.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppInfo {
    pub version: String,
    pub os: String,
    pub arch: String,
}

/// Filesystem locations the app reads/writes. Shown in Settings → Data so users
/// can find logs/cache without guessing.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppPaths {
    pub config: Option<String>,
    pub logs: Option<String>,
    pub cache: Option<String>,
}

pub fn app_info() -> AppInfo {
    AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    }
}

pub fn app_paths() -> AppPaths {
    let root = config_dir();
    AppPaths {
        config: root.as_ref().map(|p| p.display().to_string()),
        logs: root.as_ref().map(|p| p.join("logs").display().to_string()),
        cache: root.as_ref().map(|p| p.join("cache").display().to_string()),
    }
}

/// Drop every cached S3 client and any on-disk cache. Forcing the client cache
/// to rebuild is the meaningful analogue of "wipe the PrefixTree" since the move
/// to native S3 pagination: the next folder visit re-issues the round trip.
pub async fn clear_cache(state: &State<'_, AppState>) -> Result<(), AppError> {
    state.clients.lock().await.clear();
    if let Some(cache) = config_dir().map(|d| d.join("cache")) {
        if cache.exists() {
            fs::remove_dir_all(&cache)
                .map_err(|e| AppError::Internal(format!("clear {}: {e}", cache.display())))?;
        }
    }
    Ok(())
}

/// Snapshot the saved buckets for the diagnostics bundle. Held under the std
/// mutex only long enough to clone the list, so no await is crossed.
pub fn snapshot_buckets(state: &State<'_, AppState>) -> Result<Vec<Bucket>, AppError> {
    let guard = state.buckets.lock().map_err(poisoned)?;
    Ok(guard.clone())
}

fn add_text<W: Write + Seek>(
    zip: &mut ZipWriter<W>,
    name: &str,
    contents: &str,
    opts: SimpleFileOptions,
) {
    let _ = zip.start_file(name, opts);
    let _ = zip.write_all(contents.as_bytes());
}

/// Bundle redacted diagnostics into a zip under the OS temp dir and return its
/// path. Credentials are never included — only coarse config + logs. Operates
/// entirely on owned data so it can run on a blocking thread.
pub fn export_diagnostics(buckets: &[Bucket]) -> Result<String, AppError> {
    let info = app_info();
    let settings = load_settings();
    let paths = app_paths();

    let system_json = serde_json::to_string_pretty(&serde_json::json!({
        "app": info,
        "paths": paths,
        "consent": match settings.telemetry_consent {
            Consent::Undecided => "undecided",
            Consent::Accepted => "accepted",
            Consent::Declined => "declined",
        },
        "updater_enabled": settings.updater_enabled,
    }))
    .map_err(|e| AppError::Internal(format!("serialize system info: {e}")))?;

    let saved = buckets
        .iter()
        .map(|b| {
            format!(
                "- {} [{}] provider={} region={} endpoint={}",
                b.name,
                b.id,
                match b.provider {
                    Provider::AwsS3 => "aws_s3",
                    Provider::DigitalOceanSpaces => "digitalocean_spaces",
                    Provider::CloudflareR2 => "cloudflare_r2",
                    Provider::Custom => "custom",
                },
                b.region.as_deref().unwrap_or(""),
                b.endpoint_url.as_deref().unwrap_or(""),
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    let opts = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o644);

    let mut zip = ZipWriter::new(Cursor::new(Vec::new()));
    add_text(&mut zip, "system.json", &system_json, opts);
    add_text(&mut zip, "buckets.txt", &saved, opts);
    add_text(&mut zip, "settings.toml", &read_redacted_settings(), opts);

    if let Some(logs) = config_dir().map(|d| d.join("logs")) {
        for entry in fs::read_dir(&logs).into_iter().flatten().flatten() {
            if let Some(name) = entry.file_name().to_str() {
                if let Ok(bytes) = fs::read(entry.path()) {
                    let zip_name = format!("logs/{name}");
                    let _ = zip.start_file(&zip_name, opts);
                    let _ = zip.write_all(&bytes);
                }
            }
        }
    }

    let bytes = zip
        .finish()
        .map_err(|e| AppError::Internal(format!("finalize diagnostics zip: {e}")))?
        .into_inner();

    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Prefer the user's Downloads dir so the bundle is easy to find; fall back
    // to a per-app temp dir when Downloads isn't resolvable.
    let dir =
        dirs::download_dir().unwrap_or_else(|| std::env::temp_dir().join("bucketeer-diagnostics"));
    fs::create_dir_all(&dir)
        .map_err(|e| AppError::Internal(format!("create {}: {e}", dir.display())))?;
    let path = dir.join(format!("bucketeer-diagnostics-{stamp}.zip"));
    fs::write(&path, &bytes)
        .map_err(|e| AppError::Internal(format!("write {}: {e}", path.display())))?;
    Ok(path.display().to_string())
}

/// Read settings.toml for the bundle; it already holds only non-secret
/// preferences. Returns a header when the file is absent.
fn read_redacted_settings() -> String {
    match config_dir().map(|d| d.join("settings.toml")) {
        Some(path) => fs::read_to_string(&path).unwrap_or_else(|_| "# (no settings.toml)".into()),
        None => "# (HOME unavailable)".into(),
    }
}
