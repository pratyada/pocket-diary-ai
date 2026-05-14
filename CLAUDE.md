# CLAUDE.md — How to work in this repository

> You (Claude Code) are working in a fork of `tinyhumansai/openhuman` that I (Prateek) am turning into a personal life-OS. Read this every time before you propose changes.

---

## Ground rules (Life-OS layer)

1. **Read first, code second.** Before any non-trivial change, read the relevant `SKILL.md` in `domains/<name>/`, the upstream `AGENTS.md`, this file, and `PROJECT.md`.
2. **Never edit upstream `src/`.** All my code lives in `packages/pkg-*`, `packages/event-bus`, `packages/domain-sdk`, `packages/cascade-inbox`, and `domains/*`. If you think you need to change upstream, stop and ask me.
3. **Schemas first.** Every new tool/handler starts with a zod schema (TS) or serde struct (Rust). Implementation comes after the schema is reviewed.
4. **One PR per concern.** Don't bundle "add finance domain" with "refactor event bus" in the same change.
5. **Tests before merge.** At minimum: happy path + one failure mode. Use `vitest` for TS, `cargo test` for Rust.
6. **No new dependencies without justification.** Prefer what's already in upstream `package.json` / `Cargo.toml`. If you must add one, explain why in the PR description and prefer well-maintained, popular crates/packages.

---

## Stop conditions — pause and ask me, do not proceed

- A change would touch money, credentials, Ved, or send external messages
- A change requires a new cloud API key or paid service
- You'd need to modify the upstream `src/` directory
- Schemas would break backward compatibility on PKG nodes/edges
- A test would need to use real production data (use fixtures instead)
- The change spans 3+ domains in one shot

---

## House style

- **Rust:** 2021 edition, `clippy --all-targets --all-features -- -D warnings` clean
- **TypeScript:** strict mode, no `any`, no `// @ts-ignore` without a comment explaining why
- **Naming:** `pkg_node_*` for graph stuff, `evt_*` for events, `dom_<name>_*` for domain-specific tables
- **Markdown notes in vault:** ATX headers, front-matter YAML with `created`, `domain`, `entities` (list of PKG node ids)
- **Commits:** Conventional Commits. Examples: `feat(finance): add statement importer`, `fix(pkg-graph): handle duplicate edges`

---

## When in doubt about a domain

Each domain has a `SKILL.md` that is the source of truth for that domain. If a SKILL.md is missing for the domain you're working on, your first deliverable is to write it (and stop for review before implementing).

A good SKILL.md includes:
- One-sentence purpose
- List of MCP tools with input/output schemas (zod)
- List of events the domain emits
- List of events the domain subscribes to
- Cron schedule, if any
- Vault folder convention
- Privacy class (cloud-ok / local-preferred / local-only)
- Cascade rules: which actions go to the Cascade Inbox

---

## Privacy classes

| Class             | Meaning                                                         | Used by             |
|-------------------|-----------------------------------------------------------------|---------------------|
| `cloud-ok`        | Content can be sent to Anthropic API after TokenJuice           | tasks, brand, career|
| `local-preferred` | Try local model first; cloud only if local can't handle         | finance, invest, subs, equipment, family-time, ventures, startups |
| `local-only`      | Never leaves the machine; Ollama or rule-based only             | child, secrets, health |

The model router enforces this. Domains must declare their class in `SKILL.md` and pass it to the router on every call.

---

## When you finish a chunk of work

Always end with:
1. A short summary of what changed
2. What you deliberately did NOT do (and why)
3. The next 1–3 obvious next steps, ranked
4. Any open questions for me to answer before the next step

Do not silently expand scope. If you discover a real problem outside the current task, write it as a `TODO` in `docs/backlog.md` and keep going.

---
---

# OpenHuman (Upstream Substrate)

**AI assistant for communities — React + Tauri v2 desktop app with a Rust core (JSON-RPC / CLI).**

Narrative architecture: [`gitbooks/developing/architecture.md`](gitbooks/developing/architecture.md). Frontend: [`gitbooks/developing/architecture/frontend.md`](gitbooks/developing/architecture/frontend.md). Tauri shell: [`gitbooks/developing/architecture/tauri-shell.md`](gitbooks/developing/architecture/tauri-shell.md). Agent-harness tool surface: [`gitbooks/developing/architecture/agent-harness.md`](gitbooks/developing/architecture/agent-harness.md).

---

## Repository layout

| Path | Role |
| --- | --- |
| **`app/`** | Yarn workspace `openhuman-app`: Vite + React (`app/src/`), Tauri desktop host (`app/src-tauri/`), Vitest tests |
| **`src/`** (root) | Rust lib `openhuman_core` + `openhuman` CLI binary — `core_server`, `openhuman::*` domains, MCP routing |
| **`Cargo.toml`** (root) | Core crate; `cargo build --bin openhuman` produces the sidecar staged by `app`'s `core:stage` |
| **`docs/`** | Remaining deep internals (memory pipeline excalidraws, sentry, telegram-login, etc.). Public contributor docs live in `gitbooks/developing/`. |

Commands assume the **repo root**; `pnpm dev` delegates to the `app` workspace. (Repo migrated from yarn to pnpm — `package.json` enforces pnpm via the `packageManager` field.)

---

## Runtime scope

- **Shipped product**: desktop — Windows, macOS, Linux.
- **Tauri host** (`app/src-tauri`): desktop-only (`compile_error!` for other targets). No Android/iOS branches.
- **Core binary** (`openhuman`): spawned as a **sidecar**; the UI talks to it over HTTP (`core_rpc_relay` + `core_rpc` client), not by duplicating domain logic.

**Where logic lives**
- **Rust core**: business logic, execution, domains, RPC, persistence, CLI. Authoritative.
- **Tauri + React (`app/`)**: UX, screens, navigation, bridging to the core. Presents and orchestrates only.

---

## Commands (from repo root)

```bash
pnpm dev                  # Frontend + Tauri dev
pnpm tauri dev            # Desktop with Tauri (loads env via scripts/load-dotenv.sh)
pnpm build                # Production UI build
pnpm typecheck            # Typecheck (app workspace)
pnpm lint                 # ESLint
pnpm format               # Prettier write
pnpm format:check         # Prettier check
cd app && pnpm core:stage # Stage openhuman binary next to Tauri resources

# Rust — core library + CLI
cargo check --manifest-path Cargo.toml
cargo build --manifest-path Cargo.toml --bin openhuman

# Rust — Tauri shell
cargo check --manifest-path app/src-tauri/Cargo.toml
```

**Tests**: Vitest in `app/` (`pnpm test:unit`, `pnpm test:coverage`); Rust via `cargo test`.
**Quality**: ESLint + Prettier + Husky in `app`.

### Agent debug runners (`scripts/debug/`)

Bounded-output wrappers around the project test runners. Stdout stays summary-sized (so it fits in agent context); full output is teed to `target/debug-logs/<kind>-<suffix>-<timestamp>.log`. Add `--verbose` to also stream raw output. Prefer these over invoking Vitest / WDIO / cargo directly when iterating.

```bash
# Vitest
pnpm debug unit                                    # full suite
pnpm debug unit src/components/Foo.test.tsx        # one file (positional pattern)
pnpm debug unit -t "renders empty state"           # filter by test name
pnpm debug unit Foo -t "renders empty" --verbose

# WDIO E2E (one spec at a time)
pnpm debug e2e test/e2e/specs/smoke.spec.ts
pnpm debug e2e test/e2e/specs/cron-jobs-flow.spec.ts cron-jobs --verbose

# cargo tests (delegates to scripts/test-rust-with-mock.sh)
pnpm debug rust
pnpm debug rust json_rpc_e2e

# Inspect saved logs
pnpm debug logs                  # list 50 most recent
pnpm debug logs last             # print most recent (last 400 lines)
pnpm debug logs unit             # most recent matching prefix "unit"
pnpm debug logs last --tail 100
```

Files: `scripts/debug/{cli,unit,e2e,rust,logs,lib}.sh` plus `README.md`. Entry point is `pnpm debug` (`scripts/debug/cli.sh`).

### Coverage requirement (merge gate)

PRs must meet **≥ 80% coverage on changed lines**. Enforced by [`.github/workflows/coverage.yml`](.github/workflows/coverage.yml) using `diff-cover` over merged Vitest (`app/coverage/lcov.info`) and `cargo-llvm-cov` (core + Tauri shell) lcov outputs. Below the threshold the PR will not merge — add tests for new/changed lines, not just the happy path.

---

## Configuration

- **[`.env.example`](.env.example)** — Rust core, Tauri shell, backend URL, logging, proxy, storage, AI binary overrides. Load via `source scripts/load-dotenv.sh`.
- **[`app/.env.example`](app/.env.example)** — `VITE_*` (core RPC URL, backend URL, Sentry DSN, dev helpers). Copy to `app/.env.local`.

**Frontend config** is centralized in [`app/src/utils/config.ts`](app/src/utils/config.ts). Read `VITE_*` there and re-export — **never** `import.meta.env` directly elsewhere.

**Rust config** uses a TOML `Config` struct (`src/openhuman/config/schema/types.rs`) with env overrides (`src/openhuman/config/schema/load.rs`).

---

## Testing

### Unit (Vitest)

- Co-locate as `*.test.ts` / `*.test.tsx` under `app/src/**`.
- Config: `app/test/vitest.config.ts`; setup: `app/src/test/setup.ts`.
- Run: `pnpm test:unit`, `pnpm test:coverage`.
- Prefer behavior over implementation. Use helpers in `app/src/test/`. No real network, no time flakes.

### Shared mock backend

Used by both unit and Rust tests.
- Core: `scripts/mock-api-core.mjs` · server: `scripts/mock-api-server.mjs` · E2E wrapper: `app/test/e2e/mock-server.ts`.
- Admin: `GET /__admin/health`, `POST /__admin/reset`, `POST /__admin/behavior`, `GET /__admin/requests`.
- Run manually: `pnpm mock:api`.

### E2E (WDIO — dual platform)

Full guide: [`gitbooks/developing/e2e-testing.md`](gitbooks/developing/e2e-testing.md).
- **Linux (CI)**: `tauri-driver` (WebDriver :4444).
- **macOS (local)**: Appium Mac2 (XCUITest :4723) on the `.app` bundle.
- Specs: `app/test/e2e/specs/*.spec.ts`. Helpers in `app/test/e2e/helpers/`. Config: `app/test/wdio.conf.ts`.

```bash
pnpm test:e2e:build
bash app/scripts/e2e-run-spec.sh test/e2e/specs/smoke.spec.ts smoke
pnpm test:e2e:all:flows
docker compose -f e2e/docker-compose.yml run --rm e2e   # Linux E2E on macOS
```

Use `element-helpers.ts` (`clickNativeButton`, `waitForWebView`, `clickToggle`) — never raw `XCUIElementType*`. Assert UI outcomes and mock effects.

### Deterministic core-sidecar reset

`app/scripts/e2e-run-spec.sh` creates and cleans a temp `OPENHUMAN_WORKSPACE` by default. `OPENHUMAN_WORKSPACE` redirects core config + storage away from `~/.openhuman`.

### Rust tests with mock

```bash
pnpm test:rust
bash scripts/test-rust-with-mock.sh --test json_rpc_e2e
```

---

## Frontend (`app/src/`)

**Provider chain** (`App.tsx`):
`Redux` → `PersistGate` → `UserProvider` → `SocketProvider` → `AIProvider` → `SkillProvider` → `HashRouter` → `AppRoutes`.

**State** (`store/`): Redux Toolkit slices — auth, user, socket, ai, skills, team, etc. Prefer Redux (persisted where configured) over ad-hoc `localStorage`.

**Services** (`services/`): singletons — `apiClient`, `socketService`, `coreRpcClient` (HTTP bridge to core), domain `api/*` clients.

**MCP** (`lib/mcp/`): JSON-RPC transport, validation, types over Socket.io. Tooling is driven by the backend + skills system.

**Routing** (`AppRoutes.tsx`): hash routes `/`, `/onboarding`, `/mnemonic`, `/home`, `/intelligence`, `/skills`, `/conversations`, `/invites`, `/agents`, `/settings/*`. No `/login`.

**AI config**: bundled prompts in `src/openhuman/agent/prompts/` (also bundled via `app/src-tauri/tauri.conf.json` `resources`). Loaders in `app/src/lib/ai/` use `?raw` imports, optional remote fetch, and `ai_get_config` / `ai_refresh_config` in Tauri.

---

## Tauri shell (`app/src-tauri/`)

Thin desktop host: window management, daemon health, **core process lifecycle** (`core_process`, `CoreProcessHandle`), **JSON-RPC relay** (`core_rpc_relay`, `core_rpc`).

Registered IPC (see [`gitbooks/developing/architecture/tauri-shell.md`](gitbooks/developing/architecture/tauri-shell.md)): `greet`, `write_ai_config_file`, `ai_get_config`, `ai_refresh_config`, `core_rpc_relay`, window commands, `openhuman_*` daemon helpers.

---

## Rust core (`src/`)

- **`openhuman/`** — Domain logic (memory, channels, config, cron, skills, webhooks, …). RPC controllers in per-domain `rpc.rs`; use `RpcOutcome<T>` per [`AGENTS.md`](AGENTS.md).
- **Module layout rule**: new functionality goes in a **dedicated subdirectory** (`openhuman/<domain>/mod.rs` + siblings). **Do not** add new standalone `*.rs` files at `src/openhuman/` root.
- **Controller schema contract**: shared types in `src/core/mod.rs` (`ControllerSchema`, `FieldSchema`, `TypeSchema`).
- **Domain schema files**: per-domain `schemas.rs` (e.g. `src/openhuman/cron/schemas.rs`), exported from domain `mod.rs`.
- **Controller-only exposure**: expose features to CLI and JSON-RPC via the controller registry. **Do not** add domain branches in `src/core/cli.rs` / `src/core/jsonrpc.rs`.
- **Light `mod.rs`**: keep domain `mod.rs` export-focused. Operational code in `ops.rs`, `store.rs`, `types.rs`, etc.
- **`core_server/`** — Transport only: Axum/HTTP, JSON-RPC envelope, CLI parsing, dispatch. No heavy logic.

### Event bus (`src/core/event_bus/`)

Typed pub/sub + in-process typed request/response. Both singletons — use module-level functions; never construct `EventBus` / `NativeRegistry` directly.

- **Broadcast** (`publish_global` / `subscribe_global`) — fire-and-forget. Many subscribers, no return.
- **Native request/response** (`register_native_global` / `request_native_global`) — one-to-one typed dispatch keyed by method string. Zero serialization — trait objects, `mpsc::Sender`, `oneshot::Sender` pass through unchanged. Internal-only; JSON-RPC-facing work goes through `src/core/all.rs`.

---

## Design

Premium, calm visual language — ocean primary `#4A83DD`, sage / amber / coral semantics, Inter + Cabinet Grotesk + JetBrains Mono, Tailwind with custom radii/spacing/shadows. Implementation tokens live in [`app/tailwind.config.js`](app/tailwind.config.js).

## Git workflow

- PRs target **`main`**.
- **Commits:** Conventional Commits.

---

## Coding philosophy

- **Unix-style modules**: small, sharp-responsibility units composed through clear boundaries.
- **Tests before the next layer**: ship unit tests for new/changed behavior before stacking features. Untested code is incomplete.
- **Docs with code**: new/changed behavior ships with matching rustdoc / code comments.

---

## Key patterns

- **File size**: prefer ≤ ~500 lines; split growing modules.
- **Pre-merge** (code changes): Prettier, ESLint, `tsc --noEmit` in `app/`; `cargo fmt` + `cargo check` for changed Rust.
