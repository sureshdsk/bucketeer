use keyring::Entry;
use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// Service name used for every keyring entry this app owns.
pub const SERVICE: &str = "bucketeer";

/// A credential pair stored under `keyring::Entry` for a provider.
/// Serialized as JSON so future fields (e.g. session tokens) can be added
/// without breaking existing entries.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredCredentials {
    pub access_key: String,
    pub secret_key: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_token: Option<String>,
}

fn entry(provider_id: &str) -> Result<Entry, AppError> {
    Entry::new(SERVICE, provider_id)
        .map_err(|err| AppError::Internal(format!("keyring entry failed: {err}")))
}

/// Persist a credential pair for `provider_id` in the OS keyring.
pub fn set_credentials(provider_id: &str, creds: &StoredCredentials) -> Result<(), AppError> {
    let entry = entry(provider_id)?;
    let payload = serde_json::to_string(creds)
        .map_err(|err| AppError::Internal(format!("serialize credentials: {err}")))?;
    entry
        .set_password(&payload)
        .map_err(|err| AppError::Internal(format!("keyring set failed: {err}")))
}

/// Read a credential pair back. Returns `None` when no entry exists (which is
/// normal for profiles that haven't been saved to the keyring yet).
pub fn get_credentials(provider_id: &str) -> Result<Option<StoredCredentials>, AppError> {
    let entry = entry(provider_id)?;
    match entry.get_password() {
        Ok(payload) => {
            let creds: StoredCredentials = serde_json::from_str(&payload).map_err(|err| {
                AppError::Internal(format!("deserialize keyring credentials: {err}"))
            })?;
            Ok(Some(creds))
        }
        Err(err) => {
            if matches!(err, keyring::Error::NoEntry) {
                Ok(None)
            } else {
                Err(AppError::Internal(format!("keyring get failed: {err}")))
            }
        }
    }
}

/// Delete any stored credentials for `provider_id`. Missing entries are
/// treated as success so UIs can call this idempotently.
pub fn delete_credentials(provider_id: &str) -> Result<(), AppError> {
    let entry = entry(provider_id)?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(AppError::Internal(format!("keyring delete failed: {err}"))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // The macOS Keychain / libsecret / Windows Credential Manager backing store
    // is required for every test here. Headless CI (notably ubuntu runners) has
    // no `org.freedesktop.secrets` service, so these tests must opt in via
    // `BUCKETEER_RUN_KEYRING_TESTS=1` to avoid spurious failures.
    fn keyring_backend_enabled() -> bool {
        match std::env::var_os("BUCKETEER_RUN_KEYRING_TESTS") {
            None => {
                eprintln!("skipping keyring test (set BUCKETEER_RUN_KEYRING_TESTS=1 to enable)");
                false
            }
            Some(_) => true,
        }
    }

    #[test]
    fn missing_entry_is_none() {
        if !keyring_backend_enabled() {
            return;
        }
        let unique = format!("bucketeer-test-missing-{}", uuid::Uuid::new_v4().simple());
        let creds = get_credentials(&unique).expect("no panic on missing entry");
        assert!(creds.is_none());
    }

    #[test]
    fn delete_missing_is_ok() {
        if !keyring_backend_enabled() {
            return;
        }
        let unique = format!("bucketeer-test-delete-{}", uuid::Uuid::new_v4().simple());
        delete_credentials(&unique).expect("delete missing entry is not an error");
    }

    #[test]
    fn credentials_round_trip_on_real_backend() {
        if !keyring_backend_enabled() {
            return;
        }
        let id = format!("bucketeer-test-roundtrip-{}", uuid::Uuid::new_v4().simple());
        let stored = StoredCredentials {
            access_key: "AKIATEST".into(),
            secret_key: "secret".into(),
            session_token: None,
        };
        set_credentials(&id, &stored).expect("set");
        let fetched = get_credentials(&id).expect("get").expect("entry present");
        assert_eq!(fetched.access_key, "AKIATEST");
        assert_eq!(fetched.secret_key, "secret");
        delete_credentials(&id).expect("delete");
        assert!(get_credentials(&id).unwrap().is_none());
    }
}
