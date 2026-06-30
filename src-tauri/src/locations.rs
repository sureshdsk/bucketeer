use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::models::StoredLocation;

/// File-backed store for the user's pinned "saved locations". Mirrors the
/// providers pattern: a small TOML file under `~/.bucketeer/locations.toml`.
/// Locations hold only non-secret connection targets (provider id + bucket +
/// prefix); credentials stay in the keyring, keyed by the provider id.

#[derive(Debug, Default, Deserialize, Serialize)]
struct LocationsFile {
    #[serde(default)]
    location: Vec<StoredLocation>,
}

fn config_path() -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;
    Some(
        PathBuf::from(home)
            .join(".bucketeer")
            .join("locations.toml"),
    )
}

fn ensure_dir() -> Result<PathBuf, AppError> {
    let home = std::env::var("HOME").map_err(|_| AppError::Internal("HOME not set".into()))?;
    let dir = PathBuf::from(home).join(".bucketeer");
    fs::create_dir_all(&dir)
        .map_err(|e| AppError::Internal(format!("create {}: {e}", dir.display())))?;
    Ok(dir)
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub fn load_locations() -> Vec<StoredLocation> {
    let Some(path) = config_path() else {
        return Vec::new();
    };
    let Ok(content) = fs::read_to_string(&path) else {
        return Vec::new();
    };
    match toml::from_str::<LocationsFile>(&content) {
        Ok(parsed) => parsed.location,
        Err(err) => {
            tracing::warn!("failed to parse {}: {err}", path.display());
            Vec::new()
        }
    }
}

fn write_locations(locations: &[StoredLocation]) -> Result<(), AppError> {
    let dir = ensure_dir()?;
    let path = dir.join("locations.toml");
    let file = LocationsFile {
        location: locations.to_vec(),
    };
    let serialized = toml::to_string_pretty(&file)
        .map_err(|e| AppError::Internal(format!("serialize locations: {e}")))?;
    let header = "# Bucketeer saved locations.\n";
    fs::write(&path, format!("{header}{serialized}"))
        .map_err(|e| AppError::Internal(format!("write {}: {e}", path.display())))?;
    Ok(())
}

/// Insert or update a location by id. `created_at` is preserved on update and
/// stamped on insert (when the caller passes 0). Returns the full list so the
/// caller can refresh its in-memory store.
pub fn upsert_location(loc: StoredLocation) -> Result<Vec<StoredLocation>, AppError> {
    let mut locations = load_locations();
    if let Some(existing) = locations.iter_mut().find(|l| l.id == loc.id) {
        let created_at = existing.created_at;
        *existing = StoredLocation {
            created_at: if created_at != 0 {
                created_at
            } else {
                loc.created_at
            },
            ..loc
        };
    } else {
        let mut new = loc;
        if new.created_at == 0 {
            new.created_at = now_millis();
        }
        locations.push(new);
    }
    write_locations(&locations)?;
    Ok(locations)
}

pub fn delete_location(id: &str) -> Result<Vec<StoredLocation>, AppError> {
    let mut locations = load_locations();
    locations.retain(|l| l.id != id);
    write_locations(&locations)?;
    Ok(locations)
}

/// Reorder locations to match `ids`. Any locations not referenced are appended
/// in their original relative order (defensive against partial id lists).
pub fn set_location_order(ids: Vec<String>) -> Result<Vec<StoredLocation>, AppError> {
    let locations = load_locations();
    let mut by_id: std::collections::HashMap<&str, &StoredLocation> =
        locations.iter().map(|l| (l.id.as_str(), l)).collect();
    let mut ordered: Vec<StoredLocation> = Vec::new();
    for id in &ids {
        if let Some(loc) = by_id.remove(id.as_str()) {
            ordered.push(loc.clone());
        }
    }
    for (_, loc) in by_id {
        ordered.push(loc.clone());
    }
    write_locations(&ordered)?;
    Ok(ordered)
}
