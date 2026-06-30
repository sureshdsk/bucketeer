use std::io::Read;

use serde::Serialize;
use tauri::State;

use crate::clients::map_sdk_error;
use crate::error::AppError;
use crate::s3ops;
use crate::state::AppState;

/// Supported decompression codecs.
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CompressionKind {
    Gzip,
    Zstd,
    None,
}

#[derive(Debug, Serialize)]
pub struct InspectResult {
    pub key: String,
    pub kind: CompressionKind,
    pub bytes: Vec<u8>,
    pub truncated: bool,
    pub original_size: u64,
}

/// Inspect a compressed object without buffering the entire payload. We fetch
/// the first `cap_bytes` of the source via a range request, decompress it
/// in-memory, and return up to `output_cap` decoded bytes. Anything beyond
/// `output_cap` is truncated (the UI shows a banner).
pub async fn inspect_compressed(
    state: &State<'_, AppState>,
    bucket_id: &str,
    bucket: &str,
    key: &str,
    cap_bytes: u64,
    output_cap: usize,
) -> Result<InspectResult, AppError> {
    let client = s3ops::get_client(state, bucket_id).await?;
    let kind = detect_kind(key);
    if matches!(kind, CompressionKind::None) {
        return Err(AppError::Provider(
            "object does not look like a .gz/.zst file".into(),
        ));
    }

    let end = cap_bytes.saturating_sub(1);
    let range = format!("bytes=0-{end}");
    let resp = client
        .get_object()
        .bucket(bucket)
        .key(key)
        .range(range)
        .send()
        .await
        .map_err(map_sdk_error)?;

    let original_size = resp.content_length().unwrap_or(0) as u64;
    let body = resp
        .body
        .collect()
        .await
        .map_err(|e| AppError::Provider(format!("read body: {e}")))?
        .into_bytes()
        .to_vec();

    let (decoded, truncated) = match kind {
        CompressionKind::Gzip => decode_gzip(&body, output_cap)?,
        CompressionKind::Zstd => decode_zstd(&body, output_cap)?,
        CompressionKind::None => (body, false),
    };

    Ok(InspectResult {
        key: key.to_string(),
        kind,
        bytes: decoded,
        truncated,
        original_size,
    })
}

/// Detect compression from the key extension.
pub fn detect_kind(key: &str) -> CompressionKind {
    let lower = key.to_ascii_lowercase();
    if lower.ends_with(".gz") || lower.ends_with(".gzip") || lower.ends_with(".tgz") {
        CompressionKind::Gzip
    } else if lower.ends_with(".zst") || lower.ends_with(".zstd") {
        CompressionKind::Zstd
    } else {
        CompressionKind::None
    }
}

fn decode_gzip(input: &[u8], cap: usize) -> Result<(Vec<u8>, bool), AppError> {
    let mut decoder = flate2::read::GzDecoder::new(input);
    let mut out: Vec<u8> = Vec::with_capacity(cap.min(64 * 1024));
    let mut limited = (&mut decoder).take(cap as u64);
    limited
        .read_to_end(&mut out)
        .map_err(|e| AppError::Provider(format!("gzip decode: {e}")))?;
    let mut probe = [0u8; 1];
    let truncated = decoder.read(&mut probe).map(|n| n > 0).unwrap_or(false);
    Ok((out, truncated))
}

fn decode_zstd(input: &[u8], cap: usize) -> Result<(Vec<u8>, bool), AppError> {
    let mut decoder =
        zstd::Decoder::new(input).map_err(|e| AppError::Provider(format!("zstd init: {e}")))?;
    let mut out: Vec<u8> = Vec::with_capacity(cap.min(64 * 1024));
    let mut limited = (&mut decoder).take(cap as u64);
    limited
        .read_to_end(&mut out)
        .map_err(|e| AppError::Provider(format!("zstd decode: {e}")))?;
    let mut probe = [0u8; 1];
    let truncated = decoder.read(&mut probe).map(|n| n > 0).unwrap_or(false);
    Ok((out, truncated))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_extensions() {
        assert_eq!(detect_kind("log.gz"), CompressionKind::Gzip);
        assert_eq!(detect_kind("archive.TGZ"), CompressionKind::Gzip);
        assert_eq!(detect_kind("trace.zst"), CompressionKind::Zstd);
        assert_eq!(detect_kind("config.yaml"), CompressionKind::None);
    }

    #[test]
    fn gzip_round_trips_under_cap() {
        let mut deflate = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
        use std::io::Write;
        deflate.write_all(b"hello world").unwrap();
        let compressed = deflate.finish().unwrap();
        let (out, truncated) = decode_gzip(&compressed, 1024).unwrap();
        assert_eq!(out, b"hello world");
        assert!(!truncated);
    }

    #[test]
    fn gzip_truncates_when_over_cap() {
        let mut deflate = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
        use std::io::Write;
        deflate
            .write_all(b"hello world this is longer than five bytes")
            .unwrap();
        let compressed = deflate.finish().unwrap();
        let (out, truncated) = decode_gzip(&compressed, 5).unwrap();
        assert_eq!(out, b"hello");
        assert!(truncated);
    }
}
