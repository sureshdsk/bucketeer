use serde::{Deserialize, Serialize};

/// S3-compatible providers supported by the app.
/// Serialized as explicit lowercase strings to match `ProviderKind` in
/// `src/lib/ipc.ts` (brand spelling, e.g. "digitalocean_spaces").
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum Provider {
    #[serde(rename = "aws_s3")]
    AwsS3,
    #[serde(rename = "digitalocean_spaces")]
    DigitalOceanSpaces,
    #[serde(rename = "cloudflare_r2")]
    CloudflareR2,
    #[serde(rename = "custom")]
    Custom,
}

impl Provider {
    /// Default endpoint URL for providers that require one, given a region.
    pub fn default_endpoint(&self, region: &str) -> Option<String> {
        match self {
            Provider::DigitalOceanSpaces => {
                Some(format!("https://{region}.digitaloceanspaces.com"))
            }
            Provider::AwsS3 | Provider::CloudflareR2 | Provider::Custom => None,
        }
    }

    /// Resolve the endpoint URL to use for an S3 client, given the user input
    /// and region. Returns `None` when no endpoint should be set explicitly so
    /// the AWS SDK derives it from the region — this is the correct path for
    /// AWS S3 with a blank endpoint field. Never fabricates a `https://{region}`
    /// URL: that is not a valid S3 endpoint and breaks HeadBucket + every
    /// subsequent request.
    pub fn resolve_endpoint(&self, user_endpoint: Option<&str>, region: &str) -> Option<String> {
        user_endpoint
            .map(str::to_string)
            .or_else(|| self.default_endpoint(region))
    }
}

/// A configured connection to an S3-compatible endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointConfig {
    pub id: String,
    pub name: String,
    pub provider: Provider,
    pub region: String,
    pub endpoint_url: Option<String>,
    pub force_path_style: bool,
}

impl EndpointConfig {
    /// Build a DigitalOcean Spaces endpoint with the `nyc3` default region.
    pub fn digital_ocean_defaults(id: impl Into<String>, name: impl Into<String>) -> Self {
        let region = "nyc3".to_string();
        Self {
            id: id.into(),
            name: name.into(),
            provider: Provider::DigitalOceanSpaces,
            endpoint_url: Provider::DigitalOceanSpaces.default_endpoint(&region),
            region,
            force_path_style: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_enum_serializes_snake_case() {
        let cases = [
            (Provider::AwsS3, "\"aws_s3\""),
            (Provider::DigitalOceanSpaces, "\"digitalocean_spaces\""),
            (Provider::CloudflareR2, "\"cloudflare_r2\""),
            (Provider::Custom, "\"custom\""),
        ];
        for (provider, expected) in cases {
            let json = serde_json::to_string(&provider).unwrap();
            assert_eq!(json, expected);
            let back: Provider = serde_json::from_str(&json).unwrap();
            assert_eq!(back, provider);
        }
    }

    #[test]
    fn digital_ocean_default_uses_nyc3_endpoint() {
        let cfg = EndpointConfig::digital_ocean_defaults("do-default", "DigitalOcean Spaces");
        assert_eq!(cfg.region, "nyc3");
        assert_eq!(
            cfg.endpoint_url.as_deref(),
            Some("https://nyc3.digitaloceanspaces.com")
        );
        assert!(!cfg.force_path_style);
    }

    #[test]
    fn aws_has_no_custom_endpoint() {
        assert!(Provider::AwsS3.default_endpoint("us-east-1").is_none());
    }

    #[test]
    fn aws_s3_blank_endpoint_resolves_to_none() {
        // Regression: a blank endpoint field for AWS S3 must produce `None`
        // so the AWS SDK derives the regional endpoint itself. Previously the
        // code fabricated `https://us-east-1`, which is not a valid S3
        // endpoint and caused HeadBucket to fail unless the user typed an
        // explicit URL like `https://s3.amazonaws.com`.
        assert_eq!(Provider::AwsS3.resolve_endpoint(None, "us-east-1"), None);
        assert_eq!(Provider::AwsS3.resolve_endpoint(None, "eu-west-1"), None);
    }

    #[test]
    fn aws_s3_explicit_endpoint_is_preserved() {
        assert_eq!(
            Provider::AwsS3.resolve_endpoint(Some("https://s3.amazonaws.com"), "us-east-1"),
            Some("https://s3.amazonaws.com".to_string())
        );
    }

    #[test]
    fn custom_blank_endpoint_resolves_to_none() {
        assert_eq!(Provider::Custom.resolve_endpoint(None, "us-east-1"), None);
    }

    #[test]
    fn digitalocean_blank_endpoint_uses_provider_default() {
        assert_eq!(
            Provider::DigitalOceanSpaces.resolve_endpoint(None, "nyc3"),
            Some("https://nyc3.digitaloceanspaces.com".to_string())
        );
    }

    #[test]
    fn digitalocean_explicit_endpoint_overrides_default() {
        assert_eq!(
            Provider::DigitalOceanSpaces
                .resolve_endpoint(Some("https://custom.example.com"), "nyc3"),
            Some("https://custom.example.com".to_string())
        );
    }
}
