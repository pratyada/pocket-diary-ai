use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use crate::error::Result;

/// A journaled event from the PKG.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PkgEvent {
    pub id: i64,
    pub event_type: String,
    pub entity_id: String,
    pub domain: String,
    pub payload: JsonValue,
    pub created_at: i64,
}

/// Write an event to the journal. Called internally by node/edge mutations.
pub fn journal(
    conn: &Connection,
    event_type: &str,
    entity_id: &str,
    domain: &str,
    payload: &JsonValue,
) -> Result<i64> {
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "INSERT INTO pkg_events (event_type, entity_id, domain, payload, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            event_type,
            entity_id,
            domain,
            serde_json::to_string(payload)?,
            now,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Replay events for a given entity, oldest first.
pub fn events_for(conn: &Connection, entity_id: &str) -> Result<Vec<PkgEvent>> {
    let mut stmt = conn.prepare(
        "SELECT id, event_type, entity_id, domain, payload, created_at
         FROM pkg_events WHERE entity_id = ?1 ORDER BY id ASC",
    )?;

    let rows = stmt.query_map(params![entity_id], |row| {
        Ok(PkgEvent {
            id: row.get(0)?,
            event_type: row.get(1)?,
            entity_id: row.get(2)?,
            domain: row.get(3)?,
            payload: serde_json::from_str::<JsonValue>(&row.get::<_, String>(4)?).unwrap_or_default(),
            created_at: row.get(5)?,
        })
    })?;

    let mut events = Vec::new();
    for row in rows {
        events.push(row?);
    }
    Ok(events)
}

/// Replay events by domain, oldest first.
pub fn events_by_domain(conn: &Connection, domain: &str) -> Result<Vec<PkgEvent>> {
    let mut stmt = conn.prepare(
        "SELECT id, event_type, entity_id, domain, payload, created_at
         FROM pkg_events WHERE domain = ?1 ORDER BY id ASC",
    )?;

    let rows = stmt.query_map(params![domain], |row| {
        Ok(PkgEvent {
            id: row.get(0)?,
            event_type: row.get(1)?,
            entity_id: row.get(2)?,
            domain: row.get(3)?,
            payload: serde_json::from_str::<JsonValue>(&row.get::<_, String>(4)?).unwrap_or_default(),
            created_at: row.get(5)?,
        })
    })?;

    let mut events = Vec::new();
    for row in rows {
        events.push(row?);
    }
    Ok(events)
}

/// Get events since a given event ID (exclusive), for replay/catch-up.
pub fn events_since(conn: &Connection, after_id: i64) -> Result<Vec<PkgEvent>> {
    let mut stmt = conn.prepare(
        "SELECT id, event_type, entity_id, domain, payload, created_at
         FROM pkg_events WHERE id > ?1 ORDER BY id ASC",
    )?;

    let rows = stmt.query_map(params![after_id], |row| {
        Ok(PkgEvent {
            id: row.get(0)?,
            event_type: row.get(1)?,
            entity_id: row.get(2)?,
            domain: row.get(3)?,
            payload: serde_json::from_str::<JsonValue>(&row.get::<_, String>(4)?).unwrap_or_default(),
            created_at: row.get(5)?,
        })
    })?;

    let mut events = Vec::new();
    for row in rows {
        events.push(row?);
    }
    Ok(events)
}
