# Implementation Plan — Bucketeer

A next-generation Rust S3 browser. Source-of-truth references:
- Features & requirements: [`docs/feature.md`](./feature.md)
- Design system & tokens: [`docs/DESIGN.md`](./DESIGN.md)
- Mock UI screens: `docs/stitch_secure_s3_desktop_explorer/*/code.html`

---

## Locked decisions

| Area | Decision | Impact |
|---|---|---|
| Desktop shell | **Tauri v2** + **`aws-sdk-s3`** | Stable IPC, mobile-ready, official SDK w/ multipart + presigning. |
| Frontend | **React 18 + Vite + TypeScript** + **shadcn/ui** | Best ecosystem fit (Monaco, TanStack Virtual, dnd-kit, cmdk). |
| Styling | **Tailwind v3** · Material-3 dark tokens from `DESIGN.md` | Hex tokens ported to shadcn HSL CSS vars. |
| Package manager | **Bun** | `bun create vite`, `bun add`, `bunx shadcn`, `bun run`. Tauri `beforeDevCommand: bun run dev`. |
| State | **Zustand + immer** | One store per concern, fine-grained selectors. |
| Repo | **Single repo** | Root `package.json` + `src-tauri/Cargo.toml` + `src/` + `docs/`. |
| Providers (MVP) | **AWS S3 + DigitalOcean Spaces** | Provider model from Phase 0; DO default region `nyc3` (configurable). |
| Brand | **"Bucketeer"** | Sidebar wordmark + window title. |
| Identity Center (SSO) | **Deferred** (post-MVP) | Hardest auth path; revisit as Phase 6. |

**Architectural invariant** (`feature.md:25`): heavy I/O on Rust threads; only **paginated metadata** crosses the IPC bridge. No binary blobs ever marshaled to JS.

> **Note on bulk-delete fallback** (`feature.md:5`): DO Spaces *supports* `DeleteObjects`, so it will **not** exercise the fallback path organically. The fallback is covered by a dedicated mock-client unit test; an optional R2/MinIO smoke test validates it against a real provider later.

---

## Cross-cutting foundations (apply in every phase)

- **Token translation**: port the mock's inline `tailwind.config` (hex Material-3) to `tailwind.config.ts` + shadcn HSL CSS vars in `src/styles/tokens.css` (e.g. `--primary` ← `#adc6ff`). Two font families: **Inter** (UI) + **JetBrains Mono** (`font-data-mono`) for all keys/ARNs/ETags (`DESIGN.md:112-115`).
- **Icon strategy**: standardize on **`lucide-react`** (shadcn default) instead of Material Symbols. Map mock glyphs → lucide in `src/lib/icons.ts`.
- **3-column shell** (`DESIGN.md:119-122`): fixed `260px` sidebar / fluid main / `400px` right drawer. Build once in `AppLayout.tsx`; `64px` collapsed + no-sidebar variants come later.
- **IPC contract**: every command returns `{ data, error }` envelope; progress via Tauri events. TS types in `src/lib/ipc/bindings.ts` (hand-maintained until `ts-rs`).

---

## Repository layout

```
bucketeer/
├── package.json                  # bun, vite, react, tailwind, shadcn deps
├── bun.lockb
├── tailwind.config.ts            # tokens ported from docs/DESIGN.md
├── vite.config.ts
├── tsconfig.json
├── index.html
├── docs/                         # feature.md, DESIGN.md, PLAN.md, stitch_secure_s3_desktop_explorer/
├── src/
│   ├── styles/tokens.css         # shadcn HSL vars ← Material-3 hex
│   ├── lib/
│   │   ├── ipc/bindings.ts       # hand-maintained until ts-rs
│   │   ├── icons.ts              # Material-glyph → lucide-react map
│   │   └── utils.ts              # cn(), formatters (bytes, etag)
│   ├── stores/                   # zustand stores
│   ├── components/ui/            # shadcn primitives
│   ├── components/layout/        # AppLayout, SideNav, TopAppBar, Drawer
│   ├── features/explorer/        # Breadcrumb, ObjectTable, MetadataDrawer
│   ├── features/profiles/        # ProfilePicker
│   └── App.tsx, main.tsx
└── src-tauri/
    ├── Cargo.toml                # aws-sdk-s3, aws-config, keyring, tokio, ...
    ├── tauri.conf.json           # v2
    ├── build.rs
    └── src/
        ├── main.rs               # tauri::Builder, command registration
        ├── state.rs              # AppState (trees, clients)
        ├── ipc/                  # command fns (profiles, buckets, objects, ...)
        ├── profiles/             # ~/.aws parsing
        ├── clients/              # S3 client factory (provider-aware)
        ├── tree/                 # PrefixTree
        ├── objects.rs buckets.rs presign.rs
        └── error.rs              # AppError → { data, error } envelope
```

---

## Zustand store shape (defined Phase 1, extended each phase)

```
useProfileStore    → { profiles[], active, refresh(), select() }
useExplorerStore   → { tree: PrefixTreeSlice, currentPath, status, paginate(), navigate(prefix), invalidate(node) }   // immer
useTransferStore   → { uploads[], downloads[], enqueue(), progress }                        // Phase 2
useWorkspaceStore  → { tabs[{profile,bucket,prefix}], activeTab, add(), close() }          // Phase 3
useCommandStore    → { open, query, results }                                              // Phase 3
```

One store per concern; fine-grained selectors to avoid re-rendering the whole table on unrelated updates.

---

## Provider model (Phase 0 design, Phase 1 use)

DO Spaces forces an explicit provider abstraction from day one:

```rust
enum Provider { AwsS3, DigitalOceanSpaces, CloudflareR2, Custom }
struct EndpointConfig { provider, region, endpoint_url, force_path_style }
```

- **AWS S3**: default credential chain, no endpoint override.
- **DO Spaces**: endpoint `https://<region>.digitaloceanspaces.com`, virtual-host `<bucket>.<region>.digitaloceanspaces.com`, default region `nyc3` (selectable). Stored in keyring (Phase 2) once the Add-Provider form lands; Phase 1 reads from a temporary `~/.bucketeer/providers.toml`.
- **Detection**: `clients/detect.rs` infers provider from a connected client for sidebar grouping + logos.

---

## Phases at a glance

```
Phase 0 (scaffold) ──► Phase 1 (read) ──► Phase 2 (write)
                                              │
                                              ▼
Phase 5 (ship installer) ◄── Phase 4 (editor/share) ◄── Phase 3 (perf/tabs/⌘K)
```

| Phase | Goal | Est. |
|---|---|---|
| 0 | Scaffolding + design system + Tauri shell | 3–5d |
| 1 (MVP-1) | Read-only browser (AWS + DO Spaces) | 2–3wk |
| 2 (MVP-2) | Transfers & mutations | 2–3wk |
| 3 (MVP-3) | Performance, multi-workspace, command palette | 2wk |
| 4 (MVP-4) | Rich media, editor, sharing | 2wk |
| 5 (MVP-5) | Distribution & DX | 1–2wk |
| **Total (1 eng)** | | **~9–12wk** |

---

# Phase 0 — Scaffolding & design system

Goal: runnable Tauri v2 shell rendering the design system, with CI green.

### P0.1 — Toolchain + repo bootstrap `[I]` ~0.5d
- [ ] Verify `bun`, `rustup` (stable + `tauri-cli`), Xcode CLT, platform build tools.
- [ ] `.gitignore` (Rust `target/`, `node_modules/`, `dist/`, `.env`, `~/.bucketeer` test artifacts).
- [ ] Init git repo, `README.md` stub, `AGENTS.md` (commands: `bun run dev`, `cargo tauri dev`, lint, test).
- **DoD:** `git status` clean; `bun --version` + `cargo --version` documented in README.

### P0.2 — Vite + React + TS frontend scaffold `[F]` ~0.5d · depends P0.1
- [ ] `bun create vite@latest . -- --template react-ts`.
- [ ] `bun add zustand immer lucide-react clsx tailwind-merge class-variance-authority`.
- [ ] `tsconfig.json` path alias `@/* → src/*`; `vite.config.ts` with `@` resolve + Tauri host config (`clearScreen:false`, `server.strictPort`).
- **DoD:** `bun run dev` serves default Vite page at Tauri's expected port.

### P0.3 — Tailwind v3 + shadcn + token port `[F]` ~1d · depends P0.2
- [ ] `bun add -D tailwindcss@3 postcss autoprefixer tailwindcss-animate`.
- [ ] `tailwind.config.ts`: port every color/spacing/radius/font token from `docs/DESIGN.md` front-matter (surface ramp, primary/secondary/tertiary/error families, `sidebar_width 260`, `drawer_width 400`, `padding_*`, `gutter 1`).
- [ ] `src/styles/tokens.css`: convert Material-3 **hex → HSL** shadcn CSS vars (dark only).
- [ ] `bunx shadcn@latest init`; add primitives: `Button Input Badge Switch Tooltip Dialog DropdownMenu ScrollArea Separator Avatar`.
- **DoD:** `<Button>` renders with `--primary #adc6ff` mapping; `font-data-mono` = JetBrains Mono loads.

### P0.4 — Tauri v2 + Rust scaffold + ping IPC `[B]` ~1d · depends P0.2
- [ ] `bunx tauri-apps/cli@latest init` into `src-tauri/`; `tauri.conf.json` v2: window 1440×900 (min 1024×600), title `Bucketeer`, `devUrl`/`frontendDist`, `beforeDevCommand: bun run dev`.
- [ ] `Cargo.toml` deps: `aws-config aws-sdk-s3 aws-sdk-sts aws-credential-types keyring tokio serde serde_json anyhow thiserror tracing tracing-subscriber`.
- [ ] `src/main.rs`: `tauri::Builder`, `manage(AppState::default())`, register `ping() -> "pong"`.
- [ ] Wire `invoke<{ping}>()` from `App.tsx`.
- **DoD:** `cargo tauri dev` boots window showing "pong" from Rust.

### P0.5 — AppLayout 3-column shell `[F]` ~1d · depends P0.3,P0.4
- [ ] `components/layout/AppLayout.tsx`: grid with fixed `260px` left / fluid main / `400px` drawer slot (`DESIGN.md:119-122`).
- [ ] `SideNav.tsx`: brand tile + **"Bucketeer"** wordmark + account label, nav list (Accounts/Favorites/Health/Settings/Admin placeholders), footer user card.
- [ ] `TopAppBar.tsx`: `h-16` sticky, tab nav (Explorer/IAM/Lifecycle/Metrics — only Explorer wired), icon cluster (`terminal notifications account_tree` → lucide), avatar.
- [ ] `Drawer.tsx`: 400px slide-over skeleton (`translate-x-full` toggle), header + close + body slot.
- **DoD:** shell matches mock proportions; tab clicks update active state only.

### P0.6 — Lucide icon map + IPC envelope `[F]` ~0.5d · depends P0.3
- [ ] `lib/icons.ts`: map every Material glyph used in mocks → lucide name (`cloud_queue→Cloud`, `verified_user→ShieldCheck`, `enhanced_encryption→Lock`, `delete→Trash2`, `content_copy→Copy`, etc.).
- [ ] `lib/ipc/bindings.ts`: TS types mirror Rust structs; `invoke<T>()` wrapper returning `{ data, error }` envelope.
- **DoD:** no raw Material Symbols referenced anywhere; one typed `invoke` call compiles.

### P0.7 — Provider model + CI skeleton `[B][I]` ~1d · depends P0.4
- [ ] `src/provider.rs`: `enum Provider { AwsS3, DigitalOceanSpaces, CloudflareR2, Custom }`, `EndpointConfig { provider, region, endpoint_url, force_path_style }`.
- [ ] DO Spaces default: region `nyc3`, endpoint `https://{region}.digitaloceanspaces.com`, virtual-host style.
- [ ] `.github/workflows/ci.yml`: `lint` job (`cargo fmt --check`, `cargo clippy -D warnings`, `bun run lint`, `tsc --noEmit`) + `build` job on ubuntu/macos/windows.
- **DoD:** CI green on a trivial commit; `Provider` enum serializes round-trip.

**Phase 0 DoD:** `cargo tauri dev` shows the branded Bucketeer shell in correct Material-3 colors; CI green; ping works.

---

# Phase 1 (MVP-1) — Read-only browser

Goal: user opens the app, picks a profile, browses S3 read-only. **No mutations.** Covers `feature.md:12` (credential chain), `feature.md:19` (in-memory tree), `feature.md:32` (direct path entry), `feature.md:35` (presigned preview).

### P1.1 — AWS profile parser `[B]` ~1d · depends P0.7
- [ ] `profiles/parser.rs`: read `~/.aws/config` + `~/.aws/credentials` → `Vec<Profile{name, source, region, has_creds}>`.
- [ ] Handle non-credential profiles (`role_arn`, `source-profile`) — record but don't resolve AssumeRole yet.
- **DoD:** unit test parses a sample config with 3 profiles incl. a `role_arn` one.

### P1.2 — S3 client factory (provider-aware) `[B]` ~1d · depends P1.1,P0.7
- [ ] `clients/factory.rs`: from `(Profile, Option<EndpointConfig>)` → `aws_sdk_s3::Client`.
- [ ] AWS path: default credential chain, no endpoint override.
- [ ] DO Spaces path: explicit `Region::Custom` with endpoint + access key/secret (read from env/`providers.toml` for now).
- [ ] Per-profile client cache in `AppState`.
- **DoD:** two clients (one AWS, one DO nyc3) constructed in a unit test with mock creds.

### P1.3 — `providers.toml` loader `[B]` ~0.5d · depends P1.2
- [ ] Parse `~/.bucketeer/providers.toml` → `Vec<EndpointConfig>` (temporary; Phase 2 replaces with keyring).
- [ ] DO Spaces entry: `provider="digitalocean_spaces", region="nyc3"`.
- **DoD:** loader round-trips config; missing file → empty vec, no crash.

### P1.4 — IPC: `list_profiles` + `list_buckets` `[B]` ~1d · depends P1.1,P1.3
- [ ] `list_profiles() → Profile[]` (merges AWS + toml providers).
- [ ] `list_buckets(provider_id) → Bucket[] | AccessDenied`.
- [ ] On `AccessDenied` (no `s3:ListAllMyBuckets`) return typed error so UI falls back to direct-path (`feature.md:32`).
- **DoD:** manual call against real AWS + DO account returns buckets; denied case returns structured error.

### P1.5 — PrefixTree data structure `[B]` ~1.5d · depends P0.4
- [ ] `tree/prefix_tree.rs`: maps flat key namespace → simulated folder hierarchy (`feature.md:19`).
- [ ] API: `insert(key, meta)`, `children(prefix)`, `node_count`, `invalidate(prefix)`.
- [ ] Store per `(provider_id, bucket)` in `AppState.trees`; `fetched_at` timestamps.
- **DoD:** fuzz/prop test: insert 10k synthetic keys, navigate arbitrary prefix in <1ms.

### P1.6 — IPC: `list_objects` (paginated) `[B]` ~1.5d · depends P1.5,P1.2
- [ ] `objects.rs`: first visit to a bucket = `list_objects_v2().paginator()` flat scan to build `PrefixTree`; subsequent navigations read from tree (`feature.md:25`).
- [ ] Return **paginated** `ObjectMeta[]` slices `{key,size,etag,last_modified,storage_class,is_dir}` + cursor — never raw responses.
- [ ] Concurrent flat-scan with bounded paginator; cancellation on bucket switch.
- **DoD:** 50k-object bucket navigates folders instantly after first load; bytes never serialized to JS (assert in test).

### P1.7 — `presign_get` command `[B]` ~0.5d · depends P1.2
- [ ] `presign.rs`: `presign_get(bucket,key,ttl_secs=900) → Url` (`feature.md:35`).
- **DoD:** returns a URL that successfully GETs a private object.

### P1.8 — IPC error envelope + AccessDenied handling `[B]` ~0.5d · depends P1.4
- [ ] `error.rs`: `AppError` enum (`AccessDenied`, `NotFound`, `Network`, `Provider`, `Internal`) → `{code, message}` JSON.
- [ ] Per-object 403 surfaced as `ObjectMeta.access = Denied`.
- **DoD:** frontend `invoke` wrapper rejects typed errors; AccessDenied → UI shows direct-path bar.

### P1.9 — `useProfileStore` `[F]` ~0.5d · depends P0.6,P1.4
- [ ] Zustand store: `{profiles, active, refresh(), select(id)}`; persist `active` to localStorage.
- **DoD:** selecting a profile re-triggers bucket load; survives reload.

### P1.10 — ProfilePicker modal `[F]` ~1d · depends P1.9
- [ ] On boot: if `profiles.length>1 && !active` → shadcn `Dialog`; if 0 → empty-state with "Configure provider" CTA.
- [ ] Rows show provider icon, name, region, source badge.
- **DoD:** picking DO nyc3 vs AWS switches the active client.

### P1.11 — `useExplorerStore` `[F]` ~1d · depends P1.6,P0.6
- [ ] Zustand+immer: `{tree: subtree cache, currentPath[], cursor, status, paginate(), navigate(prefix), invalidate(node)}`.
- **DoD:** store drives table + breadcrumb; navigate is O(1) on cached prefix.

### P1.12 — SideNav: provider grouping + bucket list `[F]` ~1.5d · depends P1.4,P1.10
- [ ] Buckets grouped under provider headers (AWS / DigitalOcean), provider-colored icons (`feature.md:3`).
- [ ] Collapsible groups; "Direct Path…" entry at bottom.
- [ ] Active bucket highlight; click sets `currentPath=[]`.
- **DoD:** two providers render as separate groups; matches mock `multi_provider_storage_dashboard` sidebar.

### P1.13 — Breadcrumb bar `[F]` ~0.5d · depends P1.11
- [ ] `font-data-mono` segments, `/` separators, per-segment copy button (`DESIGN.md:127`).
- [ ] Click segment → `navigate` up to that depth.
- **DoD:** deep path navigates up correctly; copy puts key prefix in clipboard.

### P1.14 — ObjectTable (non-virtualized MVP) `[F]` ~1.5d · depends P1.11
- [ ] Zebra rows (`bg-surface-container-low` alt), sticky `<thead>`, hover `bg-primary-container/5` (`DESIGN.md:151`).
- [ ] Columns: Name (folder/file icon), Size (`font-data-mono`), Modified, Storage Class, Access badge.
- [ ] Badges: Private (outline), Public (`error-container`), Encrypted (`secondary-fixed`+`ShieldCheck`) (`DESIGN.md:148-150`).
- [ ] Row click → open `MetadataDrawer`.
- **DoD:** matches mock `file_browser_with_filter_sort` styling; 1k rows render smoothly (virtualization is Phase 3).

### P1.15 — MetadataDrawer + presigned preview `[F]` ~1d · depends P1.7,P1.14
- [ ] Right drawer: metadata rows (ARN, ETag, size, modified, storage class) with copy buttons.
- [ ] Preview pane: image/PDF via `<img>`/`<iframe>` on presigned URL; video via `<video>` (`feature.md:35`).
- **DoD:** image + PDF + mp4 preview without downloading through JS memory.

### P1.16 — Direct-path bar `[F]` ~0.5d · depends P1.8
- [ ] Monospace input; on submit, call `list_objects(prefix=...)` directly without bucket-wide scan.
- [ ] Shown prominently when `AccessDenied` from `list_buckets`.
- **DoD:** reaches `s3://bucket/a/b/c/` even without `ListAllMyBuckets`.

### P1.17 — Filter / sort / local search toolbar `[F]` ~1d · depends P1.14
- [ ] Search input (prefix-scoped, local), Filter dropdown (type/size/access), Sort dropdown (name/size/modified) — all client-side over the current page.
- **DoD:** filters/sorts the visible slice correctly; chips show active filters.

### P1.18 — TopAppBar tabs + empty/error states `[F]` ~0.5d · depends P1.12
- [ ] Explorer tab active; others disabled w/ "coming soon" tooltip.
- [ ] Empty bucket, loading skeleton, AccessDenied, network-error states.
- **DoD:** every async path has a defined UI state.

### P1.19 — Integration smoke tests `[T]` ~1d · depends P1.1–P1.8
- [ ] Rust integration test against `localstack` or `minio` container for list/presign; gated `#[cfg(feature="integration")]`.
- [ ] DO Spaces nyc3 manual checklist in `docs/smoke.md`.
- **DoD:** CI runs containerized smoke test; manual DO checklist passes.

**Phase 1 DoD:** browse AWS S3 + DO Spaces (`nyc3`) read-only; sub-ms folder nav; presigned image/PDF preview; direct-path works under restricted IAM.

---

# Phase 2 (MVP-2) — Transfers & mutations

Goal: upload, download, delete. Covers `feature.md:5`, `feature.md:7`, `feature.md:9`, `feature.md:16`.

### P2.1 — Keyring secrets module `[B]` ~1d · depends P0.7
- [ ] `secrets.rs`: `keyring::Entry` service `bucketeer`; `set/get/delete(provider_id, {access_key, secret})`.
- [ ] Never write secrets to plaintext config (`feature.md:16`).
- **DoD:** round-trip on macOS Keychain; failing entry → typed error, no panic.

### P2.2 — Add-Provider form → keyring `[F]` ~1.5d · depends P2.1,P1.10
- [ ] Form (mock `digitalocean_spaces_configuration` / `cloudflare_r2_configuration`): provider `<select>`, region `<select>` (DO preselect `nyc3`), endpoint (auto-derived, editable), access key, secret.
- [ ] Submit → keyring store → replaces `providers.toml` entry → refresh `profiles`.
- **DoD:** add a DO provider without touching disk files; it appears in sidebar.

### P2.3 — Multipart upload (resume) `[B]` ~2d · depends P1.2
- [ ] `uploads.rs`: `create_multipart` → parallel `upload_part` (bounded) → `complete`; per-part retry; abort on cancel (`feature.md:7`).
- [ ] Emit `upload://progress` events `{id, key, bytes, total, phase}`.
- [ ] Persist part-state to enable resume after crash (best-effort).
- **DoD:** upload 5GB file; kill mid-flight; resume completes; abort cleans up.

### P2.4 — Streaming download `[B]` ~1d · depends P1.2
- [ ] `downloads.rs`: stream `get_object` body to a temp path; progress events; OS "reveal in Finder/Explorer".
- **DoD:** download a multi-GB object without buffering in memory.

### P2.5 — Delete with S3-compatible fallback `[B][T]` ~1.5d · depends P1.2
- [ ] `delete.rs`: try `delete_objects` bulk; on `NotImplemented`/`MethodNotAllowed` → per-object `delete_object` (`feature.md:5`).
- [ ] Recursive folder delete = expand prefix → delete each.
- [ ] **Unit test w/ mock client** returning `NotImplemented` to exercise fallback (DO Spaces won't trigger it).
- **DoD:** recursive delete on AWS (bulk path) + fallback unit test green.

### P2.6 — Drag-drop ingest `[B]` ~1d · depends P2.3
- [ ] Tauri v2 `onDragDropEvent` → file/folder paths delivered to Rust directly (`feature.md:9`).
- [ ] Recursive walk, MIME-by-extension, build S3 prefix from relative path, enqueue multipart uploads.
- **DoD:** drag a folder with 100 mixed files → uploaded preserving structure.

### P2.7 — Transfer progress events `[B]` ~0.5d · depends P2.3,P2.4
- [ ] Unify `upload://` + `download://` event channels; `Transfer{id,kind,key,phase,progress}`.
- **DoD:** frontend subscribes once per workspace.

### P2.8 — `useTransferStore` + transfer drawer `[F]` ~1.5d · depends P2.7
- [ ] Zustand store subscribes to events; bottom drawer lists active/completed transfers with progress bars, cancel, retry, reveal.
- **DoD:** 3 concurrent uploads reflected live; cancel aborts via Rust.

### P2.9 — Upload split-button + drag-drop UI `[F]` ~1d · depends P2.6,P2.8
- [ ] Split button "Upload ▾" → Single File / Bulk Folder (mock `explorer_with_upload_bulk_delete`); drop-zone overlay on the table.
- **DoD:** both entry points enqueue transfers into the store.

### P2.10 — Bulk-action bar + confirm-delete `[F]` ~1.5d · depends P2.5,P1.14
- [ ] Multi-select checkboxes → sticky `bg-primary-container` bar: `N selected` + Download + Delete (`error-container`).
- [ ] Confirm modal lists affected keys + recursive count; shows whether bulk or fallback fired.
- **DoD:** select 50 objects across folders → confirmed delete → correct count + success toast.

### P2.11 — Targeted cache invalidation `[B][F]` ~1d · depends P1.5,P2.3,P2.5
- [ ] After upload/delete, invalidate only the affected `PrefixTree` node + re-fetch that prefix (`feature.md:21`, partial).
- **DoD:** mutated prefix updates within 500ms; siblings stay cached.

**Phase 2 DoD:** upload (multipart+resume), download (stream), delete (bulk+fallback), folder drag-drop; secrets in keyring only; cache stays consistent.

---

# Phase 3 (MVP-3) — Performance, workspaces, command palette

Goal: handle 100k+ object buckets without UI freeze; side-by-side workspaces; ⌘K. Covers `feature.md:21` (TTL), `feature.md:23` (prefetch), `feature.md:28` (virtualization), `feature.md:30` (multi-workspace), `feature.md:45` (deep search).

### P3.1 — Virtualized table `[F]` ~1.5d · depends P1.14
- [ ] Swap rendering for `@tanstack/react-virtual`; keep zebra, sticky head, hover, row height stable (`feature.md:28`).
- **DoD:** 100k rows scroll at 60fps; selection + drawer still work.

### P3.2 — TTL background refresh `[B]` ~1d · depends P1.5
- [ ] Tokio task every 30 min re-list visited prefixes with `fetched_at` older than TTL (`feature.md:21`); merge into tree.
- **DoD:** externally added object appears within one TTL cycle without manual refresh.

### P3.3 — Hover prefetch `[B][F]` ~1d · depends P1.6
- [ ] `prefetch_prefix()` command; row `onMouseEnter` (debounced 150ms) warms the tree (`feature.md:23`).
- **DoD:** drawer opens <50ms on previously hovered rows.

### P3.4 — Deep search (throttled) `[B][F]` ~1.5d · depends P1.6
- [ ] `search.rs`: recursive list scoped to prefix, `Semaphore(10)` concurrency (`feature.md:45`); stream matches as events.
- [ ] UI: search bar switches from local to deep mode when toggled.
- **DoD:** search 200k-object prefix returns matches incrementally; never trips S3 rate limits.

### P3.5 — `useWorkspaceStore` + tabs `[F]` ~2d · depends P1.9,P1.11
- [ ] Tab strip in `TopAppBar`; each tab = `{provider_id, bucket, prefix}` with isolated stores (`feature.md:30`).
- [ ] Dual-pane toggle option.
- **DoD:** AWS-prod tab and DO-nyc3 tab operate independently.

### P3.6 — Strict isolation audit `[F][T]` ~1d · depends P3.5
- [ ] Tests: per-tab tree slices, selection, active client; cross-tab mutation cannot affect another tab.
- **DoD:** isolation test suite green.

### P3.7 — Command palette (⌘K) `[F]` ~1.5d · depends P3.5
- [ ] `cmdk`-based palette (mock `global_storage_dashboard`): jump to bucket/path, switch profile, run action; ESC closes.
- **DoD:** ⌘K → type "prod/old" → Enter navigates a nested path.

### P3.8 — Notifications dropdown `[F]` ~0.5d · depends P3.2,P3.4
- [ ] TopAppBar bell: TTL-refresh errors, search-completion toasts, transfer alerts.
- **DoD:** background errors surface to the user.

**Phase 3 DoD:** 100k rows smooth; tabs isolated; ⌘K fast; background TTL + search throttle behave.

---

# Phase 4 (MVP-4) — Rich media, editor, sharing

Goal: in-app editing, decompression inspection, shareable links. Covers `feature.md:37`, `feature.md:39`, `feature.md:41`.

### P4.1 — Editor get/put roundtrip `[B]` ~1d · depends P1.2
- [ ] `editor.rs`: `get_object`→temp file, `put_object` from edited bytes; versioning-aware (return `version_id`) (`feature.md:37`).
- **DoD:** edit+save JSON returns to S3; versioned bucket yields new version id.

### P4.2 — Streaming decompression `[B]` ~1.5d · depends P1.2
- [ ] `inspect.rs`: GET body → `flate2` (gz) / `zstd` → stream first N KB to frontend (`feature.md:39`); hard cap output.
- **DoD:** inspect 2GB `.gz` log returns head without OOM.

### P4.3 — Shareable presigned w/ selectable TTL `[B]` ~0.5d · depends P1.7
- [ ] Extend `presign_get` to accept TTL choice; copy-to-clipboard (`feature.md:41`).
- **DoD:** generate 5m/1h/24h links.

### P4.4 — Monaco editor view `[F]` ~1.5d · depends P4.1
- [ ] `@monaco-editor/react`; auto-language by ext (json/yaml/log/md); read-only toggle; line gutter; Save/Discard footer (mock `file_browser_with_filter_sort`, `advanced_configuration_editor`).
- [ ] YAML theme matching `yaml-syntax-*` classes.
- **DoD:** edit+save a config.json without manual download.

### P4.5 — Version history aside `[F]` ~1d · depends P4.1
- [ ] When bucket versioning on: version list (CURRENT/STABLE/ARCHIVED), Compare/Restore (mock `advanced_configuration_editor`).
- **DoD:** restore prior version → new current version created.

### P4.6 — Decompression preview pane `[F]` ~0.5d · depends P4.2,P4.4
- [ ] Drawer action "Inspect .gz/.zstd" → streams decoded head into read-only Monaco.
- **DoD:** preview a compressed log in-app.

### P4.7 — Right-click context menu `[F]` ~1d · depends P4.3
- [ ] shadcn `ContextMenu` on rows: Download, Copy Key, Copy S3 URI, Share presigned…, Open in editor, Properties.
- **DoD:** every action wired; S3 URI format correct.

**Phase 4 DoD:** edit JSON/YAML in Monaco and save; inspect `.gz`/`.zstd`; right-click share.

---

# Phase 5 (MVP-5) — Distribution & DX

Goal: shippable installers. Covers `feature.md:48`, `feature.md:50`.

### P5.1 — Packaging config `[I]` ~1d · depends Phase 4
- [ ] `cargo-dist` (preferred) or Tauri bundlers; per-target outputs: macOS universal `.dmg`, Windows `.exe`/`.msi`, Linux `.AppImage` (`feature.md:48`,`:50`).
- **DoD:** local `cargo dist build` produces artifacts on host OS.

### P5.2 — GitHub Actions release matrix `[I]` ~1.5d · depends P5.1
- [ ] Matrix `macos-14 windows-latest ubuntu-22.04`; `oven-sh/setup-bun@v1`; stages lint→test→build→release on tag.
- [ ] macOS universal via `--target universal-apple-darwin`.
- **DoD:** tagged release publishes 3 installers.

### P5.3 — Code signing + notarization `[I]` ~1d · depends P5.2
- [ ] macOS notarization (secrets), Windows code-sign (cert), Linux AppImage.
- **DoD:** Gatekeeper + SmartScreen accept the builds.

### P5.4 — Updater `[I]` ~1d · depends P5.3
- [ ] `tauri-plugin-updater` + signed manifests served from GitHub releases.
- **DoD:** old build pulls a newer signed release.

### P5.5 — Opt-in telemetry `[B][F]` ~1.5d · depends P0.4
- [ ] Anonymous crash + usage; first-launch consent gate (`DESIGN.md:98` privacy-aware audience).
- **DoD:** declined state sends nothing; logs the decision.

### P5.6 — Settings page `[F]` ~1d · depends P5.5
- [ ] Theme preview, log/cache dir, clear-cache, export diagnostics, telemetry toggle.
- **DoD:** clear-cache wipes `PrefixTree`; diagnostics zip downloadable.

**Phase 5 DoD:** tagged release → 3 signed installers + working updater.

---

# Deferred / post-MVP track

Explicitly out of scope until the five MVPs ship:

| Feature | `feature.md` ref | Why deferred |
|---|---|---|
| AWS IAM Identity Center (SSO) + OAuth refresh | `:14` | Hardest auth path. Revisit as Phase 6. |
| Visual IAM Policy Builder | (mock `security_compliance_audit`, `digitalocean_spaces_configuration`) | Powerful but not load-bearing for file ops. |
| Lifecycle Timeline editor | `:153` (DESIGN) | Read-only timeline ships in Phases 1/3; editing transitions later. |
| Live System Monitor overlay (throughput/HTTP logs) | `:43` | DX nicety; builds on existing `tracing` plumbing. |
| Cost dashboards / multi-provider aggregation | (mock `multi_provider_storage_dashboard`, `global_storage_dashboard`) | Requires billing APIs + provider accounting. |

---

## Tracking summary

| Phase | Tasks | Est. |
|---|---:|---:|
| 0 Scaffolding | 7 | 3–5d |
| 1 Read-only browser | 19 | 2–3wk |
| 2 Transfers/mutations | 11 | 2–3wk |
| 3 Perf/workspaces/palette | 8 | 2wk |
| 4 Editor/decompress/share | 7 | 2wk |
| 5 Distribution | 6 | 1–2wk |
| **Total** | **58** | **~9–12wk (1 eng)** |
