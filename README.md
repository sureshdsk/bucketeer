# Bucketeer

A next-generation, Rust-backed S3 browser. Cross-platform desktop app built with
**Tauri v2** (Rust) + **React + Vite + TypeScript** frontend, styled with a
Material-3 dark design system.

Supported providers: **AWS S3** and **DigitalOcean Spaces** (S3-compatible), with
Cloudflare R2 / MinIO / Custom endpoints to follow.

## Requirements

| Tool | Version |
| --- | --- |
| [Bun](https://bun.sh) | >= 1.3 |
| [Rust](https://rustup.rs) (stable) | >= 1.91 (AWS SDK MSRV) |
| Platform toolchain | Tauri v2 prerequisites (see below) |

> **Note:** the project is developed against a [rustup](https://rustup.rs)-managed
> toolchain. If a Homebrew `rust` shadows rustup on your `PATH`, prefer rustup
> (`brew unlink rust`) so `cargo` / `rustc` resolve to a current stable release.

### Tauri v2 prerequisites
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Linux**: `libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`
- **Windows**: Microsoft Edge WebView2 (preinstalled on Windows 11)

## Getting started

```bash
bun install                 # install frontend dependencies
bun run tauri dev           # boot the desktop app (starts Vite + Rust)
```

Verified toolchain at scaffold time: `bun 1.3.5`, `rustc 1.88.0`, `git 2.39.3`.

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Vite dev server only (no Tauri shell) |
| `bun run build` | Type-check + production build to `dist/` |
| `bun run lint` | `tsc --noEmit` |
| `bun run tauri dev` | Boot desktop app in dev mode |
| `bun run tauri build` | Build installable desktop bundle |

## Project layout

```
bucketeer/
├── docs/                 # feature.md, DESIGN.md, PLAN.md, mock UI
├── src/                  # React + TypeScript frontend
├── src-tauri/            # Rust + Tauri backend
├── scripts/              # build helper scripts
└── .github/workflows/    # CI
```

See [`docs/PLAN.md`](./docs/PLAN.md) for the full phased implementation plan.

## Releasing & distribution

Two workflows: [`build.yml`](./.github/workflows/build.yml) (fast PR/push lint +
tests on Linux) and [`release.yml`](./.github/workflows/release.yml) (cut a
release). Releases are **dispatch-driven** from the `main` branch:

1. Actions → *Release* → *Run workflow* → pick a bump (`auto`, `patch`, `minor`,
   `major`). `auto` reads [conventional commits](https://www.conventionalcommits.org/)
   since the last tag (`feat:`→minor, `!:`/`BREAKING CHANGE`→major, else patch).
2. The workflow bumps the version in `package.json`, `tauri.conf.json`,
   `Cargo.toml`, and `Cargo.lock`, commits it as `chore(release): vX.Y.Z`, tags
   it, then builds a `macos-14` (universal), `windows-latest`, and `ubuntu-22.04`
   matrix via `tauri-apps/tauri-action`.
3. The run creates a **draft** release with per-platform installers and the
   signed updater manifest (`latest.json`). Publish the draft to make auto-update
   live (`releases/latest/download/latest.json`).

### Required GitHub secrets

| Secret | Purpose |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | **Required** for the updater — signs the install bundle. |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the signing key. |
| `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY` | macOS code signing (optional). |
| `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` | macOS notarization (optional). |

Windows/Linux code signing is added the same way. **Any signing secret left
empty is skipped**, so unsigned builds stay green until certs are configured.

Generate or rotate the updater signing keypair:

```bash
bunx @tauri-apps/cli signer generate -w ~/.bucketeer-updater-key
# private key → TAURI_SIGNING_PRIVATE_KEY secret
# password    → TAURI_SIGNING_PRIVATE_KEY_PASSWORD secret
# public key  → paste into tauri.conf.json → plugins.updater.pubkey
```

> The updater's public key currently in `tauri.conf.json` is a **dev key** used
> only to validate the pipeline locally. Replace it with your own before a real
> release, or existing installs will reject updates.

### Local build

```bash
bun run tauri build            # all bundles for the host OS
bun run tauri build --bundles dmg   # single format
```

Telemetry is **opt-in and local-only**: coarse, anonymous events are written to
`~/.bucketeer/logs/telemetry.jsonl` only after consent. Nothing is sent
off-machine. Consent and other preferences live in `~/.bucketeer/settings.toml`.

