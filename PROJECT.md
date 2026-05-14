# PROJECT.md — Personal Life-OS (fork of `tinyhumansai/openhuman`)

> **Owner:** Prateek Yadav (Toronto)
> **Substrate:** Fork of [tinyhumansai/openhuman](https://github.com/tinyhumansai/openhuman)
> **Purpose:** A private, local-first agentic system that knows me across 13 life domains, links them like neurons, and proposes (never silently executes) actions that improve my finances, career, family time, health, and ventures.

---

## 1. Why a fork, not a rewrite

OpenHuman already ships ~60% of what I need:

- Local-first SQLite + Obsidian-compatible vault
- Memory Tree compression of arbitrary documents into ≤3k-token Markdown chunks
- 118+ OAuth integrations with 20-minute auto-fetch loop
- Model routing (Claude / fast / vision / local Ollama)
- TokenJuice compression to cut LLM cost
- Tauri desktop app with a mascot/voice front end

I am **not** rebuilding any of that. I extend it with:

1. A **Personal Knowledge Graph (PKG)** layer on top of the Memory Tree
2. An **Event Bus** that lets domains react to each other (the "neurons")
3. **13 domain agents**, each exposed as an MCP server
4. A **Cascade Inbox** UI for human-in-the-loop approval of cross-domain actions

---

## 2. Architecture — five layers

```
┌──────────────────────────────────────────────────────────────┐
│ L5  Orchestrator + UI  (OpenHuman chat, mascot, voice)       │
├──────────────────────────────────────────────────────────────┤
│ L4  Domain Agents (MCP servers, one per domain)              │
│     finance | invest | tasks | ventures | startups | health  │
│     career  | family | equip | secrets  | child | brand | subs│
├──────────────────────────────────────────────────────────────┤
│ L3  Event Bus  (tokio broadcast + persisted journal)         │
├──────────────────────────────────────────────────────────────┤
│ L2  Personal Knowledge Graph  (nodes + edges in SQLite)      │
├──────────────────────────────────────────────────────────────┤
│ L1  Substrate — OpenHuman (Tauri, SQLite, Memory Tree,       │
│                  Obsidian vault, OAuth, model router)        │
└──────────────────────────────────────────────────────────────┘
```

### L2 — Personal Knowledge Graph (the neurons)

Two SQLite tables. Everything is a node or an edge. JSON columns keep schemas flexible.

```sql
CREATE TABLE pkg_nodes (
  id          TEXT PRIMARY KEY,          -- 'person:prateek', 'account:rbc-chequing'
  type        TEXT NOT NULL,             -- person, account, holding, vehicle, ig_account, sub, credential, project, milestone, vendor, course, equipment
  label       TEXT NOT NULL,
  props       JSON NOT NULL,             -- type-specific properties
  source      TEXT,                      -- which domain wrote this
  confidence  REAL DEFAULT 1.0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE pkg_edges (
  id          TEXT PRIMARY KEY,
  from_id     TEXT NOT NULL REFERENCES pkg_nodes(id),
  to_id       TEXT NOT NULL REFERENCES pkg_nodes(id),
  rel         TEXT NOT NULL,             -- owns, pays_for, services, child_of, depends_on, expires_on, holds, drives, lives_at, learns
  props       JSON,
  created_at  INTEGER NOT NULL
);

CREATE INDEX idx_nodes_type ON pkg_nodes(type);
CREATE INDEX idx_edges_from ON pkg_edges(from_id, rel);
CREATE INDEX idx_edges_to   ON pkg_edges(to_id, rel);
```

**Why this and not a real graph DB:** keeps everything in the same SQLite OpenHuman already uses, no extra service to run, queries are fast enough for personal scale (10k–100k nodes max).

**Example nodes:**
- `person:prateek` `person:ved` `person:partner`
- `account:rbc-chequing` `account:wealthsimple-tfsa`
- `holding:tsla` `holding:vti`
- `vehicle:honda-civic-2019`
- `ig:@business-account-name`
- `sub:aws` `sub:claude` `sub:google-workspace`
- `credential:linkedin` (metadata only, NEVER the password)
- `project:yprateek-rebrand` `project:startup-foo`
- `milestone:ved-ukulele-grade1`

**Example edges:**
- `person:prateek -[owns]-> account:rbc-chequing`
- `account:rbc-chequing -[pays_for]-> sub:aws`
- `person:prateek -[holds]-> holding:tsla` (props: `{shares: 12, avg_cost: 215.40}`)
- `person:prateek -[child_of]-> person:ved` *(inverse: parent_of)*
- `vehicle:honda-civic-2019 -[services_due]-> milestone:oil-change-2026-q3`

### L3 — Event Bus

In-process `tokio::sync::broadcast` channel + a `pkg_events` SQLite table for replay/audit.

```rust
pub enum Event {
    NodeUpserted { node_id: String, by_domain: String },
    EdgeUpserted { edge_id: String, by_domain: String },
    DomainAlert  { domain: String, severity: Sev, summary: String, payload: JsonValue },
    ActionProposed { proposal_id: String, domain: String, action: ProposedAction },
}
```

Domains **subscribe** to events they care about. Example: when Finance emits `NodeUpserted` for a new `transaction` node tagged `subscription`, the Subscriptions domain picks it up, looks for an existing `sub:*` node by merchant name, and either updates renewal date or proposes a new `sub:*` node via the Cascade Inbox.

### L4 — Domain agents

Each domain is its own MCP server (TypeScript, using `@modelcontextprotocol/sdk`) living in `domains/<name>/`. Each exposes:

- **MCP tools** the orchestrator can call (`finance.query_spending`, `invest.show_drift`, etc.)
- **Cron jobs** registered in a central scheduler
- **Event handlers** subscribed via the bus
- **A SKILL.md** that documents its tools, schemas, and prompt patterns
- **A vault folder** at `vault/domains/<name>/` for its Obsidian notes

### L5 — Cascade Inbox (new UI primitive)

A single approval queue in the OpenHuman UI. Any action that touches money, Ved, external messages, or modifies the PKG cross-domain lands here. Each proposal has: *what*, *why*, *which domains will see the ripple*, *one-click approve / reject / edit*. Auto-approve is opt-in per action type.

---

## 3. The 13 domains

| # | Domain          | Wave | Primary integrations                               | Key MCP tools                                      |
|---|-----------------|------|----------------------------------------------------|----------------------------------------------------|
| 1 | finance         | 1    | Bank statement PDF, Flinks/Plaid, CSV              | import_statement, query_spending, monthly_report   |
| 2 | subscriptions   | 1    | Gmail receipts, finance.transactions               | list_subs, find_unused, suggest_cancel             |
| 3 | secrets         | 1    | Bitwarden/1Password API, HaveIBeenPwned            | rotation_status, breach_check (NO password storage)|
| 4 | invest          | 2    | Brokerage CSV, yfinance, Alpha Vantage             | portfolio, drift, watchlist, mistake_journal       |
| 5 | tasks           | 2    | Gmail, Google Calendar, Notion                     | today, upcoming, weekly_review                     |
| 6 | career          | 2    | LinkedIn (manual export), yprateek.com analytics   | gap_analysis, opportunity_match                    |
| 7 | child (Ved)     | 3    | Local notes, calendar, manual entry                | weekly_summary, milestone_log, schedule            |
| 8 | ventures (IG)   | 3    | Instagram Graph API (business accounts)            | weekly_perf, content_gap                           |
| 9 | startups        | 3    | GitHub, Linear, Notion                             | project_health, north_star                         |
| 10| health          | 4    | Apple Health / Google Fit, manual quick-entry      | log_intake, weekly_trend                           |
| 11| equipment       | 4    | Manual catalog, calendar reminders                 | due_service, warranty_alerts, issues_register      |
| 12| family-time     | 4    | Calendar, equipment.vehicle, weather               | suggest_outing, last_did                           |
| 13| brand           | 4    | yprateek.com (Plausible/GA), career, ventures      | content_pipeline, audience_report                  |

---

## 4. Repository layout

```
openhuman-prateek/                # fork
├─ src/                           # OpenHuman core (unchanged where possible)
├─ packages/
│  ├─ pkg-graph/                  # NEW — Rust crate, the knowledge graph
│  ├─ event-bus/                  # NEW — Rust crate, broadcast + persisted journal
│  ├─ cascade-inbox/              # NEW — UI component for approvals
│  └─ domain-sdk/                 # NEW — TS helpers for building domain MCPs
├─ domains/                       # NEW — one folder per domain
│  ├─ finance/
│  │  ├─ SKILL.md
│  │  ├─ src/server.ts            # MCP server
│  │  ├─ src/handlers/
│  │  ├─ schemas/                 # zod schemas for transaction, statement, etc.
│  │  └─ tests/
│  ├─ subscriptions/
│  ├─ secrets/
│  └─ ...                          # 10 more, added wave by wave
├─ vault/                         # Obsidian-compatible markdown vault
│  ├─ domains/
│  ├─ people/
│  ├─ daily/
│  └─ projects/
├─ docs/
│  ├─ pkg-schema.md
│  ├─ event-catalog.md
│  └─ cascade-rules.md
├─ PROJECT.md                     # this file
├─ ROADMAP.md
└─ CLAUDE.md                      # tells Claude Code how to work in this repo
```

---

## 5. Non-negotiable principles

1. **Local-first.** Nothing leaves my machine without an explicit allow-list. Cloud LLM calls go through TokenJuice and never include raw credentials, full bank numbers, Ved's school name, or Instagram DMs.
2. **No password storage.** `secrets` domain is a coach over Bitwarden/1Password, not a vault.
3. **No autonomous trades.** `invest` surfaces signals and drift; I place orders manually.
4. **Human-in-the-loop for cascades.** Any cross-domain action that affects money, Ved, or external systems goes through the Cascade Inbox. Auto-approve is opt-in per action class.
5. **Child data is most-protected.** `child` domain runs on the local model (Ollama) by default; cloud LLM only on explicit per-task approval. No third-party API ever sees Ved's full name + school + schedule together.
6. **Audit everything.** Every PKG write, every event, every LLM call is journaled to SQLite. I can replay any decision.
7. **Schemas over prose.** Every domain validates inputs/outputs with zod (TS) or serde (Rust). No "the LLM will figure it out."
8. **One change, traced ripples.** When domain A writes a node, the event bus shows me which domains reacted, what they proposed, and what I approved.

---

## 6. Migration plan from upstream OpenHuman

| Concern                       | Approach                                                     |
|-------------------------------|--------------------------------------------------------------|
| Memory Tree                   | **Reuse as-is.** Domain agents write Markdown to vault, MT compresses. |
| OAuth integrations            | **Reuse + extend.** Add Flinks (Canadian banks), Instagram Graph API, Plausible. |
| Model router                  | **Extend.** Add per-domain policy (e.g., `child` → local only). |
| Mascot / voice                | **Reuse.** Optional, for daily standup voice digest.        |
| SQLite                        | **Extend.** Add `pkg_nodes`, `pkg_edges`, `pkg_events` tables; never modify upstream tables. |
| Auto-fetch loop               | **Extend.** Register one fetcher per domain.                |
| Obsidian vault                | **Reuse.** Add `vault/domains/<name>/` subfolders.          |
| Upstream upgrades             | Keep upstream as `origin`, my fork as `prateek`. Rebase quarterly. All my code lives in `packages/pkg-*`, `domains/`, never inside upstream `src/`. |

---

## 7. Definition of done (per domain)

A domain is "done for wave N" when:

- ✅ SKILL.md exists with tool catalog + prompt patterns
- ✅ MCP server boots and is registered with the orchestrator
- ✅ Schemas (zod) cover all inputs/outputs
- ✅ At least one auto-fetch cron is wired
- ✅ At least one event subscription handles ripples from other domains
- ✅ Writes are journaled in `pkg_events`
- ✅ A vault folder accumulates human-readable notes
- ✅ Tests cover the happy path + one failure mode
- ✅ Cascade rules added to `docs/cascade-rules.md`

---

## 8. What this project is NOT

- Not a SaaS, not multi-tenant, not for sharing.
- Not a robo-advisor.
- Not a password manager.
- Not a replacement for Bitwarden, Notion, Google Calendar, or Bitwarden. It *coordinates* them.
- Not a finished product — it grows with my life. The roadmap is a living document.
