use aws_config::BehaviorVersion;
use aws_credential_types::Credentials;
use aws_sdk_s3::config::Region;
use aws_sdk_s3::Client;

use crate::error::AppError;
use crate::models::Bucket;
use crate::provider::Provider;

/// Build an `aws_sdk_s3::Client` from a saved bucket. Every provider (including
/// AWS S3) uses static credentials from the OS keyring (or the
/// `BUCKETEER_*` env fallback) with an explicit endpoint resolved from the
/// saved bucket.
pub async fn build_client(bucket: &Bucket) -> Result<Client, AppError> {
    let region = bucket
        .region
        .clone()
        .unwrap_or_else(|| "us-east-1".to_string());
    // Use the user-provided endpoint if any; otherwise fall back to the
    // provider's default (e.g. DigitalOcean). For AWS S3 and Custom we leave
    // endpoint as `None` so the AWS SDK resolves the regional endpoint itself
    // — fabricating a `https://{region}` URL here would break HeadBucket and
    // every subsequent request.
    let endpoint = bucket
        .provider
        .resolve_endpoint(bucket.endpoint_url.as_deref(), &region);

    let force_path_style = matches!(bucket.provider, Provider::CloudflareR2);
    let (access_key, secret_key, session_token) = read_static_credentials(&bucket.id)?;
    build_endpoint_client_from_parts(
        bucket.provider,
        &region,
        endpoint.as_deref(),
        &access_key,
        &secret_key,
        session_token.as_deref(),
        force_path_style,
    )
    .await
}

/// Build an S3 client directly from connection parts — used by the
/// `verify_bucket` IPC to HeadBucket a target *before* anything is persisted.
pub async fn build_endpoint_client_from_parts(
    provider: Provider,
    region: &str,
    endpoint_url: Option<&str>,
    access_key: &str,
    secret_key: &str,
    session_token: Option<&str>,
    force_path_style: bool,
) -> Result<Client, AppError> {
    // Resolve endpoint: explicit > provider default > None (let the AWS SDK
    // derive it from the region). Never fabricate a `https://{region}` URL —
    // that's not a valid S3 endpoint and breaks AWS S3 + Custom connections
    // when the user leaves the field blank.
    let endpoint = provider.resolve_endpoint(endpoint_url, region);
    let credentials = match session_token {
        Some(token) => Credentials::new(
            access_key.to_string(),
            secret_key.to_string(),
            Some(token.to_string()),
            None,
            "bucketeer",
        ),
        None => Credentials::new(
            access_key.to_string(),
            secret_key.to_string(),
            None,
            None,
            "bucketeer",
        ),
    };
    let mut builder = aws_sdk_s3::Config::builder()
        .behavior_version(BehaviorVersion::latest())
        .region(Region::new(region.to_string()))
        .credentials_provider(credentials);
    if let Some(url) = endpoint {
        builder = builder.endpoint_url(url);
    }
    let config = builder.force_path_style(force_path_style).build();
    Ok(Client::from_conf(config))
}

/// Resolve static credentials for a saved bucket. The keyring is preferred;
/// otherwise we fall back to `BUCKETEER_ACCESS_KEY[_<ID>]` env vars (useful
/// for headless tests).
///
/// `bucket_id` may carry a `toml:` namespace prefix (added by `load_buckets`),
/// but credentials are stored under the raw id, so strip it before lookup.
fn read_static_credentials(bucket_id: &str) -> Result<(String, String, Option<String>), AppError> {
    let key = bucket_id.strip_prefix("toml:").unwrap_or(bucket_id);
    if let Ok(Some(stored)) = crate::secrets::get_credentials(key) {
        return Ok((stored.access_key, stored.secret_key, stored.session_token));
    }

    let suffix = key.to_ascii_uppercase().replace('-', "_");
    let access_key = std::env::var(format!("BUCKETEER_ACCESS_KEY_{suffix}"))
        .or_else(|_| std::env::var("BUCKETEER_ACCESS_KEY"))
        .map_err(|_| {
            AppError::Provider(format!(
                "no access key for bucket '{key}'; add it via the in-app bucket \
                 form or set BUCKETEER_ACCESS_KEY"
            ))
        })?;
    let secret_key = std::env::var(format!("BUCKETEER_SECRET_ACCESS_KEY_{suffix}"))
        .or_else(|_| std::env::var("BUCKETEER_SECRET_ACCESS_KEY"))
        .map_err(|_| {
            AppError::Provider(format!(
                "no secret key for bucket '{key}'; add it via the in-app bucket \
                 form or set BUCKETEER_SECRET_ACCESS_KEY"
            ))
        })?;
    Ok((access_key, secret_key, None))
}

/// Map any S3/SDK error onto the IPC `AppError`. Classification uses the SDK
/// error **code** first (e.g. "AccessDenied") via `ProvideErrorMetadata`, then
/// falls back to message/display text matching for unhandled cases.
pub fn map_sdk_error<E>(err: E) -> AppError
where
    E: aws_smithy_types::error::metadata::ProvideErrorMetadata + std::fmt::Display,
{
    let code = err.code().unwrap_or("").to_string();
    let message = err
        .message()
        .map(str::to_string)
        .unwrap_or_else(|| err.to_string());
    classify_sdk_error(&code, &message)
}

fn classify_sdk_error(code: &str, message: &str) -> AppError {
    let lower_code = code.to_ascii_lowercase();
    let lower_msg = message.to_ascii_lowercase();
    if matches!(lower_code.as_str(), "accessdenied" | "forbidden")
        || lower_msg.contains("access denied")
        || lower_msg.contains("forbidden")
    {
        AppError::AccessDenied(message.to_string())
    } else if matches!(
        lower_code.as_str(),
        "nosuchbucket" | "nosuchkey" | "notfound"
    ) || lower_msg.contains("not found")
    {
        AppError::NotFound(message.to_string())
    } else if code.is_empty() {
        AppError::Provider(message.to_string())
    } else {
        AppError::Provider(format!("{code}: {message}"))
    }
}
