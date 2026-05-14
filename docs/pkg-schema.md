# pkg-schema.md — Pocket Diary AI: Personal Knowledge Graph Schema

> Crate: `packages/pkg-graph/` | Database: `pkg.db` (SQLite, WAL mode) | Part of [Pocket Diary AI](https://github.com/pratyada/pocket-diary-ai)

---

## Tables

### `pkg_nodes` — Everything is a node

| Column       | Type    | Description                                           |
|-------------|---------|-------------------------------------------------------|
| `id`        | TEXT PK | Namespaced ID: `type:slug` (e.g. `person:prateek`)   |
| `type`      | TEXT    | Node type (see catalog below)                         |
| `label`     | TEXT    | Human-readable display name                           |
| `props`     | JSON    | Type-specific properties (flexible schema)            |
| `source`    | TEXT    | Which domain created/last wrote this node             |
| `confidence`| REAL    | 0.0–1.0, how certain we are about this data           |
| `created_at`| INTEGER | Unix timestamp                                        |
| `updated_at`| INTEGER | Unix timestamp                                        |

**Indexes:** `idx_pkg_nodes_type` on `(type)`

### `pkg_edges` — Relationships between nodes

| Column       | Type    | Description                                           |
|-------------|---------|-------------------------------------------------------|
| `id`        | TEXT PK | Edge ID (auto: `edge:<uuid>` or manual)               |
| `from_id`   | TEXT FK | Source node ID (references `pkg_nodes.id`)            |
| `to_id`     | TEXT FK | Target node ID (references `pkg_nodes.id`)            |
| `rel`       | TEXT    | Relationship type (see catalog below)                 |
| `props`     | JSON    | Edge-specific properties                              |
| `created_at`| INTEGER | Unix timestamp                                        |

**Indexes:** `idx_pkg_edges_from` on `(from_id, rel)`, `idx_pkg_edges_to` on `(to_id, rel)`

### `pkg_events` — Audit journal

| Column       | Type       | Description                                        |
|-------------|------------|----------------------------------------------------|
| `id`        | INTEGER PK | Auto-increment, monotonic for replay ordering      |
| `event_type`| TEXT       | What happened (see event catalog)                  |
| `entity_id` | TEXT       | Which node or edge was affected                    |
| `domain`    | TEXT       | Which domain triggered this event                  |
| `payload`   | JSON       | Event-specific data                                |
| `created_at`| INTEGER    | Unix timestamp                                     |

**Indexes:** `idx_pkg_events_entity`, `idx_pkg_events_domain`, `idx_pkg_events_type`

---

## Node type catalog

| Type         | ID pattern                    | Example                              | Used by domains         |
|-------------|-------------------------------|--------------------------------------|------------------------|
| `person`    | `person:<slug>`               | `person:prateek`, `person:ved`       | child, family-time     |
| `account`   | `account:<bank>-<type>`       | `account:rbc-chequing`               | finance                |
| `holding`   | `holding:<ticker>`            | `holding:tsla`, `holding:vti`        | invest                 |
| `merchant`  | `merchant:<normalized-name>`  | `merchant:amazon`, `merchant:costco` | finance                |
| `sub`       | `sub:<service>`               | `sub:aws`, `sub:claude`              | subscriptions          |
| `credential`| `credential:<sha256(name)>`   | `credential:a1b2c3...`              | secrets                |
| `breach`    | `breach:<domain>`             | `breach:linkedin.com`                | secrets                |
| `vehicle`   | `vehicle:<make>-<model>-<yr>` | `vehicle:honda-civic-2019`           | equipment              |
| `equipment` | `equipment:<slug>`            | `equipment:macbook-m2`               | equipment              |
| `project`   | `project:<slug>`              | `project:openbookai`                 | startups               |
| `milestone` | `milestone:<slug>`            | `milestone:ved-ukulele-grade1`       | child, startups        |
| `ig`        | `ig:<handle>`                 | `ig:@business-account`               | ventures               |
| `course`    | `course:<slug>`               | `course:taekwondo`                   | child                  |

---

## Relationship catalog

| Relationship     | From → To                        | Example                                           |
|-----------------|----------------------------------|----------------------------------------------------|
| `owns`          | person → account/vehicle/equip   | `person:prateek -[owns]-> account:rbc-chequing`    |
| `holds`         | person → holding                 | `person:prateek -[holds]-> holding:tsla`           |
| `pays_for`      | account → sub                    | `account:rbc-chequing -[pays_for]-> sub:aws`       |
| `parent_of`     | person → person                  | `person:prateek -[parent_of]-> person:ved`         |
| `child_of`      | person → person                  | `person:ved -[child_of]-> person:prateek`          |
| `services`      | vendor → vehicle/equipment       | `merchant:honda-dealer -[services]-> vehicle:...`  |
| `services_due`  | vehicle/equip → milestone        | `vehicle:honda-civic-2019 -[services_due]-> ...`   |
| `depends_on`    | project → project/sub            | `project:startup -[depends_on]-> sub:aws`          |
| `expires_on`    | credential/sub → (date in props) | Edge props carry expiry date                       |
| `drives`        | person → vehicle                 | `person:prateek -[drives]-> vehicle:honda-...`     |
| `learns`        | person → course                  | `person:ved -[learns]-> course:ukulele`            |
| `manages`       | person → ig                      | `person:prateek -[manages]-> ig:@business`         |
| `works_on`      | person → project                 | `person:prateek -[works_on]-> project:openbookai`  |

---

## Event type catalog

| Event type        | Triggered by     | Payload                                    |
|------------------|------------------|--------------------------------------------|
| `node_upserted`  | node upsert      | Full node props                            |
| `edge_created`   | edge insert      | `{from_id, to_id, rel}`                   |

*More event types will be added as domains are built (e.g. `transaction.imported`, `anomaly.detected`, `secret.rotation_due`).*

---

## API (Rust)

```rust
use pkg_graph::PkgGraph;

// Open or create
let g = PkgGraph::open(Path::new("./pkg.db"))?;

// Nodes
g.insert_node(&node)?;
g.upsert_node(&node, "finance")?;   // creates + journals event
g.get_node("person:prateek")?;
g.get_nodes_by_type("account")?;
g.delete_node("person:prateek")?;   // cascades edge deletion

// Edges
g.connect("person:prateek", "account:rbc", "owns", None, "finance")?;
g.edges_from("person:prateek", Some("owns"))?;
g.edges_to("account:rbc", None)?;

// Traversal
g.find_neighbors("person:prateek", None, Some(2))?;  // BFS up to depth 2
g.find_path("person:prateek", "sub:aws", 5)?;         // shortest path

// Event journal
g.events_for("account:rbc")?;         // all events for an entity
g.events_by_domain("finance")?;       // all events from a domain
g.events_since(last_seen_id)?;        // replay/catch-up
```
