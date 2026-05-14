# ROADMAP.md — Pocket Diary AI build order, wave by wave

Each wave ends with a working, used-by-me-daily slice. Don't start wave N+1 until I've used wave N for a full week and the bugs are bled out.

---

## Wave 0 — Spine (DONE)

The plumbing every domain depends on.

- [x] Set up repository with planning docs
- [x] Add `packages/pkg-graph/` (Rust): node/edge CRUD, SQLite migrations, query helpers, `cargo test` (21 tests)
- [ ] Add `packages/event-bus/` (Rust): bridge to substrate event bus + persistent journal
- [ ] Add `packages/domain-sdk/` (TS): base class for MCP domain servers
- [ ] Add `packages/cascade-inbox/` (UI): list view + approve/reject/edit
- [ ] Set up `pnpm` workspace to include `domains/*`
- [ ] CI: lint, type-check, unit tests on push

---

## Wave 1 — Daily-pain domains (in progress)

### 1.1 `domains/finance/` (DONE)
- [x] PDF/CSV statement parsing (RBC, TD, BMO, HDFC, SBI, Chase + generic)
- [x] Two-stage categorization (rules YAML + LLM fallback)
- [x] Monthly cash-flow reports to vault
- [x] Anomaly detection (>2sigma vs rolling average)
- [x] Portfolio tracking (TFSA, RRSP, RESP, brokerage)
- [x] Market data feeds (NASDAQ, TSX, NIFTY via Yahoo Finance)
- [x] Allocation drift analysis + rebalance suggestions
- [x] Mistake journal with pattern analysis
- [x] Multi-currency (CAD/USD/INR) with FX conversion
- [x] Where-to-invest tax efficiency analysis
- [x] Net worth aggregation across Canada/India/US
- [x] Expense forecasting
- [x] 15 MCP tools, 19 tests passing

### 1.2 `domains/subscriptions/`
- [ ] Listen to `transaction.recurring_detected` from finance
- [ ] Cross-reference Gmail receipts
- [ ] Detect overlaps, zombies, upcoming renewals
- [ ] MCP tools: `list_subs`, `find_unused`, `upcoming_renewals`

### 1.3 `domains/secrets/`
- [ ] **No password storage.** Reads metadata from Bitwarden/1Password CLI
- [ ] HaveIBeenPwned breach check
- [ ] Rotation tracking + weekly "rotate these" digest
- [ ] MCP tools: `rotation_status`, `breach_check`, `weakness_report`

**Done when:** I drop statements, get cash-flow reports, see subscriptions auto-detected, and get weekly credential rotation reminders.

---

## Wave 2 — Wealth + work (planned)

### 2.1 `domains/invest/`
- [ ] Brokerage CSV import, daily price refresh
- [ ] Allocation drift vs target
- [ ] Mistake journal clustering (quarterly)
- [ ] Watchlist with threshold alerts

### 2.2 `domains/tasks/`
- [ ] Daily standup: today's calendar + top 3 tasks + overdue
- [ ] Weekly review: done, slipped, energy patterns
- [ ] Gmail + Calendar + Notion integration

### 2.3 `domains/career/`
- [ ] LinkedIn export parsing
- [ ] Gap analysis vs target role
- [ ] Quarterly career memo

---

## Wave 3 — Family + ventures (planned)

### 3.1 `domains/child/` (Ved)
- [ ] **Local model only** (Ollama). No cloud LLM.
- [ ] Schedule manager, milestone log, habit tracker
- [ ] Weekly summary to me/partner

### 3.2 `domains/ventures/` (IG accounts)
- [ ] Instagram Graph API, weekly per-account performance
- [ ] Content gap detection

### 3.3 `domains/startups/`
- [ ] GitHub + Linear integration
- [ ] North-star metric tracking

---

## Wave 4 — The rest (planned)

- `domains/health/` — Apple Health import, intake logging
- `domains/equipment/` — Service intervals, warranty alerts
- `domains/family-time/` — Activity suggestions, weather-aware planning
- `domains/brand/` — yprateek.com analytics, content pipeline

---

## After Wave 4 — Hardening

- Encrypted backup/restore of SQLite + vault
- Mobile companion for quick-entry (health, family-time)
- Cross-domain "ask anything" prompt
- Quarterly self-review: "state of Prateek" doc

---

## What I will NOT do, ever

- Auto-place trades
- Store passwords
- Send messages on my behalf without per-message approval
- Send Ved's data to cloud LLMs
- Skip the Cascade Inbox for money-affecting actions
