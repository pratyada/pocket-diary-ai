# CLAUDE.md — How to work in this repository

> You (Claude Code) are working in a fork of `tinyhumansai/openhuman` that I (Prateek) am turning into a personal life-OS. Read this every time before you propose changes.

---

## Ground rules

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
