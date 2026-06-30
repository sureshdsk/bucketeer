use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// Telemetry consent states. `Undecided` is the first-run default; the UI shows
/// a consent gate and records the user's choice before any event is written.
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Consent {
    #[default]
    Undecided,
    Accepted,
    Declined,
}

/// User-level application settings, persisted to `~/.bucketeer/settings.toml`.
/// All fields are non-secret preferences.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    #[serde(default)]
    pub telemetry_consent: Consent,
    #[serde(default)]
    pub telemetry_first_asked: Option<i64>,
    #[serde(default)]
    pub telemetry_decided_at: Option<i64>,
    #[serde(default = "default_true")]
    pub updater_enabled: bool,
    #[serde(default)]
    pub last_launched_version: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            telemetry_consent: Consent::Undecided,
            telemetry_first_asked: None,
            telemetry_decided_at: None,
            updater_enabled: true,
            last_launched_version: None,
        }
    }
}

fn default_true() -> bool {
    true
}

/// Resolve `~/.bucketeer` (or the platform HOME equivalent). None when HOME is
/// unavailable — callers should treat that as "no persistence" rather than fatal.
pub fn config_dir() -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;
    Some(PathBuf::from(home).join(".bucketeer"))
}

/// Return the path to a guaranteed-to-exist config dir, creating it on demand.
pub fn ensure_config_dir() -> Result<PathBuf, AppError> {
    let dir = config_dir().ok_or_else(|| AppError::Internal("HOME not set".into()))?;
    if !dir.exists() {
        fs::create_dir_all(&dir)
            .map_err(|e| AppError::Internal(format!("create {}: {e}", dir.display())))?;
    }
    Ok(dir)
}

fn settings_path() -> Option<PathBuf> {
    config_dir().map(|d| d.join("settings.toml"))
}

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Load settings from disk. Missing or unparseable file → defaults (logged).
pub fn load_settings() -> AppSettings {
    let Some(path) = settings_path() else {
        return AppSettings::default();
    };
    let Ok(content) = fs::read_to_string(&path) else {
        return AppSettings::default();
    };
    match toml::from_str::<AppSettings>(&content) {
        Ok(s) => s,
        Err(err) => {
            tracing::warn!("failed to parse {}: {err}", path.display());
            AppSettings::default()
        }
    }
}

/// Atomically persist settings. Writes a header so the file is self-documenting.
pub fn save_settings(settings: &AppSettings) -> Result<(), AppError> {
    let dir = ensure_config_dir()?;
    let path = dir.join("settings.toml");
    let serialized = toml::to_string_pretty(settings)
        .map_err(|e| AppError::Internal(format!("serialize settings: {e}")))?;
    let header = "# Bucketeer user settings (non-secret).\n";
    let tmp = dir.join(".settings.toml.tmp");
    fs::write(&tmp, format!("{header}{serialized}"))
        .map_err(|e| AppError::Internal(format!("write {}: {e}", tmp.display())))?;
    fs::rename(&tmp, &path)
        .map_err(|e| AppError::Internal(format!("rename {}: {e}", path.display())))?;
    Ok(())
}

/// Stamp the first-asked timestamp the first time the consent gate is shown.
pub fn mark_telemetry_first_asked(settings: &mut AppSettings) {
    if settings.telemetry_first_asked.is_none() {
        settings.telemetry_first_asked = Some(now_millis());
    }
}

/// Record the user's telemetry decision and persist.
pub fn set_telemetry_consent(consent: Consent) -> Result<AppSettings, AppError> {
    let mut settings = load_settings();
    mark_telemetry_first_asked(&mut settings);
    settings.telemetry_consent = consent;
    settings.telemetry_decided_at = Some(now_millis());
    save_settings(&settings)?;
    tracing::info!("telemetry consent set to {consent:?}");
    Ok(settings)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_round_trip() {
        let s = AppSettings {
            telemetry_consent: Consent::Accepted,
            updater_enabled: false,
            ..Default::default()
        };
        let serialized = toml::to_string(&s).unwrap();
        let parsed: AppSettings = toml::from_str(&serialized).unwrap();
        assert_eq!(parsed.telemetry_consent, Consent::Accepted);
        assert!(!parsed.updater_enabled);
    }

    #[test]
    fn missing_fields_default() {
        let parsed: AppSettings = toml::from_str("").unwrap();
        assert_eq!(parsed.telemetry_consent, Consent::Undecided);
        assert!(parsed.updater_enabled);
    }
}
