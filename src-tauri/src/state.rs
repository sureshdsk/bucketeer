use std::collections::HashMap;
use std::sync::Mutex;

use aws_sdk_s3::Client;

use crate::buckets_toml::load_buckets;
use crate::models::{Bucket, BucketSource};
use crate::provider::Provider;

/// Process-wide application state managed by Tauri.
pub struct AppState {
    pub buckets: Mutex<Vec<Bucket>>,
    pub clients: tokio::sync::Mutex<HashMap<String, Client>>,
}

impl AppState {
    /// Build the saved-bucket set from `~/.bucketeer/buckets.toml`. If nothing
    /// is configured, seed a DigitalOcean Spaces (nyc3) default so the UI is
    /// explorable on first run.
    pub fn load_buckets() -> Vec<Bucket> {
        let mut buckets = load_buckets();

        if buckets.is_empty() {
            let region = "nyc3".to_string();
            buckets.push(Bucket {
                id: "do-default".into(),
                name: "DigitalOcean Spaces".into(),
                provider: Provider::DigitalOceanSpaces,
                region: Some(region.clone()),
                source: BucketSource::BucketsToml,
                has_credentials: true,
                endpoint_url: Provider::DigitalOceanSpaces.default_endpoint(&region),
                bucket: None,
                prefix: None,
            });
        }
        buckets
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            buckets: Mutex::new(Self::load_buckets()),
            clients: tokio::sync::Mutex::new(HashMap::new()),
        }
    }
}
