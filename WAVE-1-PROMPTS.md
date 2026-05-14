# WAVE-1-PROMPTS.md — Pocket Diary AI, Wave 1

> These prompts are for Claude Code. Run them **in order**. Wait for the previous one to finish, review, and only then run the next.

---

## Prompt 0 — Bootstrap the spine (DONE)

> Produced `packages/pkg-graph/` with SQLite migrations, CRUD, neighbor traversal, and 21 passing tests.

---

## Prompt 1 — Finance domain (DONE)

> Produced `domains/finance/` with 15 MCP tools covering:
> - Statement import (PDF/CSV), spending analysis, monthly reports
> - Portfolio tracking (TFSA/RRSP/RESP), market data (NASDAQ/TSX/NIFTY)
> - Mistake journal, allocation drift, where-to-invest
> - Multi-currency (CAD/USD/INR), expense forecasting
> - 19 passing tests

---

## Prompt 2 — Subscriptions domain

> Pre-reqs: Finance domain is built. Read `PROJECT.md`, `ROADMAP.md`, `CLAUDE.md`, `domains/finance/SKILL.md`.
>
> Build `domains/subscriptions/`. Single commit/PR titled `feat(subscriptions): auto-detect + lifecycle tracking`.
>
> Deliverables:
> 1. `domains/subscriptions/SKILL.md`. Privacy class: `local-preferred`.
> 2. Schemas: `Subscription { id, merchant, category, amount, currency, cadence, next_renewal_at, started_at, last_charged_at, status, usage_signal, confidence }`.
> 3. Event handlers: on `transaction.recurring_detected` and `transaction.imported`.
> 4. MCP tools: `list_subs`, `find_unused`, `upcoming_renewals`, `mark_cancelled`.
> 5. Weekly cron digest to vault.
> 6. Cascade rules: new sub creation and spend over $100/month go to inbox.
> 7. Tests with simulated transaction events.
>
> Do **not** auto-create `sub:*` nodes — propose via Cascade Inbox only.

---

## Prompt 3 — Secrets domain (coach, not vault)

> Pre-reqs: Finance and Subscriptions domains built. Read `PROJECT.md`, `CLAUDE.md`.
>
> Build `domains/secrets/`. Single commit/PR titled `feat(secrets): rotation coach + breach watch`.
>
> **Hard constraint:** This domain **must never store, request, log, or transmit passwords**.
>
> Deliverables:
> 1. `domains/secrets/SKILL.md`. Privacy class: `local-only`.
> 2. Bitwarden CLI integration (metadata only, never passwords).
> 3. HaveIBeenPwned breach checks per domain.
> 4. PKG nodes: `credential:<sha256(name)>` with rotation dates, 2FA status.
> 5. MCP tools: `rotation_status`, `breach_check`, `weakness_report`.
> 6. Weekly vault digest: top 5 things to rotate.
> 7. Tests with mocked Bitwarden CLI and HIBP responses.

---

## After Wave 1

Once these three are built and used for a full week:

- Run a **Wave 1 retro**: read vault output + `docs/backlog.md`, propose 5 improvements. Pick 1-2, fix them.
- Open `WAVE-2-PROMPTS.md` and draft prompts for `invest`, `tasks`, `career`.
