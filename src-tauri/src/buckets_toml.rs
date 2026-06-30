use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::models::{Bucket, BucketSource};
use crate::provider::Provider;

#[derive(Debug, Deserialize, Serialize, Default)]
struct TomlFile {
    #[serde(default)]
    bucket: Vec<TomlBucket>,
}

/// Legacy on-disk shape (`~/.bucketeer/providers.toml`, `[[provider]]` table).
/// Used only by the one-time migration in [`load_buckets`].
#[derive(Debug, Deserialize)]
struct LegacyFile {
    #[serde(default)]
    provider: Vec<TomlBucket>,
}

#[derive(Debug, Deserialize, Serialize)]
struct TomlBucket {
    id: String,
    name: String,
    provider: String,
    #[serde(default)]
    region: String,
    endpoint_url: Option<String>,
    #[serde(default)]
    force_path_style: bool,
    #[serde(default)]
    bucket: Option<String>,
    #[serde(default)]
    prefix: Option<String>,
}

fn config_dir() -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;
    Some(PathBuf::from(home).join(".bucketeer"))
}

fn config_path() -> Option<PathBuf> {
    Some(config_dir()?.join("buckets.toml"))
}

fn legacy_path() -> Option<PathBuf> {
    Some(config_dir()?.join("providers.toml"))
}

/// Parse the provider string back into a `Provider` enum, matching the serde
/// rename form used everywhere else.
fn parse_provider(value: &str) -> Provider {
    match value {
        "aws_s3" => Provider::AwsS3,
        "digitalocean_spaces" => Provider::DigitalOceanSpaces,
        "cloudflare_r2" => Provider::CloudflareR2,
        _ => Provider::Custom,
    }
}

/// One-time migration from the legacy `providers.toml` (`[[provider]]`) file to
/// the current `buckets.toml` (`[[bucket]]`) file. Runs only when the new file
/// is absent but the legacy file exists. The legacy file is left in place so the
/// rollback path is safe; `load_buckets` always prefers `buckets.toml`.
fn migrate_legacy() {
    let (Some(dir), Some(new_path), Some(legacy)) = (config_dir(), config_path(), legacy_path())
    else {
        return;
    };
    if new_path.exists() || !legacy.exists() {
        return;
    }
    let Ok(content) = fs::read_to_string(&legacy) else {
        return;
    };
    let Ok(parsed) = toml::from_str::<LegacyFile>(&content) else {
        return;
    };
    let migrated = TomlFile {
        bucket: parsed.provider,
    };
    let Ok(serialized) = toml::to_string_pretty(&migrated) else {
        return;
    };
    let header = "# Bucketeer saved buckets. Secrets live in the OS keyring.\n";
    let _ = fs::create_dir_all(&dir);
    let _ = fs::write(&new_path, format!("{header}{serialized}"));
}

/// Load saved buckets from `~/.bucketeer/buckets.toml`.
///
/// This file holds only **non-secret** connection metadata. Secrets are never
/// written to disk — they live in the OS keyring (`secrets::set_credentials`).
/// If `buckets.toml` is absent but the legacy `providers.toml` exists, it is
/// migrated forward once.
pub fn load_buckets() -> Vec<Bucket> {
    migrate_legacy();
    let Some(path) = config_path() else {
        return Vec::new();
    };
    let Ok(content) = fs::read_to_string(&path) else {
        return Vec::new();
    };
    let parsed: TomlFile = match toml::from_str(&content) {
        Ok(value) => value,
        Err(err) => {
            tracing::warn!("failed to parse {}: {err}", path.display());
            return Vec::new();
        }
    };

    parsed
        .bucket
        .into_iter()
        .map(|p| {
            let provider = parse_provider(&p.provider);
            let region = if p.region.is_empty() {
                default_region_for(provider)
            } else {
                p.region
            };
            let endpoint_url = p
                .endpoint_url
                .or_else(|| provider.default_endpoint(&region));
            let force_path_style = p.force_path_style;
            // Optimistically report credentials as present without touching the
            // OS keyring. `save_bucket` always writes to the keyring, so any row
            // in buckets.toml should have matching credentials. Probing the
            // keychain here triggers an authorization prompt per bucket on macOS
            // — especially painful in dev where the code signature changes per
            // rebuild.
            let has_credentials = true;
            let _ = force_path_style; // honored when the client is built (provider-aware default)
            Bucket {
                id: format!("toml:{}", p.id),
                name: p.name,
                provider,
                region: Some(region),
                source: BucketSource::BucketsToml,
                has_credentials,
                endpoint_url,
                bucket: p.bucket.filter(|b| !b.is_empty()),
                prefix: p.prefix.filter(|b| !b.is_empty()),
            }
        })
        .collect()
}

fn default_region_for(provider: Provider) -> String {
    match provider {
        Provider::DigitalOceanSpaces => "nyc3".to_string(),
        _ => "us-east-1".to_string(),
    }
}

/// Persist a new (or updated) saved bucket to `buckets.toml`, rewriting the
/// whole file. Secrets must go to the keyring via `secrets::set_credentials`;
/// only non-secret connection metadata is stored here. Returns the full
/// refreshed bucket set so the caller can update its in-memory list.
#[allow(clippy::too_many_arguments)] // one positional field per column
pub fn save_bucket(
    id: &str,
    name: &str,
    provider: Provider,
    region: &str,
    endpoint_url: Option<&str>,
    force_path_style: bool,
    bucket: Option<&str>,
    prefix: Option<&str>,
) -> Result<Vec<Bucket>, String> {
    let Some(dir) = config_dir() else {
        return Err("HOME not set; cannot locate ~/.bucketeer".into());
    };
    if let Err(err) = fs::create_dir_all(&dir) {
        return Err(format!("create {}: {err}", dir.display()));
    }
    let path = dir.join("buckets.toml");
    let mut parsed = match fs::read_to_string(&path) {
        Ok(body) => toml::from_str::<TomlFile>(&body).unwrap_or_default(),
        Err(_) => TomlFile::default(),
    };

    let region_value = if region.is_empty() {
        default_region_for(provider)
    } else {
        region.to_string()
    };
    let endpoint_value = endpoint_url
        .map(str::to_string)
        .or_else(|| provider.default_endpoint(&region_value));

    let entry = TomlBucket {
        id: id.to_string(),
        name: name.to_string(),
        provider: match provider {
            Provider::AwsS3 => "aws_s3".into(),
            Provider::DigitalOceanSpaces => "digitalocean_spaces".into(),
            Provider::CloudflareR2 => "cloudflare_r2".into(),
            Provider::Custom => "custom".into(),
        },
        region: region_value,
        endpoint_url: endpoint_value,
        force_path_style,
        bucket: bucket.map(str::to_string).filter(|b| !b.is_empty()),
        prefix: prefix.map(str::to_string).filter(|b| !b.is_empty()),
    };

    if let Some(existing) = parsed.bucket.iter_mut().find(|p| p.id == entry.id) {
        *existing = entry;
    } else {
        parsed.bucket.push(entry);
    }

    let serialized = toml::to_string_pretty(&parsed).map_err(|e| e.to_string())?;
    let header = "# Bucketeer saved buckets. Secrets live in the OS keyring.\n";
    fs::write(&path, format!("{header}{serialized}"))
        .map_err(|e| format!("write {}: {e}", path.display()))?;

    Ok(load_buckets())
}

/// Remove a saved bucket from `buckets.toml` by id. Returns the refreshed set.
pub fn remove_bucket(id: &str) -> Result<Vec<Bucket>, String> {
    let Some(path) = config_path() else {
        return Ok(Vec::new());
    };
    let mut parsed: TomlFile = match fs::read_to_string(&path) {
        Ok(body) => toml::from_str(&body).unwrap_or_default(),
        Err(_) => return Ok(load_buckets()),
    };
    let before = parsed.bucket.len();
    parsed.bucket.retain(|p| p.id != id);
    if parsed.bucket.len() == before {
        return Ok(load_buckets());
    }
    let serialized = toml::to_string_pretty(&parsed).map_err(|e| e.to_string())?;
    let header = "# Bucketeer saved buckets. Secrets live in the OS keyring.\n";
    fs::write(&path, format!("{header}{serialized}"))
        .map_err(|e| format!("write {}: {e}", path.display()))?;
    Ok(load_buckets())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_saved_bucket() {
        let body = r#"
[[bucket]]
id = "do-default"
name = "DigitalOcean Spaces"
provider = "digitalocean_spaces"
region = "nyc3"
"#;
        let parsed: TomlFile = toml::from_str(body).unwrap();
        assert_eq!(parsed.bucket.len(), 1);
        assert_eq!(parsed.bucket[0].id, "do-default");
        assert_eq!(parsed.bucket[0].provider, "digitalocean_spaces");
    }

    #[test]
    fn empty_file_is_valid() {
        let parsed: TomlFile = toml::from_str("").unwrap();
        assert!(parsed.bucket.is_empty());
    }

    #[test]
    fn legacy_provider_table_is_migratable() {
        let body = r#"
[[provider]]
id = "do-default"
name = "DigitalOcean Spaces"
provider = "digitalocean_spaces"
region = "nyc3"
"#;
        let parsed: LegacyFile = toml::from_str(body).unwrap();
        assert_eq!(parsed.provider.len(), 1);
        assert_eq!(parsed.provider[0].id, "do-default");
    }
}
