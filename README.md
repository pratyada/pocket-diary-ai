# Pocket Diary AI

**A private, local-first life operating system -- 13 AI agents that connect every corner of your life.**

Pocket Diary AI is a personal command center built as a desktop app. It tracks finances across three countries, monitors investments, coaches credential hygiene, manages family schedules, and surfaces insights you'd never see looking at each area in isolation.

Everything stays on your machine. The AI proposes, you approve. No cloud, no SaaS, no shared data.

Inspired by [OpenHuman](https://github.com/tinyhumansai/openhuman).

---

## What it does

| Domain | Status | What it handles |
|--------|--------|----------------|
| **Finance** | Built | Bank statement import (PDF/CSV), spending analysis, investments (TFSA/RRSP/RESP), market data (NASDAQ/TSX/NIFTY), mistake journal, multi-currency (CAD/USD/INR), monthly reports |
| Subscriptions | Planned | Auto-detect recurring charges, zombie subscriptions, renewal alerts |
| Secrets | Planned | Credential rotation coaching, breach monitoring (never stores passwords) |
| Invest | Planned | Portfolio drift, watchlist alerts, mistake pattern analysis |
| Tasks | Planned | Daily standup, weekly review, calendar/email/Notion integration |
| Career | Planned | Gap analysis, opportunity matching, quarterly career memos |
| Child | Planned | Schedule, milestones, habits (local AI only, never cloud) |
| Ventures | Planned | Instagram analytics for business accounts |
| Startups | Planned | GitHub/Linear tracking, north-star metrics |
| Health | Planned | Apple Health import, intake logging, weekly trends |
| Equipment | Planned | Service intervals, warranty alerts |
| Family Time | Planned | Activity suggestions, weather-aware planning |
| Brand | Planned | Website analytics, content pipeline |

---

## Architecture

```
+--------------------------------------------------------------+
| Desktop App (Tauri + React)                                  |
+--------------------------------------------------------------+
| Domain Agents (MCP servers, one per life area)               |
+--------------------------------------------------------------+
| Event Bus (cross-domain reactions, audited)                  |
+--------------------------------------------------------------+
| Personal Knowledge Graph (nodes + edges in SQLite)           |
+--------------------------------------------------------------+
| Local-first substrate (SQLite, Obsidian vault, model router) |
+--------------------------------------------------------------+
```

**Personal Knowledge Graph** -- Everything is a node (`person:prateek`, `account:rbc-chequing`, `holding:tsla`, `sub:netflix`). Relationships are edges (`owns`, `pays_for`, `parent_of`). All in SQLite, all on your machine.

**Event Bus** -- When Finance imports a transaction, Subscriptions detects a recurring charge. When a credential ages past a year, Secrets flags it. Domains react to each other without coupling.

**Cascade Inbox** -- Any action touching money, family, or external systems requires your approval. The AI proposes, you decide.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Desktop | Tauri v2 + React 19 |
| Core | Rust (2021 edition) |
| Knowledge Graph | Rust crate (`packages/pkg-graph/`), SQLite |
| Domain agents | TypeScript, zod schemas, vitest |
| Market data | Yahoo Finance (NASDAQ, TSX, NIFTY) |
| Database | SQLite (WAL mode, local-first) |
| Vault | Obsidian-compatible Markdown |
| AI routing | Local (Ollama) + Cloud (Anthropic) with privacy classes |

---

## Getting started

```bash
# Clone
git clone git@github.com:pratyada/pocket-diary-ai.git
cd pocket-diary-ai

# Substrate (desktop app)
pnpm install
pnpm dev

# Pocket Diary AI packages (knowledge graph)
cd packages && cargo test

# Finance domain
cd domains/finance
npm install
npm test
```

---

## Project structure

```
pocket-diary-ai/
+-- packages/
|   +-- pkg-graph/              -- Personal Knowledge Graph (Rust, 21 tests)
+-- domains/
|   +-- finance/                -- Finance domain (TS, 15 tools, 19 tests)
|       +-- SKILL.md            -- Domain spec
|       +-- schemas/            -- zod schemas
|       +-- src/                -- MCP server + handlers
|       +-- tests/              -- vitest tests
+-- vault/                      -- Obsidian vault (gitignored, personal data)
+-- docs/                       -- Architecture docs
+-- src/                        -- Substrate Rust core
+-- app/                        -- Desktop app (Tauri + React)
```

---

## Principles

1. **Local-first** -- Nothing leaves your machine without explicit approval
2. **Human-in-the-loop** -- Money, family, and external actions go through the Cascade Inbox
3. **No password storage** -- The secrets domain coaches rotation, never touches passwords
4. **No autonomous trading** -- Investment domain surfaces signals, you place orders
5. **Child data is sacred** -- Processed on local models only, never sent to cloud
6. **Audit trail** -- Every change is journaled to SQLite
7. **Schemas over vibes** -- Every domain validates I/O with zod or serde

---

## Privacy model

| Class | What it means | Domains |
|-------|--------------|---------|
| `cloud-ok` | Can use cloud AI after data compression | tasks, brand, career |
| `local-preferred` | Local model first, cloud only if needed | finance, invest, subs, equipment, family-time, ventures, startups |
| `local-only` | Never leaves the machine | child, secrets, health |

---

## Built by

**Prateek Yadav** -- Toronto, Canada

Inspired by [OpenHuman](https://github.com/tinyhumansai/openhuman).

---

*Pocket Diary AI is a personal project. It's not a SaaS, not multi-tenant, not for distribution. It grows with one life.*
