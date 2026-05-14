use std::collections::{HashSet, VecDeque};

use rusqlite::Connection;

use crate::edge::{self, PkgEdge};
use crate::error::Result;
use crate::node::{self, PkgNode};

/// A neighbor: the node reached via an edge.
#[derive(Debug, Clone)]
pub struct Neighbor {
    pub node: PkgNode,
    pub edge: PkgEdge,
    pub direction: Direction,
    pub depth: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Direction {
    Outgoing,
    Incoming,
}

/// Find all neighbors of a node, optionally filtering by relationship type.
/// Traverses up to `max_depth` hops (default 1). Follows edges in both directions.
pub fn find_neighbors(
    conn: &Connection,
    node_id: &str,
    rel: Option<&str>,
    max_depth: Option<u32>,
) -> Result<Vec<Neighbor>> {
    let depth_limit = max_depth.unwrap_or(1);
    let mut visited: HashSet<String> = HashSet::new();
    let mut queue: VecDeque<(String, u32)> = VecDeque::new();
    let mut results: Vec<Neighbor> = Vec::new();

    visited.insert(node_id.to_string());
    queue.push_back((node_id.to_string(), 0));

    while let Some((current_id, current_depth)) = queue.pop_front() {
        if current_depth >= depth_limit {
            continue;
        }

        // Outgoing edges
        let outgoing = edge::edges_from(conn, &current_id, rel)?;
        for e in outgoing {
            if !visited.contains(&e.to_id) {
                let target_node = node::get(conn, &e.to_id)?;
                visited.insert(e.to_id.clone());
                queue.push_back((e.to_id.clone(), current_depth + 1));
                results.push(Neighbor {
                    node: target_node,
                    edge: e,
                    direction: Direction::Outgoing,
                    depth: current_depth + 1,
                });
            }
        }

        // Incoming edges
        let incoming = edge::edges_to(conn, &current_id, rel)?;
        for e in incoming {
            if !visited.contains(&e.from_id) {
                let source_node = node::get(conn, &e.from_id)?;
                visited.insert(e.from_id.clone());
                queue.push_back((e.from_id.clone(), current_depth + 1));
                results.push(Neighbor {
                    node: source_node,
                    edge: e,
                    direction: Direction::Incoming,
                    depth: current_depth + 1,
                });
            }
        }
    }

    Ok(results)
}

/// Find a path between two nodes (BFS, shortest path). Returns the edges along the path.
pub fn find_path(conn: &Connection, from_id: &str, to_id: &str, max_depth: u32) -> Result<Option<Vec<PkgEdge>>> {
    let mut visited: HashSet<String> = HashSet::new();
    // Each entry: (node_id, path_of_edges_so_far)
    let mut queue: VecDeque<(String, Vec<PkgEdge>)> = VecDeque::new();

    visited.insert(from_id.to_string());
    queue.push_back((from_id.to_string(), vec![]));

    while let Some((current_id, path)) = queue.pop_front() {
        if path.len() as u32 >= max_depth {
            continue;
        }

        let outgoing = edge::edges_from(conn, &current_id, None)?;
        for e in outgoing {
            let target_id = e.to_id.clone();
            if target_id == to_id {
                let mut full_path = path.clone();
                full_path.push(e);
                return Ok(Some(full_path));
            }
            if !visited.contains(&target_id) {
                visited.insert(target_id.clone());
                let mut new_path = path.clone();
                new_path.push(e);
                queue.push_back((target_id, new_path));
            }
        }
    }

    Ok(None)
}
