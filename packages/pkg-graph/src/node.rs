use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use crate::error::{PkgError, Result};
use crate::event::journal;

/// A node in the Personal Knowledge Graph.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PkgNode {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub label: String,
    pub props: JsonValue,
    pub source: Option<String>,
    pub confidence: f64,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Fields that can be updated on an existing node.
pub struct NodeUpdate {
    pub label: Option<String>,
    pub props: Option<JsonValue>,
    pub source: Option<String>,
    pub confidence: Option<f64>,
}

pub fn insert(conn: &Connection, node: &PkgNode) -> Result<()> {
    let result = conn.execute(
        "INSERT INTO pkg_nodes (id, type, label, props, source, confidence, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            node.id,
            node.node_type,
            node.label,
            serde_json::to_string(&node.props)?,
            node.source,
            node.confidence,
            node.created_at,
            node.updated_at,
        ],
    );

    match result {
        Ok(_) => Ok(()),
        Err(rusqlite::Error::SqliteFailure(err, _))
            if err.code == rusqlite::ErrorCode::ConstraintViolation =>
        {
            Err(PkgError::DuplicateNode(node.id.clone()))
        }
        Err(e) => Err(PkgError::Db(e)),
    }
}

pub fn upsert(conn: &Connection, node: &PkgNode, domain: &str) -> Result<()> {
    let now = Utc::now().timestamp();
    conn.execute(
        "INSERT INTO pkg_nodes (id, type, label, props, source, confidence, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET
            label = excluded.label,
            props = excluded.props,
            source = excluded.source,
            confidence = excluded.confidence,
            updated_at = ?8",
        params![
            node.id,
            node.node_type,
            node.label,
            serde_json::to_string(&node.props)?,
            node.source,
            node.confidence,
            node.created_at,
            now,
        ],
    )?;

    journal(conn, "node_upserted", &node.id, domain, &node.props)?;
    Ok(())
}

pub fn get(conn: &Connection, id: &str) -> Result<PkgNode> {
    conn.query_row(
        "SELECT id, type, label, props, source, confidence, created_at, updated_at
         FROM pkg_nodes WHERE id = ?1",
        params![id],
        |row| {
            Ok(PkgNode {
                id: row.get(0)?,
                node_type: row.get(1)?,
                label: row.get(2)?,
                props: serde_json::from_str::<JsonValue>(&row.get::<_, String>(3)?).unwrap_or_default(),
                source: row.get(4)?,
                confidence: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        },
    )
    .optional()?
    .ok_or_else(|| PkgError::NodeNotFound(id.to_string()))
}

pub fn get_by_type(conn: &Connection, node_type: &str) -> Result<Vec<PkgNode>> {
    let mut stmt = conn.prepare(
        "SELECT id, type, label, props, source, confidence, created_at, updated_at
         FROM pkg_nodes WHERE type = ?1 ORDER BY updated_at DESC",
    )?;

    let rows = stmt.query_map(params![node_type], |row| {
        Ok(PkgNode {
            id: row.get(0)?,
            node_type: row.get(1)?,
            label: row.get(2)?,
            props: serde_json::from_str::<JsonValue>(&row.get::<_, String>(3)?).unwrap_or_default(),
            source: row.get(4)?,
            confidence: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })?;

    let mut nodes = Vec::new();
    for row in rows {
        nodes.push(row?);
    }
    Ok(nodes)
}

pub fn update(conn: &Connection, id: &str, upd: &NodeUpdate) -> Result<()> {
    // Verify exists
    let _ = get(conn, id)?;

    let now = Utc::now().timestamp();
    let mut sets = vec!["updated_at = ?1".to_string()];
    let mut param_idx = 2u32;
    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(now)];

    if let Some(ref label) = upd.label {
        sets.push(format!("label = ?{param_idx}"));
        params_vec.push(Box::new(label.clone()));
        param_idx += 1;
    }
    if let Some(ref props) = upd.props {
        sets.push(format!("props = ?{param_idx}"));
        params_vec.push(Box::new(serde_json::to_string(props).unwrap()));
        param_idx += 1;
    }
    if let Some(ref source) = upd.source {
        sets.push(format!("source = ?{param_idx}"));
        params_vec.push(Box::new(source.clone()));
        param_idx += 1;
    }
    if let Some(confidence) = upd.confidence {
        sets.push(format!("confidence = ?{param_idx}"));
        params_vec.push(Box::new(confidence));
    }

    let sql = format!(
        "UPDATE pkg_nodes SET {} WHERE id = ?{}",
        sets.join(", "),
        params_vec.len() + 1
    );
    params_vec.push(Box::new(id.to_string()));

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())?;
    Ok(())
}

pub fn delete(conn: &Connection, id: &str) -> Result<()> {
    // Delete edges first (foreign key)
    conn.execute(
        "DELETE FROM pkg_edges WHERE from_id = ?1 OR to_id = ?1",
        params![id],
    )?;
    let changed = conn.execute("DELETE FROM pkg_nodes WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(PkgError::NodeNotFound(id.to_string()));
    }
    Ok(())
}

pub fn exists(conn: &Connection, id: &str) -> Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pkg_nodes WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}
