import { invoke as tauriInvoke } from "@tauri-apps/api/core";

import { useNetworkStore } from "@/stores/useNetworkStore";

/** Error codes mirrored from `src-tauri/src/error.rs`. */
export type AppErrorCode =
  | "AccessDenied"
  | "NotFound"
  | "Network"
  | "Provider"
  | "Internal";

/** Serialized form of `AppError` from the Rust side. */
export interface AppError {
  code: AppErrorCode;
  message: string;
}

function errorToString(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

/**
 * Typed wrapper over Tauri's `invoke`. A rejected command arrives as the
 * serialized `AppError` object. Tauri v2 maps camelCase argument keys to the
 * snake_case Rust parameter names automatically. Every call is reported to the
 * network store so the global progress indicator can render above the window.
 */
export async function invoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const opId = useNetworkStore.getState().begin(command);
  try {
    const result = await tauriInvoke<T>(command, args);
    useNetworkStore.getState().complete(opId);
    return result;
  } catch (err) {
    useNetworkStore.getState().error(opId, errorToString(err));
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Saved-bucket / remote-bucket types — mirror src-tauri/src/{provider,models}.rs
// ---------------------------------------------------------------------------

export type ProviderKind =
  | "aws_s3"
  | "digitalocean_spaces"
  | "cloudflare_r2"
  | "custom";

export type BucketSource = "buckets_toml" | "keyring";

/**
 * A saved bucket — a connection to an S3-compatible endpoint, optionally
 * pinned to a specific `bucket`/`prefix` so it opens directly.
 */
export interface Bucket {
  id: string;
  name: string;
  provider: ProviderKind;
  region: string | null;
  source: BucketSource;
  has_credentials: boolean;
  endpoint_url: string | null;
  /** When set, this saved bucket opens directly to `bucket`/`prefix`. */
  bucket: string | null;
  prefix: string | null;
}

/** A bucket discovered on the remote account via `ListAllMyBuckets`. */
export interface RemoteBucket {
  name: string;
  creation_date: number | null;
}

/** A pinned saved location (`~/.bucketeer/locations.toml`). snake_case fields
 * match the serialized Rust struct; IPC args use camelCase via Tauri. */
export interface StoredLocation {
  id: string;
  label: string;
  provider_id: string;
  bucket: string;
  prefix: string;
  color: string | null;
  created_at: number;
}

export interface ObjectMeta {
  key: string;
  size: number;
  etag: string | null;
  last_modified: number | null;
  storage_class: string | null;
  is_dir: boolean;
}

export interface ListPage {
  items: ObjectMeta[];
  next_cursor: string | null;
  total: number;
}

export interface ObjectDetails {
  key: string;
  size: number;
  etag: string | null;
  last_modified: number | null;
  storage_class: string | null;
  content_type: string | null;
  server_side_encryption: string | null;
  version_id: string | null;
  cache_control: string | null;
}

// ---------------------------------------------------------------------------
// Transfer types — mirror src-tauri/src/transfers.rs
// ---------------------------------------------------------------------------

export type TransferKind = "upload" | "download";
export type TransferPhase =
  | "queued"
  | "starting"
  | "active"
  | "completed"
  | "failed"
  | "cancelled";

export interface TransferProgress {
  id: string;
  kind: TransferKind;
  phase: TransferPhase;
  key: string;
  bytes: number;
  total: number;
  progress: number;
  error: string | null;
}

export const TRANSFER_CHANNEL = "transfer://progress";

// ---------------------------------------------------------------------------
// Delete outcome — mirror src-tauri/src/delete.rs
// ---------------------------------------------------------------------------

export interface DeleteError {
  key: string;
  code: string;
  message: string;
}

export interface DeleteOutcome {
  deleted: string[];
  errors: DeleteError[];
  used_fallback: boolean;
}

// ---------------------------------------------------------------------------
// Editor / versioning — mirror src-tauri/src/editor.rs
// ---------------------------------------------------------------------------

export interface EditorFetch {
  key: string;
  /** Raw bytes; usually decoded into UTF-8 on the JS side. */
  bytes: number[];
  version_id: string | null;
  content_type: string | null;
  etag: string | null;
  last_modified: number | null;
  versioned: boolean;
}

export interface EditorSaveResult {
  key: string;
  version_id: string | null;
  etag: string | null;
}

export interface ObjectVersion {
  version_id: string;
  etag: string | null;
  last_modified: number | null;
  size: number;
  is_latest: boolean;
  storage_class: string | null;
}

export interface VersionList {
  versioned: boolean;
  versions: ObjectVersion[];
}

export interface RestoreResult {
  version_id: string | null;
  etag: string | null;
}

// ---------------------------------------------------------------------------
// Inspect — mirror src-tauri/src/inspect.rs
// ---------------------------------------------------------------------------

export type CompressionKind = "gzip" | "zstd" | "none";

export interface InspectResult {
  key: string;
  kind: CompressionKind;
  bytes: number[];
  truncated: boolean;
  original_size: number;
}

// ---------------------------------------------------------------------------
// Deep search — mirror src-tauri/src/search.rs
// ---------------------------------------------------------------------------

export interface SearchHit {
  key: string;
  size: number;
  last_modified: number | null;
  storage_class: string | null;
}

export interface SearchEnvelope {
  query: string;
  bucket: string;
  prefix: string;
  hit: SearchHit | null;
  done: boolean;
  matches: number;
}

export const SEARCH_CHANNEL = "search://result";

// ---------------------------------------------------------------------------
// Commands — Phase 1
// ---------------------------------------------------------------------------

export function ping(): Promise<string> {
  return invoke<string>("ping");
}

export function listBuckets(): Promise<Bucket[]> {
  return invoke<Bucket[]>("list_buckets");
}

export function listRemoteBuckets(bucketId: string): Promise<RemoteBucket[]> {
  return invoke<RemoteBucket[]>("list_remote_buckets", { bucketId });
}

export interface ListObjectsArgs {
  bucketId: string;
  bucket: string;
  prefix: string;
  cursor?: string | null;
  pageSize?: number;
}

export function listObjects(args: ListObjectsArgs): Promise<ListPage> {
  return invoke<ListPage>("list_objects", {
    bucketId: args.bucketId,
    bucket: args.bucket,
    prefix: args.prefix,
    cursor: args.cursor ?? null,
    pageSize: args.pageSize ?? 200,
  });
}

export interface ObjectRef {
  bucketId: string;
  bucket: string;
  key: string;
}

export function headObject(ref: ObjectRef): Promise<ObjectDetails> {
  return invoke<ObjectDetails>("head_object", {
    bucketId: ref.bucketId,
    bucket: ref.bucket,
    key: ref.key,
  });
}

export function presignGet(
  ref: ObjectRef,
  ttlSecs = 900,
): Promise<string> {
  return invoke<string>("presign_get", {
    bucketId: ref.bucketId,
    bucket: ref.bucket,
    key: ref.key,
    ttlSecs,
  });
}

/** Hover prefetch (P3.3) — warms the in-memory tree for a bucket. */
export function prefetchPrefix(
  bucketId: string,
  bucket: string,
): Promise<void> {
  return invoke<void>("prefetch_prefix", { bucketId, bucket });
}

// ---------------------------------------------------------------------------
// Commands — Phase 2: providers + transfers + deletes
// ---------------------------------------------------------------------------

export interface SaveBucketArgs {
  id: string;
  name: string;
  provider: ProviderKind;
  region: string;
  endpointUrl: string | null;
  forcePathStyle?: boolean;
  accessKey: string;
  secretKey: string;
  sessionToken?: string | null;
  bucket?: string | null;
  prefix?: string | null;
}

export function saveBucket(args: SaveBucketArgs): Promise<Bucket[]> {
  return invoke<Bucket[]>("save_bucket", {
    id: args.id,
    name: args.name,
    provider: args.provider,
    region: args.region,
    endpointUrl: args.endpointUrl,
    forcePathStyle: args.forcePathStyle ?? null,
    accessKey: args.accessKey,
    secretKey: args.secretKey,
    sessionToken: args.sessionToken ?? null,
    bucket: args.bucket ?? null,
    prefix: args.prefix ?? null,
  });
}

export interface VerifyBucketArgs {
  provider: ProviderKind;
  region: string;
  endpointUrl: string | null;
  bucket: string;
  accessKey: string;
  secretKey: string;
  sessionToken?: string | null;
  forcePathStyle?: boolean | null;
}

/** HeadBucket a target with the given connection details. Resolves ok only
 * when the bucket is reachable — used to verify before saving a bucket config. */
export function verifyBucket(args: VerifyBucketArgs): Promise<void> {
  return invoke<void>("verify_bucket", {
    provider: args.provider,
    region: args.region,
    endpointUrl: args.endpointUrl,
    bucket: args.bucket,
    accessKey: args.accessKey,
    secretKey: args.secretKey,
    sessionToken: args.sessionToken ?? null,
    forcePathStyle: args.forcePathStyle ?? null,
  });
}

export function deleteBucket(id: string): Promise<Bucket[]> {
  return invoke<Bucket[]>("delete_bucket", { id });
}

export interface SaveLocationArgs {
  id: string;
  label: string;
  providerId: string;
  bucket: string;
  prefix?: string;
  color?: string | null;
  createdAt?: number;
}

export function listLocations(): Promise<StoredLocation[]> {
  return invoke<StoredLocation[]>("list_locations");
}

export function saveLocation(args: SaveLocationArgs): Promise<StoredLocation[]> {
  return invoke<StoredLocation[]>("save_location", {
    id: args.id,
    label: args.label,
    providerId: args.providerId,
    bucket: args.bucket,
    prefix: args.prefix ?? "",
    color: args.color ?? null,
    createdAt: args.createdAt ?? 0,
  });
}

export function deleteLocation(id: string): Promise<StoredLocation[]> {
  return invoke<StoredLocation[]>("delete_location", { id });
}

export function reorderLocations(ids: string[]): Promise<StoredLocation[]> {
  return invoke<StoredLocation[]>("reorder_locations", { ids });
}

export interface UploadArgs {
  bucketId: string;
  bucket: string;
  key: string;
  localPath: string;
}

export function enqueueUpload(args: UploadArgs): Promise<string> {
  return invoke<string>("enqueue_upload", {
    bucketId: args.bucketId,
    bucket: args.bucket,
    key: args.key,
    localPath: args.localPath,
  });
}

export interface FolderUploadArgs {
  bucketId: string;
  bucket: string;
  prefix: string;
  localPath: string;
}

export function enqueueFolderUpload(args: FolderUploadArgs): Promise<string[]> {
  return invoke<string[]>("enqueue_folder_upload", {
    bucketId: args.bucketId,
    bucket: args.bucket,
    prefix: args.prefix,
    localPath: args.localPath,
  });
}

export interface DownloadArgs {
  bucketId: string;
  bucket: string;
  key: string;
  targetDir?: string | null;
}

export function enqueueDownload(args: DownloadArgs): Promise<string> {
  return invoke<string>("enqueue_download", {
    bucketId: args.bucketId,
    bucket: args.bucket,
    key: args.key,
    targetDir: args.targetDir ?? null,
  });
}

export function cancelTransfer(id: string, kind: TransferKind): Promise<void> {
  return invoke<void>("cancel_transfer", { id, kind });
}

export interface DeleteArgs {
  bucketId: string;
  bucket: string;
  keys: string[];
  recursive?: boolean;
}

export function deleteObjects(args: DeleteArgs): Promise<DeleteOutcome> {
  return invoke<DeleteOutcome>("delete_objects", {
    bucketId: args.bucketId,
    bucket: args.bucket,
    keys: args.keys,
    recursive: args.recursive ?? false,
  });
}

// ---------------------------------------------------------------------------
// Commands — Phase 4: editor + inspect + versions
// ---------------------------------------------------------------------------

export interface EditorFetchArgs {
  bucketId: string;
  bucket: string;
  key: string;
  maxBytes?: number;
}

export function fetchForEdit(args: EditorFetchArgs): Promise<EditorFetch> {
  return invoke<EditorFetch>("fetch_for_edit", {
    bucketId: args.bucketId,
    bucket: args.bucket,
    key: args.key,
    maxBytes: args.maxBytes ?? null,
  });
}

export interface EditorSaveArgs {
  bucketId: string;
  bucket: string;
  key: string;
  bytes: number[];
  contentType?: string | null;
}

export function saveEdit(args: EditorSaveArgs): Promise<EditorSaveResult> {
  return invoke<EditorSaveResult>("save_edit", {
    bucketId: args.bucketId,
    bucket: args.bucket,
    key: args.key,
    bytes: args.bytes,
    contentType: args.contentType ?? null,
  });
}

export function listVersions(ref: ObjectRef): Promise<VersionList> {
  return invoke<VersionList>("list_versions", {
    bucketId: ref.bucketId,
    bucket: ref.bucket,
    key: ref.key,
  });
}

export function restoreVersion(
  ref: ObjectRef,
  versionId: string,
): Promise<RestoreResult> {
  return invoke<RestoreResult>("restore_version", {
    bucketId: ref.bucketId,
    bucket: ref.bucket,
    key: ref.key,
    versionId,
  });
}

export interface InspectArgs {
  bucketId: string;
  bucket: string;
  key: string;
  capBytes?: number;
  outputCap?: number;
}

export function inspectCompressed(args: InspectArgs): Promise<InspectResult> {
  return invoke<InspectResult>("inspect_compressed", {
    bucketId: args.bucketId,
    bucket: args.bucket,
    key: args.key,
    capBytes: args.capBytes ?? null,
    outputCap: args.outputCap ?? null,
  });
}

// ---------------------------------------------------------------------------
// Commands — Phase 3: deep search
// ---------------------------------------------------------------------------

export interface DeepSearchArgs {
  bucketId: string;
  bucket: string;
  prefix: string;
  query: string;
}

export function deepSearch(args: DeepSearchArgs): Promise<number> {
  return invoke<number>("deep_search", {
    bucketId: args.bucketId,
    bucket: args.bucket,
    prefix: args.prefix,
    query: args.query,
  });
}

export function cancelSearch(): Promise<void> {
  return invoke<void>("cancel_search");
}

// ---------------------------------------------------------------------------
// Commands — Phase 5: settings, telemetry, diagnostics, cache
// ---------------------------------------------------------------------------

export type Consent = "undecided" | "accepted" | "declined";

export interface AppInfo {
  version: string;
  os: string;
  arch: string;
}

export interface AppPaths {
  config: string | null;
  logs: string | null;
  cache: string | null;
}

export interface AppSettings {
  telemetry_consent: Consent;
  telemetry_first_asked: number | null;
  telemetry_decided_at: number | null;
  updater_enabled: boolean;
  last_launched_version: string | null;
}

export function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("get_app_info");
}

export function getAppPaths(): Promise<AppPaths> {
  return invoke<AppPaths>("get_app_paths");
}

export function getAppSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_app_settings");
}

export function setTelemetryConsent(
  consent: Consent,
): Promise<AppSettings> {
  return invoke<AppSettings>("set_telemetry_consent", { consent });
}

export function recordEvent(kind: string, name: string): Promise<void> {
  return invoke<void>("record_event", { kind, name });
}

export function clearCache(): Promise<void> {
  return invoke<void>("clear_cache");
}

export function exportDiagnostics(): Promise<string> {
  return invoke<string>("export_diagnostics");
}
