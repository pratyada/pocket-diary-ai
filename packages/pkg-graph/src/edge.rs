use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;

use crate::error::{PkgError, Result};
use crate::event::journal;
use crate::node;

/// An edge connecting two nodes in the PKG.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PkgEdge {
    pub id: String,
    pub from_id: String,
    pub to_id: String,
    pub rel: String,
    pub props: Option<JsonValue>,
    pub created_at: i64,
}

pub fn insert(conn: &Connection, edge: &PkgEdge, domain: &str) -> Result<()> {
    // Verify both endpoints exist
    if !node::exists(conn, &edge.from_id)? {
        return Err(PkgError::MissingNode(edge.from_id.clone()));
    }
    if !node::exists(conn, &edge.to_id)? {
        return Err(PkgError::MissingNode(edge.to_id.clone()));
    }

    let props_str = edge
        .props
        .as_ref()
        .map(|p| serde_json::to_string(p).unwrap())
        .unwrap_or_else(|| "{}".to_string());

    conn.execute(
        "INSERT INTO pkg_edges (id, from_id, to_id, rel, props, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![edge.id, edge.from_id, edge.to_id, edge.rel, props_str, edge.created_at],
    )?;

    let payload = serde_json::json!({
        "from_id": edge.from_id,
        "to_id": edge.to_id,
        "rel": edge.rel,
    });
    journal(conn, "edge_created", &edge.id, domain, &payload)?;
    Ok(())
}

pub fn get(conn: &Connection, id: &str) -> Result<PkgEdge> {
    conn.query_row(
        "SELECT id, from_id, to_id, rel, props, created_at
         FROM pkg_edges WHERE id = ?1",
        params![id],
        |row| {
            Ok(PkgEdge {
                id: row.get(0)?,
                from_id: row.get(1)?,
                to_id: row.get(2)?,
                rel: row.get(3)?,
                props: row
                    .get::<_, Option<String>>(4)?
                    .and_then(|s| serde_json::from_str(&s).ok()),
                created_at: row.get(5)?,
            })
        },
    )
    .optional()?
    .ok_or_else(|| PkgError::EdgeNotFound(id.to_string()))
}

pub fn edges_from(conn: &Connection, node_id: &str, rel: Option<&str>) -> Result<Vec<PkgEdge>> {
    let (sql, params_vec): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = match rel {
        Some(r) => (
            "SELECT id, from_id, to_id, rel, props, created_at
             FROM pkg_edges WHERE from_id = ?1 AND rel = ?2"
                .to_string(),
            vec![Box::new(node_id.to_string()), Box::new(r.to_string())],
        ),
        None => (
            "SELECT id, from_id, to_id, rel, props, created_at
             FROM pkg_edges WHERE from_id = ?1"
                .to_string(),
            vec![Box::new(node_id.to_string())],
        ),
    };

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(param_refs.as_slice(), |row| {
        Ok(PkgEdge {
            id: row.get(0)?,
            from_id: row.get(1)?,
            to_id: row.get(2)?,
            rel: row.get(3)?,
            props: row
                .get::<_, Option<String>>(4)?
                .and_then(|s| serde_json::from_str(&s).ok()),
            created_at: row.get(5)?,
        })
    })?;

    let mut edges = Vec::new();
    for row in rows {
        edges.push(row?);
    }
    Ok(edges)
}

pub fn edges_to(conn: &Connection, node_id: &str, rel: Option<&str>) -> Result<Vec<PkgEdge>> {
    let (sql, params_vec): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = match rel {
        Some(r) => (
            "SELECT id, from_id, to_id, rel, props, created_at
             FROM pkg_edges WHERE to_id = ?1 AND rel = ?2"
                .to_string(),
            vec![Box::new(node_id.to_string()), Box::new(r.to_string())],
        ),
        None => (
            "SELECT id, from_id, to_id, rel, props, created_at
             FROM pkg_edges WHERE to_id = ?1"
                .to_string(),
            vec![Box::new(node_id.to_string())],
        ),
    };

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(param_refs.as_slice(), |row| {
        Ok(PkgEdge {
            id: row.get(0)?,
            from_id: row.get(1)?,
            to_id: row.get(2)?,
            rel: row.get(3)?,
            props: row
                .get::<_, Option<String>>(4)?
                .and_then(|s| serde_json::from_str(&s).ok()),
            created_at: row.get(5)?,
        })
    })?;

    let mut edges = Vec::new();
    for row in rows {
        edges.push(row?);
    }
    Ok(edges)
}

pub fn delete(conn: &Connection, id: &str) -> Result<()> {
    let changed = conn.execute("DELETE FROM pkg_edges WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(PkgError::EdgeNotFound(id.to_string()));
    }
    Ok(())
}

/// Create an edge with an auto-generated ID.
pub fn connect(
    conn: &Connection,
    from_id: &str,
    to_id: &str,
    rel: &str,
    props: Option<JsonValue>,
    domain: &str,
) -> Result<String> {
    let id = format!("edge:{}", Uuid::new_v4());
    let edge = PkgEdge {
        id: id.clone(),
        from_id: from_id.to_string(),
        to_id: to_id.to_string(),
        rel: rel.to_string(),
        props,
        created_at: Utc::now().timestamp(),
    };
    insert(conn, &edge, domain)?;
    Ok(id)
}
