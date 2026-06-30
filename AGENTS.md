# AGENTS.md

Guidance for AI coding agents working in this repository.

## Commands

Run from the repository root unless noted.

| Task | Command |
| --- | --- |
| Install deps | `bun install` |
| Frontend dev server | `bun run dev` |
| Boot desktop app | `bun run tauri dev` |
| Frontend typecheck | `bun run lint` |
| Frontend build | `bun run build` |
| Rust format | `cargo fmt --all` (in `src-tauri/`) |
| Rust lint | `cargo clippy --all-targets -- -D warnings` (in `src-tauri/`) |
| Rust tests | `cargo test` (in `src-tauri/`) |

Always run **both** `bun run lint` and `cargo clippy` before considering work done.

## Stack

- Desktop: **Tauri v2** + **Rust** (`aws-sdk-s3`)
- Frontend: **React 18 + Vite + TypeScript**, **shadcn/ui**, **Tailwind v3**
- State: **Zustand + immer**
- Package manager: **Bun** (use `bun add`, not npm/yarn)
- Icons: **lucide-react** (never use Google Material Symbols)

## Architecture invariants

- **IPC boundary**: heavy I/O runs on Rust threads. Only paginated metadata
  crosses the IPC bridge — never binary blobs or raw SDK responses.
- **IPC envelope**: every Rust command returns `Result<T, AppError>` where
  `AppError` serializes to `{ code, message }`. Call via `src/lib/ipc.ts`.
- **Secrets**: never write credentials to plaintext config. Use the OS keyring
  (`keyring` crate / service name `bucketeer`).
- **Design tokens**: Material-3 dark theme. shadcn semantic tokens are HSL CSS
  vars in `src/styles/tokens.css`; the rest of the Material-3 palette is hex in
  `tailwind.config.ts`. Dark-only UI.

## Conventions

- TypeScript: strict mode, `@/*` path alias → `src/*`.
- Fonts: Inter (UI) + JetBrains Mono (`font-mono`) for keys, ARNs, ETags.
- Rust: `serde(rename_all = "snake_case")` on enums mirrored to TS in `src/lib/ipc.ts`.
- No comments in code unless explicitly requested.
- Do not commit secrets. Do not commit unless explicitly asked.
