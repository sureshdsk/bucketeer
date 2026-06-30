use serde::{Deserialize, Serialize};

use crate::provider::Provider;

/// Where a saved bucket's configuration originated.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BucketSource {
    BucketsToml,
    Keyring,
}

/// A user-facing saved bucket — a connection to an S3-compatible endpoint,
/// optionally pinned to a specific `bucket`/`prefix` so it opens directly.
/// Loaded from `~/.bucketeer/buckets.toml`; credentials live in the OS keyring.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bucket {
    pub id: String,
    pub name: String,
    pub provider: Provider,
    pub region: Option<String>,
    pub source: BucketSource,
    pub has_credentials: bool,
    pub endpoint_url: Option<String>,
    /// When set, this saved bucket opens directly to `bucket`/`prefix`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bucket: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prefix: Option<String>,
}

/// Minimal descriptor for a bucket discovered on the remote account via
/// `ListAllMyBuckets`. Distinct from the saved `Bucket` above.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteBucket {
    pub name: String,
    pub creation_date: Option<i64>,
}

/// Object metadata for table rows. Directories are synthesized by the listing
/// code from S3 `common_prefixes`; real objects carry their full key.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectMeta {
    pub key: String,
    pub size: i64,
    pub etag: Option<String>,
    pub last_modified: Option<i64>,
    pub storage_class: Option<String>,
    pub is_dir: bool,
}

/// A paginated slice of a folder's children. `next_cursor` is the opaque S3
/// continuation token to pass on the next `list_objects` call; `None` when the
/// page is exhausted.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListPage {
    pub items: Vec<ObjectMeta>,
    pub next_cursor: Option<String>,
    pub total: usize,
}

/// Rich object metadata returned by `head_object` for the details drawer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectDetails {
    pub key: String,
    pub size: i64,
    pub etag: Option<String>,
    pub last_modified: Option<i64>,
    pub storage_class: Option<String>,
    pub content_type: Option<String>,
    pub server_side_encryption: Option<String>,
    pub version_id: Option<String>,
    pub cache_control: Option<String>,
}

/// A user-pinned "saved location" — a named shortcut to a
/// `{provider_id, bucket, prefix}` tuple for one-click access. Persisted in
/// `~/.bucketeer/locations.toml` (non-secret).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredLocation {
    pub id: String,
    pub label: String,
    pub provider_id: String,
    pub bucket: String,
    #[serde(default)]
    pub prefix: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(default)]
    pub created_at: i64,
}
