# PROJECT.md — Pocket Diary AI

> **Owner:** Prateek Yadav (Toronto)
> **Repo:** [pratyada/pocket-diary-ai](https://github.com/pratyada/pocket-diary-ai)
> **Inspired by:** [OpenHuman](https://github.com/tinyhumansai/openhuman) (substrate layer)
> **Purpose:** A private, local-first agentic system that knows me across 13 life domains, links them like neurons, and proposes (never silently executes) actions that improve my finances, career, family time, health, and ventures.

---

## 1. What is Pocket Diary AI?

Pocket Diary AI is a personal life operating system. It's an AI-powered desktop app that acts as a private command center for every aspect of life. The substrate layer is inspired by OpenHuman's architecture (Tauri + SQLite + Memory Tree), but Pocket Diary AI is its own product — built for one person, by one person.

It extends the substrate with:

1. A **Personal Knowledge Graph (PKG)** — everything is a node, every relationship is an edge
2. An **Event Bus** — domains react to each other's changes in real-time
3. **13 domain agents** — each a specialized MCP server for one slice of life
4. A **Cascade Inbox** — human-in-the-loop approval for anything that touches money, family, or external systems

Think of it as a private brain that connects your bank accounts, investments, subscriptions, credentials, family schedule, side projects, and health data — and surfaces insights you'd never see looking at each in isolation.

---

## 2. Architecture — five layers

```
+--------------------------------------------------------------+
| L5  Orchestrator + UI  (Desktop app, chat, voice)            |
+--------------------------------------------------------------+
| L4  Domain Agents (MCP servers, one per domain)              |
|     finance | invest | tasks | ventures | startups | health  |
|     career  | family | equip | secrets  | child | brand | subs|
+--------------------------------------------------------------+
| L3  Event Bus  (tokio broadcast + persisted journal)         |
+--------------------------------------------------------------+
| L2  Personal Knowledge Graph  (nodes + edges in SQLite)      |
+--------------------------------------------------------------+
| L1  Substrate  (Tauri, SQLite, Memory Tree,                  |
|                 Obsidian vault, OAuth, model router)          |
+--------------------------------------------------------------+
```

### L2 — Personal Knowledge Graph (the neurons)

Two SQLite tables. Everything is a node or an edge. JSON columns keep schemas flexible.

```sql
CREATE TABLE pkg_nodes (
  id          TEXT PRIMARY KEY,          -- 'person:prateek', 'account:rbc-chequing'
  type        TEXT NOT NULL,             -- person, account, holding, vehicle, etc.
  label       TEXT NOT NULL,
  props       JSON NOT NULL,
  source      TEXT,                      -- which domain wrote this
  confidence  REAL DEFAULT 1.0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE pkg_edges (
  id          TEXT PRIMARY KEY,
  from_id     TEXT NOT NULL REFERENCES pkg_nodes(id),
  to_id       TEXT NOT NULL REFERENCES pkg_nodes(id),
  rel         TEXT NOT NULL,             -- owns, pays_for, child_of, holds, learns
  props       JSON,
  created_at  INTEGER NOT NULL
);
```

**Why SQLite, not a graph DB:** keeps everything local, no extra service, fast enough for personal scale (10k-100k nodes).

**Example nodes:** `person:prateek`, `account:rbc-chequing`, `holding:tsla`, `sub:aws`, `credential:linkedin`, `vehicle:honda-civic-2019`, `project:startup-foo`, `milestone:ved-ukulele-grade1`

**Example edges:** `person:prateek -[owns]-> account:rbc-chequing`, `account:rbc -[pays_for]-> sub:aws`, `person:prateek -[parent_of]-> person:ved`

### L3 — Event Bus

When Finance imports a statement, Subscriptions detects a recurring charge. When a credential ages past 365 days, Secrets flags it. The event bus makes domains aware of each other.

### L4 — Domain Agents

Each domain is its own MCP server (TypeScript) in `domains/<name>/`. Each exposes MCP tools, cron jobs, event handlers, a SKILL.md, and a vault folder.

### L5 — Cascade Inbox

A single approval queue. Any action that touches money, Ved, external messages, or modifies the PKG cross-domain lands here with: *what*, *why*, *which domains will see the ripple*, *one-click approve / reject / edit*.

---

## 3. The 13 domains

| # | Domain          | Status | Key capabilities |
|---|-----------------|--------|------------------|
| 1 | **finance**     | Built  | Statement import (PDF/CSV), spending analysis, investments (TFSA/RRSP/RESP), market data (NASDAQ/TSX/NIFTY), mistake journal, multi-currency (CAD/USD/INR), 15 MCP tools |
| 2 | subscriptions   | Wave 1 | Auto-detect recurring charges, zombie detection, renewal alerts |
| 3 | secrets         | Wave 1 | Credential rotation coach, breach monitoring (NO password storage) |
| 4 | invest          | Wave 2 | Brokerage CSV import, allocation drift, watchlist alerts |
| 5 | tasks           | Wave 2 | Daily standup, weekly review, calendar + Gmail + Notion |
| 6 | career          | Wave 2 | Gap analysis, opportunity matching, quarterly career memo |
| 7 | child (Ved)     | Wave 3 | Schedule, milestones, habit tracking (LOCAL MODEL ONLY) |
| 8 | ventures (IG)   | Wave 3 | Instagram analytics, content gap detection |
| 9 | startups        | Wave 3 | GitHub/Linear integration, north-star tracking |
| 10| health          | Wave 4 | Apple Health import, intake logging, weekly trends |
| 11| equipment       | Wave 4 | Service intervals, warranty alerts, issues register |
| 12| family-time     | Wave 4 | Activity suggestions, "we haven't done X" nudges |
| 13| brand           | Wave 4 | yprateek.com analytics, content pipeline |

---

## 4. Repository layout

```
pocket-diary-ai/
+-- packages/
|   +-- pkg-graph/              -- Rust crate: Personal Knowledge Graph (21 tests)
+-- domains/
|   +-- finance/                -- 15 MCP tools, 19 tests, full SKILL.md
+-- vault/                      -- Obsidian-compatible Markdown vault (gitignored)
+-- docs/
|   +-- pkg-schema.md           -- PKG node/edge/event catalogs
+-- src/                        -- Substrate layer (inspired by OpenHuman)
+-- app/                        -- Desktop app (Tauri + React)
+-- PROJECT.md                  -- this file
+-- ROADMAP.md
+-- CLAUDE.md
+-- README.md
```

---

## 5. Non-negotiable principles

1. **Local-first.** Nothing leaves my machine without an explicit allow-list.
2. **No password storage.** `secrets` domain is a coach, not a vault.
3. **No autonomous trades.** `invest` surfaces signals; I place orders manually.
4. **Human-in-the-loop.** Money, Ved, and external actions go through the Cascade Inbox.
5. **Child data is most-protected.** `child` domain runs on Ollama by default.
6. **Audit everything.** Every PKG write, event, and LLM call is journaled.
7. **Schemas over prose.** zod (TS) and serde (Rust) validate all I/O.
8. **One change, traced ripples.** The event bus shows what reacted to what.

---

## 6. What Pocket Diary AI is NOT

- Not a SaaS, not multi-tenant, not for sharing
- Not a robo-advisor or a password manager
- Not a replacement for any tool — it *coordinates* them
- Not a finished product — it grows with my life
