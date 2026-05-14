# WAVE-1-PROMPTS.md — Copy each section verbatim into Claude Code, one at a time

> Run these **in order**. Wait for the previous one to finish, review the PR, merge, and only then run the next. Do not paste more than one prompt in a session — Claude Code will conflate scopes and you'll get sludge.

---

## Prompt 0 — Bootstrap the spine

> Read `PROJECT.md`, `ROADMAP.md`, and `CLAUDE.md` in this repo. Then read the upstream OpenHuman docs in `docs/` and `AGENTS.md` to understand the substrate. After reading, produce a single PR titled `feat(spine): wave-0 scaffolding` that adds:
>
> 1. `packages/pkg-graph/` — Rust crate with SQLite migrations for `pkg_nodes`, `pkg_edges`, `pkg_events`; CRUD functions; a `find_neighbors(node_id, rel?, depth)` helper; `cargo test` covering insert/get/neighbor traversal.
> 2. `packages/event-bus/` — Rust crate wrapping `tokio::sync::broadcast` with a `pkg_events` journal writer. One test that publishes an event, journals it, and replays from journal.
> 3. `packages/domain-sdk/` — TypeScript package exporting a `DomainServer` base class for MCP servers, a `VaultWriter` helper that writes Markdown with YAML front-matter to `vault/domains/<name>/`, and a `PkgClient` that talks to the Rust graph via IPC (use Tauri commands).
> 4. `packages/cascade-inbox/` — A minimal React/Tauri view registered as a new tab in the OpenHuman UI. It lists proposals from a `cascade_proposals` table (define the schema) and has Approve/Reject buttons that emit events.
> 5. `docs/pkg-schema.md` and `docs/event-catalog.md` with the initial schemas.
>
> Do **not** add any domain code yet (no `domains/finance/`, etc.). Do **not** modify anything under upstream `src/`. Stop after the PR is ready for review. End with the summary format from CLAUDE.md (what changed, what you didn't do, next steps, open questions).

---

## Prompt 1 — Finance domain

> Read `PROJECT.md`, `ROADMAP.md`, `CLAUDE.md`, the spine I merged in PR #1, and the existing OpenHuman Gmail integration so you understand the auto-fetch pattern.
>
> Build `domains/finance/` as the first domain. Produce a single PR titled `feat(finance): statement ingestion, categorization, monthly report`.
>
> Deliverables:
> 1. `domains/finance/SKILL.md` — full spec per the CLAUDE.md template. Privacy class: `local-preferred`. List every MCP tool, every event emitted/subscribed, the cron schedule, and the cascade rules.
> 2. `domains/finance/schemas/` — zod schemas for `Statement`, `Transaction`, `MonthlyReport`, `Anomaly`. A `Transaction` has: id, account_id, date, amount, currency, merchant_raw, merchant_normalized, category, subcategory, confidence, is_recurring, source_statement_id.
> 3. `domains/finance/src/server.ts` — MCP server exposing tools:
>    - `import_statement({ path })` — accepts a PDF, returns parsed transactions and statistics
>    - `query_spending({ period: 'month'|'quarter'|'ytd', category?: string })`
>    - `monthly_report({ year, month })` — writes a Markdown report to vault and returns the path
>    - `list_anomalies({ since })`
> 4. PDF parsing: use `pdfjs-dist` for text extraction. Detect bank/card from the first page (template matching). Start with these templates: generic Canadian bank (RBC, TD, BMO formats) and generic credit card. Add a fallback that LLM-classifies rows when template fails, but keep that path metered and behind a confidence threshold.
> 5. Categorization: two-stage. (a) rules file `domains/finance/rules/merchants.yaml` with merchant→category mappings I can edit. (b) LLM fallback for unmatched, with the prompt asking it to choose from a fixed taxonomy in `domains/finance/taxonomy.yaml`. Persist confidence; anything below 0.7 emits `transaction.review_needed`.
> 6. PKG writes: each unique account becomes an `account:*` node, each merchant becomes a `merchant:*` node, each recurring pattern becomes a candidate `sub:*` node (but **do not auto-create subscriptions** — that's the subscriptions domain's job; just emit `transaction.recurring_detected`).
> 7. Vault output: `vault/domains/finance/YYYY-MM.md` with cash-flow summary, top categories, top merchants, anomalies, recurring detections. YAML front-matter with `entities` listing every PKG node touched.
> 8. Anomaly detection: per (merchant_normalized, category) pair, compute rolling 6-month mean + stddev; flag transactions > 2σ. Emit `anomaly.detected` with severity.
> 9. Tests in `domains/finance/tests/` using fixture PDFs (I'll provide one real statement; for the PR, generate a synthetic fixture using `pdf-lib` so tests are reproducible).
>
> Do **not**: connect any bank aggregator (Flinks/Plaid) — that's a separate PR. Do **not** auto-create `sub:*` nodes. Do **not** send any transaction descriptions to a cloud LLM without first passing through the model router with privacy class `local-preferred`.
>
> Stop after PR is ready. Use the CLAUDE.md summary format.

---

## Prompt 2 — Subscriptions domain

> Pre-reqs: PRs #1 (spine) and #2 (finance) are merged. Read all three: `PROJECT.md`, `ROADMAP.md`, `CLAUDE.md`, `domains/finance/SKILL.md`.
>
> Build `domains/subscriptions/`. Single PR titled `feat(subscriptions): auto-detect + lifecycle tracking`.
>
> Deliverables:
> 1. `domains/subscriptions/SKILL.md`. Privacy class: `local-preferred`.
> 2. Schemas: `Subscription { id, merchant, category, amount, currency, cadence: 'monthly'|'yearly'|'weekly'|'unknown', next_renewal_at, started_at, last_charged_at, status: 'active'|'paused'|'cancelled'|'zombie', usage_signal: 'active'|'unknown'|'no-signal', confidence }`.
> 3. Event handlers:
>    - On `transaction.recurring_detected`: look up existing `sub:*` node by `merchant_normalized`. If none, prepare a *Cascade Inbox proposal* (do NOT silently create). If existing, update `last_charged_at`, recompute `next_renewal_at`.
>    - On `transaction.imported` for a known sub merchant: same update logic.
> 4. MCP tools:
>    - `list_subs({ status? })`
>    - `find_unused({ threshold_days })` — uses Gmail integration to look for usage signals (login emails, receipts, notifications) in the last N days
>    - `upcoming_renewals({ within_days })`
>    - `mark_cancelled({ sub_id, cancelled_on })` — manual override
> 5. Weekly cron: build a digest at `vault/domains/subscriptions/YYYY-Www.md` with active subs, total monthly burn, zombies, renewals in next 14 days.
> 6. Cascade rules: any new `sub:*` node creation, any auto-detected cancellation, any spend over $100/month must go through the Cascade Inbox. Routine updates (last_charged_at) auto-apply.
> 7. Tests: simulate a stream of `transaction.imported` events and verify the right proposals land in the inbox.
>
> Do **not** call any "cancel my subscription" service. Do **not** auto-create `sub:*` nodes — propose only.
>
> Stop after PR. CLAUDE.md summary format.

---

## Prompt 3 — Secrets domain (coach, not vault)

> Pre-reqs: PRs #1, #2, #3 merged. Read `PROJECT.md`, `CLAUDE.md`, and re-read the Wave 1 section of `ROADMAP.md`.
>
> Build `domains/secrets/`. Single PR titled `feat(secrets): rotation coach + breach watch (no password storage)`.
>
> **Hard constraint:** This domain **must never store, request, log, or transmit passwords**. It only reads metadata. If you find yourself writing code that handles a password value, stop.
>
> Deliverables:
> 1. `domains/secrets/SKILL.md`. Privacy class: `local-only`. State the no-password-storage rule prominently.
> 2. Integration choice: call the `bw` (Bitwarden) CLI in a subprocess to list items (name, login.username, lastUsedDate, passwordRevisionDate). User unlocks Bitwarden manually; we never ask for the master password. If 1Password is preferred, gate that behind a config flag.
> 3. For each item, create/update a `credential:<sha256(name)>` PKG node with: `service_name`, `username` (hashed if it looks like an email — keep last 4 chars + domain), `last_rotated_at`, `account_age_days`, `has_2fa` (if Bitwarden custom fields tell us). **Never store the password value.**
> 4. HaveIBeenPwned integration: for each unique email-domain in our credential set, check breach status. Cache results in `pkg_nodes` (type=`breach`) for 7 days.
> 5. MCP tools:
>    - `rotation_status({ filter? })` — returns sorted list by priority (breached > 365+ days old > 180+ days old > everything else)
>    - `breach_check({ email })`
>    - `weakness_report()` — combined view: weak (per Bitwarden's report), reused (per Bitwarden), old, breached
> 6. Weekly cron: write `vault/domains/secrets/YYYY-Www.md` with top 5 things to rotate this week and a one-line reason each.
> 7. Cascade rules: emit `secret.rotation_due` for each credential needing rotation. The Cascade Inbox shows it as a *reminder*, not an action — clicking "done" just records the rotation date.
> 8. Tests: mock the Bitwarden CLI and HIBP responses. Confirm no test ever holds a password string in memory beyond the subprocess call (audit the code path).
>
> Do **not**: build a UI to enter passwords, build an autofill, build a vault, store passwords in any form, call HIBP's password API (we only use the breach API, not the pwned-password API).
>
> Stop after PR. CLAUDE.md summary format.

---

## After Wave 1

Once these three merge and I've used them for a full week:

- Run a **Wave 1 retro**: ask Claude Code to read `docs/backlog.md` plus a week of `vault/domains/{finance,subscriptions,secrets}/*.md` and propose 5 ergonomic improvements. Pick 1–2, fix them, then move to Wave 2.
- Open a new file `WAVE-2-PROMPTS.md` and we draft prompts for `invest`, `tasks`, `career` using the same shape.

The pattern stays the same forever: tight scope, SKILL.md first, schemas before code, one PR per domain, cascade for anything risky, vault for human-readable output.
