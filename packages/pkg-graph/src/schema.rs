use rusqlite::Connection;

/// Idempotent schema initialization. Safe to call on every open.
pub fn init_schema(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS pkg_nodes (
            id          TEXT PRIMARY KEY,
            type        TEXT NOT NULL,
            label       TEXT NOT NULL,
            props       TEXT NOT NULL DEFAULT '{}',
            source      TEXT,
            confidence  REAL NOT NULL DEFAULT 1.0,
            created_at  INTEGER NOT NULL,
            updated_at  INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_pkg_nodes_type
            ON pkg_nodes(type);

        CREATE TABLE IF NOT EXISTS pkg_edges (
            id          TEXT PRIMARY KEY,
            from_id     TEXT NOT NULL REFERENCES pkg_nodes(id),
            to_id       TEXT NOT NULL REFERENCES pkg_nodes(id),
            rel         TEXT NOT NULL,
            props       TEXT DEFAULT '{}',
            created_at  INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_pkg_edges_from
            ON pkg_edges(from_id, rel);

        CREATE INDEX IF NOT EXISTS idx_pkg_edges_to
            ON pkg_edges(to_id, rel);

        CREATE TABLE IF NOT EXISTS pkg_events (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type  TEXT NOT NULL,
            entity_id   TEXT NOT NULL,
            domain      TEXT NOT NULL,
            payload     TEXT NOT NULL DEFAULT '{}',
            created_at  INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_pkg_events_entity
            ON pkg_events(entity_id);

        CREATE INDEX IF NOT EXISTS idx_pkg_events_domain
            ON pkg_events(domain);

        CREATE INDEX IF NOT EXISTS idx_pkg_events_type
            ON pkg_events(event_type);
        ",
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn schema_is_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        init_schema(&conn).unwrap(); // second call must not fail
    }
}
