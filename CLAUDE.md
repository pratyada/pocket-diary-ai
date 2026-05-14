# CLAUDE.md — How to work in this repository

> You (Claude Code) are working in **Pocket Diary AI** — a personal life-OS built by Prateek Yadav. The substrate layer is inspired by OpenHuman. Read this every time before you propose changes.

---

## Ground rules (Pocket Diary AI)

1. **Read first, code second.** Before any non-trivial change, read the relevant `SKILL.md` in `domains/<name>/`, this file, and `PROJECT.md`.
2. **Never edit upstream `src/`.** All Pocket Diary AI code lives in `packages/` and `domains/`. If you think you need to change `src/`, stop and ask me.
3. **Schemas first.** Every new tool/handler starts with a zod schema (TS) or serde struct (Rust). Implementation comes after the schema is reviewed.
4. **One PR per concern.** Don't bundle "add finance domain" with "refactor event bus" in the same change.
5. **Tests before merge.** At minimum: happy path + one failure mode. Use `vitest` for TS, `cargo test` for Rust.
6. **No new dependencies without justification.** Prefer what's already available. If you must add one, explain why.

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
- **Package namespace:** `@pocket-diary-ai/<domain>`

---

## When in doubt about a domain

Each domain has a `SKILL.md` that is the source of truth. If missing, write it first (and stop for review before implementing).

A good SKILL.md includes:
- One-sentence purpose
- List of MCP tools with input/output schemas (zod)
- List of events emitted and subscribed
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

---

## When you finish a chunk of work

Always end with:
1. A short summary of what changed
2. What you deliberately did NOT do (and why)
3. The next 1-3 obvious next steps, ranked
4. Any open questions for me to answer

Do not silently expand scope. If you discover a problem outside the current task, write it to `docs/backlog.md`.

---
---

# Substrate Layer (inspired by OpenHuman)

The substrate provides the desktop app shell, Rust core, and foundational infrastructure.

## Repository layout

| Path | Role |
| --- | --- |
| **`app/`** | Vite + React desktop app (`app/src/`), Tauri host (`app/src-tauri/`) |
| **`src/`** (root) | Rust core: business logic, RPC, persistence, CLI |
| **`packages/`** | Pocket Diary AI extensions (pkg-graph, domain-sdk, etc.) |
| **`domains/`** | Domain agents (one per life domain) |

## Commands (from repo root)

```bash
pnpm dev                  # Frontend + Tauri dev
pnpm build                # Production UI build
pnpm typecheck            # Typecheck (app workspace)
pnpm lint                 # ESLint
pnpm format               # Prettier write

# Rust
cargo check --manifest-path Cargo.toml
cargo build --manifest-path Cargo.toml --bin openhuman

# Pocket Diary AI packages
cd packages && cargo test                              # pkg-graph tests
cd domains/finance && npm test                         # finance domain tests
```

**Tests**: Vitest in `app/` (`pnpm test:unit`); Rust via `cargo test`.

## Event bus (`src/core/event_bus/`)

Typed pub/sub + in-process request/response. Singletons via module-level functions.

- **Broadcast** (`publish_global` / `subscribe_global`) — fire-and-forget, many subscribers
- **Native request/response** (`register_native_global` / `request_native_global`) — one-to-one typed dispatch

## Frontend (`app/src/`)

React 19 + Redux Toolkit + Tauri v2. Provider chain: Redux -> PersistGate -> UserProvider -> SocketProvider -> AIProvider -> SkillProvider -> HashRouter -> AppRoutes.

## Rust core (`src/`)

Domain logic under `src/openhuman/<domain>/`. New Pocket Diary AI functionality goes in `packages/` and `domains/`, never in `src/`.

## Key patterns

- **File size**: prefer <= ~500 lines; split growing modules
- **No dynamic imports** in production `app/src` code
- Git workflow: PRs target `main`, Conventional Commits
