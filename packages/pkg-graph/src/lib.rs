pub mod edge;
pub mod error;
pub mod event;
pub mod node;
pub mod query;
pub mod schema;

use std::path::Path;

use rusqlite::Connection;

use error::Result;

/// High-level handle to the Personal Knowledge Graph database.
pub struct PkgGraph {
    conn: Connection,
}

impl PkgGraph {
    /// Open (or create) the PKG database at the given path.
    pub fn open(db_path: &Path) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        schema::init_schema(&conn)?;
        Ok(Self { conn })
    }

    /// Create an in-memory PKG (useful for tests).
    pub fn in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        schema::init_schema(&conn)?;
        Ok(Self { conn })
    }

    /// Get a reference to the underlying connection (for advanced queries).
    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    // --- Node operations ---

    pub fn insert_node(&self, n: &node::PkgNode) -> Result<()> {
        node::insert(&self.conn, n)
    }

    pub fn upsert_node(&self, n: &node::PkgNode, domain: &str) -> Result<()> {
        node::upsert(&self.conn, n, domain)
    }

    pub fn get_node(&self, id: &str) -> Result<node::PkgNode> {
        node::get(&self.conn, id)
    }

    pub fn get_nodes_by_type(&self, node_type: &str) -> Result<Vec<node::PkgNode>> {
        node::get_by_type(&self.conn, node_type)
    }

    pub fn update_node(&self, id: &str, upd: &node::NodeUpdate) -> Result<()> {
        node::update(&self.conn, id, upd)
    }

    pub fn delete_node(&self, id: &str) -> Result<()> {
        node::delete(&self.conn, id)
    }

    pub fn node_exists(&self, id: &str) -> Result<bool> {
        node::exists(&self.conn, id)
    }

    // --- Edge operations ---

    pub fn insert_edge(&self, e: &edge::PkgEdge, domain: &str) -> Result<()> {
        edge::insert(&self.conn, e, domain)
    }

    pub fn get_edge(&self, id: &str) -> Result<edge::PkgEdge> {
        edge::get(&self.conn, id)
    }

    pub fn connect(
        &self,
        from_id: &str,
        to_id: &str,
        rel: &str,
        props: Option<serde_json::Value>,
        domain: &str,
    ) -> Result<String> {
        edge::connect(&self.conn, from_id, to_id, rel, props, domain)
    }

    pub fn edges_from(&self, node_id: &str, rel: Option<&str>) -> Result<Vec<edge::PkgEdge>> {
        edge::edges_from(&self.conn, node_id, rel)
    }

    pub fn edges_to(&self, node_id: &str, rel: Option<&str>) -> Result<Vec<edge::PkgEdge>> {
        edge::edges_to(&self.conn, node_id, rel)
    }

    pub fn delete_edge(&self, id: &str) -> Result<()> {
        edge::delete(&self.conn, id)
    }

    // --- Query operations ---

    pub fn find_neighbors(
        &self,
        node_id: &str,
        rel: Option<&str>,
        max_depth: Option<u32>,
    ) -> Result<Vec<query::Neighbor>> {
        query::find_neighbors(&self.conn, node_id, rel, max_depth)
    }

    pub fn find_path(
        &self,
        from_id: &str,
        to_id: &str,
        max_depth: u32,
    ) -> Result<Option<Vec<edge::PkgEdge>>> {
        query::find_path(&self.conn, from_id, to_id, max_depth)
    }

    // --- Event journal ---

    pub fn journal_event(
        &self,
        event_type: &str,
        entity_id: &str,
        domain: &str,
        payload: &serde_json::Value,
    ) -> Result<i64> {
        event::journal(&self.conn, event_type, entity_id, domain, payload)
    }

    pub fn events_for(&self, entity_id: &str) -> Result<Vec<event::PkgEvent>> {
        event::events_for(&self.conn, entity_id)
    }

    pub fn events_by_domain(&self, domain: &str) -> Result<Vec<event::PkgEvent>> {
        event::events_by_domain(&self.conn, domain)
    }

    pub fn events_since(&self, after_id: i64) -> Result<Vec<event::PkgEvent>> {
        event::events_since(&self.conn, after_id)
    }
}
