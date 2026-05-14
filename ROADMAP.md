# ROADMAP.md — Build order, wave by wave

Each wave ends with a working, used-by-me-daily slice. Don't start wave N+1 until I've used wave N for a full week and the bugs are bled out.

---

## Wave 0 — Spine (week 1)

The plumbing every domain depends on. No user-visible feature; without this, nothing else works.

- [ ] Fork `tinyhumansai/openhuman` to `openhuman-prateek`
- [ ] Read upstream `AGENTS.md`, `CLAUDE.md`, `docs/`
- [ ] Add `packages/pkg-graph/` (Rust): node/edge CRUD, SQLite migrations, query helpers (find by type, neighbors, path)
- [ ] Add `packages/event-bus/` (Rust): `tokio::sync::broadcast` wrapper + persistent journal table
- [ ] Add `packages/domain-sdk/` (TS): base class for MCP domain servers, vault writer, PKG client over IPC
- [ ] Add `packages/cascade-inbox/` (UI): list view + approve/reject/edit
- [ ] Add `CLAUDE.md` at repo root with house rules for Claude Code (paths, schemas, no upstream edits)
- [ ] Set up `pnpm` workspace to include `domains/*`
- [ ] CI: lint, type-check, unit tests on push

**Done when:** I can run `pnpm run dev`, see OpenHuman boot, see an empty Cascade Inbox tab, and call a stub MCP domain that writes one node + emits one event that the inbox shows.

---

## Wave 1 — Daily-pain domains (weeks 2–4)

The three that pay back fastest.

### 1.1 `domains/finance/`
- [ ] PDF statement ingestion: accepts a folder, classifies bank/card, extracts transactions
- [ ] LLM-backed categorizer with confidence; low-confidence rows queued for my review
- [ ] Monthly cash-flow report → `vault/domains/finance/2026-MM.md`
- [ ] Anomaly detection (>2σ vs. 6-month rolling for that merchant category)
- [ ] Emits `transaction.imported`, `anomaly.detected`
- [ ] MCP tools: `import_statement`, `query_spending(period, category)`, `monthly_report(month)`

### 1.2 `domains/subscriptions/`
- [ ] Listens to `transaction.imported`; pattern-matches recurring charges
- [ ] Cross-references Gmail receipts (via OpenHuman's Gmail integration)
- [ ] Detects: overlap (paying twice for same category), zombie (charged but no usage signal), renewal next 14 days
- [ ] Proposes node creation/update via Cascade Inbox
- [ ] MCP tools: `list_subs`, `find_unused`, `upcoming_renewals(days)`

### 1.3 `domains/secrets/`
- [ ] **No password storage.** Reads metadata from Bitwarden CLI (or 1Password CLI)
- [ ] Calls HaveIBeenPwned for each domain
- [ ] Tracks last-rotation date; surfaces "rotate now" list (>365 days, breached, or critical)
- [ ] MCP tools: `rotation_status`, `breach_check`, `weakness_report`
- [ ] Cascade: emits `secret.rotation_due` weekly; never reads or writes passwords

**Done when:** I drop a folder of last year's statements in, get a vault file with monthly cash-flow, see Subscriptions auto-detect at least 80% of my recurring charges, and get a weekly "rotate these 3 credentials" notification.

---

## Wave 2 — Wealth + work (weeks 5–8)

### 2.1 `domains/invest/`
- [ ] CSV import from brokerages (Wealthsimple, IBKR, etc.)
- [ ] Daily price refresh via yfinance + Alpha Vantage fallback
- [ ] Allocation drift vs. target (I set the target manually)
- [ ] **Mistake journal:** every closed position I tag with "what I'd do differently"; LLM clusters patterns quarterly
- [ ] Watchlist with threshold alerts (price, P/E, news)
- [ ] **No trade execution.** Surfaces signals only.
- [ ] MCP tools: `portfolio`, `drift`, `watchlist`, `mistake_journal`, `news_for(ticker)`

### 2.2 `domains/tasks/`
- [ ] Daily standup: today's calendar + top 3 tasks + overdue items
- [ ] Weekly review: what got done, what slipped, energy/focus patterns
- [ ] Pulls from Calendar + Gmail (action items) + Notion
- [ ] MCP tools: `today`, `upcoming(days)`, `weekly_review`

### 2.3 `domains/career/`
- [ ] Manual LinkedIn profile export → parsed to PKG
- [ ] I set a target role/level; agent does gap analysis vs. current
- [ ] Quarterly "what to do next" memo
- [ ] Watches relevant job feeds for fit
- [ ] MCP tools: `gap_analysis`, `quarterly_memo`, `opportunity_match`

**Done when:** I have a daily standup at 8am, a weekly portfolio drift report Sunday night, and a quarterly career memo I actually act on.

---

## Wave 3 — Family + ventures (weeks 9–14)

### 3.1 `domains/child/` (Ved)
- [ ] **Local model only** (Ollama). No cloud LLM unless I explicitly approve a single task.
- [ ] Schedule manager (ukulele, drums, swimming, biking, taekwondo)
- [ ] Milestone log: skill grades, school achievements, health notes
- [ ] Weekly summary to me/partner only
- [ ] Habit tracker for the things I want to instill (reading, water, kindness journal)
- [ ] **No third-party API ever sees school name + full name + schedule together.**
- [ ] MCP tools: `weekly_summary`, `log_milestone`, `schedule(day)`, `suggest_activity`

### 3.2 `domains/ventures/` (10 IG accounts)
- [ ] Instagram Graph API integration (requires business accounts via Meta app)
- [ ] Weekly per-account: reach, engagement, top post, drop alerts
- [ ] Content gap detection (themes underperforming across accounts)
- [ ] MCP tools: `weekly_perf(account)`, `content_gap`, `posting_cadence`

### 3.3 `domains/startups/`
- [ ] GitHub + Linear/Jira integration (via OpenHuman)
- [ ] One PKG node per project with a "north star metric"
- [ ] Weekly health: commits, open issues, last user touch, north-star delta
- [ ] MCP tools: `project_health`, `north_star(project)`, `quarterly_review`

**Done when:** I get a Sunday family digest (Ved's week + planned next week), Monday venture digest (10 IG accounts), and Friday startup digest.

---

## Wave 4 — The rest (weeks 15+)

### 4.1 `domains/health/`
- [ ] Apple Health / Google Fit import
- [ ] Quick-entry CLI: `oh log water 500ml`, `oh log protein 30g`
- [ ] Weekly trend, deficit/surplus on protein and key vitamins
- [ ] **No medical diagnosis.** Flags "talk to doctor" thresholds.

### 4.2 `domains/equipment/`
- [ ] PKG nodes for car, bike, laptops, expensive gear
- [ ] Service intervals → calendar reminders via Cascade Inbox
- [ ] Issues register (Markdown notes per item)
- [ ] Warranty expiry alerts

### 4.3 `domains/family-time/`
- [ ] Reads calendar + equipment.vehicle + weather
- [ ] "We haven't done X in N weeks" nudges
- [ ] Holiday/long-weekend planner with rough cost estimate from finance

### 4.4 `domains/brand/` (yprateek.com)
- [ ] Plausible/GA analytics import
- [ ] Content pipeline (drafts → scheduled → live), linked to career + ventures
- [ ] Audience report monthly

---

## After Wave 4 — Hardening

- Backup/restore of SQLite + vault (encrypted off-site)
- Mobile companion (Tauri mobile or a thin Flutter app) for quick-entry domains (health, family-time)
- Cross-domain "ask anything" prompt that fans out: "How are we doing this month?" → finance + invest + career + family-time
- Quarterly self-review: agent reads vault, drafts a "state of Prateek" doc

---

## What I will NOT do, ever

- Auto-place trades
- Store passwords
- Send messages on my behalf without explicit per-message approval
- Send Ved's data to cloud LLMs
- Skip the Cascade Inbox for money-affecting actions
- Merge upstream into my fork without a quarterly rebase ritual
