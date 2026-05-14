use thiserror::Error;

#[derive(Debug, Error)]
pub enum PkgError {
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),

    #[error("node not found: {0}")]
    NodeNotFound(String),

    #[error("edge not found: {0}")]
    EdgeNotFound(String),

    #[error("invalid JSON: {0}")]
    Json(#[from] serde_json::Error),

    #[error("duplicate node: {0}")]
    DuplicateNode(String),

    #[error("foreign key violation: node {0} does not exist")]
    MissingNode(String),
}

pub type Result<T> = std::result::Result<T, PkgError>;
