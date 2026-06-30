mod buckets_toml;
mod clients;
mod delete;
mod diagnostics;
mod downloads;
mod editor;
mod error;
mod inspect;
mod ipc;
mod locations;
mod models;
mod s3ops;
mod search;
mod secrets;
mod settings;
mod state;
mod telemetry;
mod transfers;
mod uploads;

pub mod provider;

use downloads::DownloadRegistry;
use state::AppState;
use uploads::UploadRegistry;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("bucketeer=debug,info")),
        )
        .try_init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(AppState::default())
        .manage(UploadRegistry::default())
        .manage(DownloadRegistry::default())
        .invoke_handler(tauri::generate_handler![
            ipc::ping,
            ipc::list_buckets,
            ipc::list_remote_buckets,
            ipc::list_objects,
            ipc::head_object,
            ipc::presign_get,
            ipc::prefetch_prefix,
            ipc::save_bucket,
            ipc::verify_bucket,
            ipc::delete_bucket,
            ipc::list_locations,
            ipc::save_location,
            ipc::delete_location,
            ipc::reorder_locations,
            ipc::enqueue_upload,
            ipc::enqueue_folder_upload,
            ipc::cancel_transfer,
            ipc::enqueue_download,
            ipc::delete_objects,
            ipc::fetch_for_edit,
            ipc::save_edit,
            ipc::list_versions,
            ipc::restore_version,
            ipc::inspect_compressed,
            ipc::deep_search,
            ipc::cancel_search,
            ipc::get_app_info,
            ipc::get_app_paths,
            ipc::get_app_settings,
            ipc::set_telemetry_consent,
            ipc::record_event,
            ipc::clear_cache,
            ipc::export_diagnostics,
        ])
        .run(tauri::generate_context!())
        .expect("error while running bucketeer");
}
