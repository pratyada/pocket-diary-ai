use pkg_graph::edge::PkgEdge;
use pkg_graph::node::PkgNode;
use pkg_graph::query::Direction;
use pkg_graph::PkgGraph;
use serde_json::json;

fn test_graph() -> PkgGraph {
    PkgGraph::in_memory().expect("failed to create in-memory graph")
}

fn make_node(id: &str, node_type: &str, label: &str) -> PkgNode {
    PkgNode {
        id: id.to_string(),
        node_type: node_type.to_string(),
        label: label.to_string(),
        props: json!({}),
        source: Some("test".to_string()),
        confidence: 1.0,
        created_at: 1000,
        updated_at: 1000,
    }
}

#[test]
fn insert_and_get_node() {
    let g = test_graph();
    let node = make_node("person:prateek", "person", "Prateek Yadav");
    g.insert_node(&node).unwrap();

    let fetched = g.get_node("person:prateek").unwrap();
    assert_eq!(fetched.id, "person:prateek");
    assert_eq!(fetched.node_type, "person");
    assert_eq!(fetched.label, "Prateek Yadav");
}

#[test]
fn get_missing_node_returns_error() {
    let g = test_graph();
    let result = g.get_node("nonexistent");
    assert!(result.is_err());
}

#[test]
fn duplicate_node_returns_error() {
    let g = test_graph();
    let node = make_node("person:prateek", "person", "Prateek");
    g.insert_node(&node).unwrap();
    let result = g.insert_node(&node);
    assert!(result.is_err());
}

#[test]
fn upsert_node_creates_and_updates() {
    let g = test_graph();
    let mut node = make_node("account:rbc", "account", "RBC Chequing");
    node.props = json!({"balance": 1500});

    g.upsert_node(&node, "finance").unwrap();
    let fetched = g.get_node("account:rbc").unwrap();
    assert_eq!(fetched.label, "RBC Chequing");

    // Upsert with new label
    node.label = "RBC Chequing - Updated".to_string();
    node.props = json!({"balance": 2000});
    g.upsert_node(&node, "finance").unwrap();

    let updated = g.get_node("account:rbc").unwrap();
    assert_eq!(updated.label, "RBC Chequing - Updated");
    assert_eq!(updated.props["balance"], 2000);
}

#[test]
fn get_nodes_by_type() {
    let g = test_graph();
    g.insert_node(&make_node("account:rbc", "account", "RBC")).unwrap();
    g.insert_node(&make_node("account:td", "account", "TD")).unwrap();
    g.insert_node(&make_node("person:prateek", "person", "Prateek")).unwrap();

    let accounts = g.get_nodes_by_type("account").unwrap();
    assert_eq!(accounts.len(), 2);

    let people = g.get_nodes_by_type("person").unwrap();
    assert_eq!(people.len(), 1);
}

#[test]
fn insert_edge_and_get() {
    let g = test_graph();
    g.insert_node(&make_node("person:prateek", "person", "Prateek")).unwrap();
    g.insert_node(&make_node("account:rbc", "account", "RBC")).unwrap();

    let edge = PkgEdge {
        id: "edge:1".to_string(),
        from_id: "person:prateek".to_string(),
        to_id: "account:rbc".to_string(),
        rel: "owns".to_string(),
        props: Some(json!({"primary": true})),
        created_at: 1000,
    };
    g.insert_edge(&edge, "finance").unwrap();

    let fetched = g.get_edge("edge:1").unwrap();
    assert_eq!(fetched.from_id, "person:prateek");
    assert_eq!(fetched.to_id, "account:rbc");
    assert_eq!(fetched.rel, "owns");
}

#[test]
fn edge_with_missing_node_fails() {
    let g = test_graph();
    g.insert_node(&make_node("person:prateek", "person", "Prateek")).unwrap();

    let edge = PkgEdge {
        id: "edge:bad".to_string(),
        from_id: "person:prateek".to_string(),
        to_id: "account:nonexistent".to_string(),
        rel: "owns".to_string(),
        props: None,
        created_at: 1000,
    };
    let result = g.insert_edge(&edge, "test");
    assert!(result.is_err());
}

#[test]
fn connect_helper() {
    let g = test_graph();
    g.insert_node(&make_node("person:prateek", "person", "Prateek")).unwrap();
    g.insert_node(&make_node("holding:tsla", "holding", "Tesla")).unwrap();

    let edge_id = g
        .connect(
            "person:prateek",
            "holding:tsla",
            "holds",
            Some(json!({"shares": 12, "avg_cost": 215.40})),
            "invest",
        )
        .unwrap();

    let edge = g.get_edge(&edge_id).unwrap();
    assert_eq!(edge.rel, "holds");
    assert_eq!(edge.props.unwrap()["shares"], 12);
}

#[test]
fn find_neighbors_depth_1() {
    let g = test_graph();
    g.insert_node(&make_node("person:prateek", "person", "Prateek")).unwrap();
    g.insert_node(&make_node("account:rbc", "account", "RBC")).unwrap();
    g.insert_node(&make_node("sub:aws", "sub", "AWS")).unwrap();

    g.connect("person:prateek", "account:rbc", "owns", None, "finance").unwrap();
    g.connect("account:rbc", "sub:aws", "pays_for", None, "subs").unwrap();

    // Depth 1: only direct neighbors
    let neighbors = g.find_neighbors("person:prateek", None, Some(1)).unwrap();
    assert_eq!(neighbors.len(), 1);
    assert_eq!(neighbors[0].node.id, "account:rbc");
    assert_eq!(neighbors[0].depth, 1);
}

#[test]
fn find_neighbors_depth_2() {
    let g = test_graph();
    g.insert_node(&make_node("person:prateek", "person", "Prateek")).unwrap();
    g.insert_node(&make_node("account:rbc", "account", "RBC")).unwrap();
    g.insert_node(&make_node("sub:aws", "sub", "AWS")).unwrap();

    g.connect("person:prateek", "account:rbc", "owns", None, "finance").unwrap();
    g.connect("account:rbc", "sub:aws", "pays_for", None, "subs").unwrap();

    // Depth 2: should reach sub:aws via account:rbc
    let neighbors = g.find_neighbors("person:prateek", None, Some(2)).unwrap();
    assert_eq!(neighbors.len(), 2);

    let ids: Vec<&str> = neighbors.iter().map(|n| n.node.id.as_str()).collect();
    assert!(ids.contains(&"account:rbc"));
    assert!(ids.contains(&"sub:aws"));
}

#[test]
fn find_neighbors_with_rel_filter() {
    let g = test_graph();
    g.insert_node(&make_node("person:prateek", "person", "Prateek")).unwrap();
    g.insert_node(&make_node("account:rbc", "account", "RBC")).unwrap();
    g.insert_node(&make_node("person:ved", "person", "Ved")).unwrap();

    g.connect("person:prateek", "account:rbc", "owns", None, "finance").unwrap();
    g.connect("person:prateek", "person:ved", "parent_of", None, "child").unwrap();

    // Filter by "owns" — should only see account
    let neighbors = g.find_neighbors("person:prateek", Some("owns"), None).unwrap();
    assert_eq!(neighbors.len(), 1);
    assert_eq!(neighbors[0].node.id, "account:rbc");
}

#[test]
fn find_neighbors_incoming_edges() {
    let g = test_graph();
    g.insert_node(&make_node("person:prateek", "person", "Prateek")).unwrap();
    g.insert_node(&make_node("account:rbc", "account", "RBC")).unwrap();

    g.connect("person:prateek", "account:rbc", "owns", None, "finance").unwrap();

    // From account:rbc's perspective, prateek is an incoming neighbor
    let neighbors = g.find_neighbors("account:rbc", None, None).unwrap();
    assert_eq!(neighbors.len(), 1);
    assert_eq!(neighbors[0].node.id, "person:prateek");
    assert_eq!(neighbors[0].direction, Direction::Incoming);
}

#[test]
fn find_path_between_nodes() {
    let g = test_graph();
    g.insert_node(&make_node("person:prateek", "person", "Prateek")).unwrap();
    g.insert_node(&make_node("account:rbc", "account", "RBC")).unwrap();
    g.insert_node(&make_node("sub:aws", "sub", "AWS")).unwrap();

    g.connect("person:prateek", "account:rbc", "owns", None, "finance").unwrap();
    g.connect("account:rbc", "sub:aws", "pays_for", None, "subs").unwrap();

    let path = g.find_path("person:prateek", "sub:aws", 5).unwrap();
    assert!(path.is_some());
    let edges = path.unwrap();
    assert_eq!(edges.len(), 2);
    assert_eq!(edges[0].rel, "owns");
    assert_eq!(edges[1].rel, "pays_for");
}

#[test]
fn find_path_no_path() {
    let g = test_graph();
    g.insert_node(&make_node("person:prateek", "person", "Prateek")).unwrap();
    g.insert_node(&make_node("sub:aws", "sub", "AWS")).unwrap();
    // No edge connecting them

    let path = g.find_path("person:prateek", "sub:aws", 5).unwrap();
    assert!(path.is_none());
}

#[test]
fn event_journal_records_mutations() {
    let g = test_graph();
    let node = make_node("account:rbc", "account", "RBC");
    g.upsert_node(&node, "finance").unwrap();

    let events = g.events_for("account:rbc").unwrap();
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].event_type, "node_upserted");
    assert_eq!(events[0].domain, "finance");
}

#[test]
fn event_journal_edge_creation() {
    let g = test_graph();
    g.insert_node(&make_node("person:prateek", "person", "Prateek")).unwrap();
    g.insert_node(&make_node("account:rbc", "account", "RBC")).unwrap();

    let edge_id = g.connect("person:prateek", "account:rbc", "owns", None, "finance").unwrap();

    let events = g.events_for(&edge_id).unwrap();
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].event_type, "edge_created");
    assert_eq!(events[0].payload["rel"], "owns");
}

#[test]
fn events_since_for_replay() {
    let g = test_graph();
    g.insert_node(&make_node("a:1", "account", "A1")).unwrap();
    g.upsert_node(&make_node("a:1", "account", "A1"), "finance").unwrap();
    g.upsert_node(&make_node("a:2", "account", "A2"), "finance").unwrap();

    // Get all events
    let all = g.events_since(0).unwrap();
    assert_eq!(all.len(), 2); // two upserts journaled

    // Replay from after the first
    let after_first = g.events_since(all[0].id).unwrap();
    assert_eq!(after_first.len(), 1);
    assert_eq!(after_first[0].entity_id, "a:2");
}

#[test]
fn events_by_domain_filter() {
    let g = test_graph();
    g.insert_node(&make_node("a:1", "account", "A1")).unwrap();
    g.upsert_node(&make_node("a:1", "account", "A1"), "finance").unwrap();
    g.upsert_node(&make_node("a:2", "account", "A2"), "invest").unwrap();

    let finance_events = g.events_by_domain("finance").unwrap();
    assert_eq!(finance_events.len(), 1);

    let invest_events = g.events_by_domain("invest").unwrap();
    assert_eq!(invest_events.len(), 1);
}

#[test]
fn delete_node_cascades_edges() {
    let g = test_graph();
    g.insert_node(&make_node("person:prateek", "person", "Prateek")).unwrap();
    g.insert_node(&make_node("account:rbc", "account", "RBC")).unwrap();
    g.connect("person:prateek", "account:rbc", "owns", None, "finance").unwrap();

    g.delete_node("person:prateek").unwrap();

    assert!(g.get_node("person:prateek").is_err());
    let edges = g.edges_from("person:prateek", None).unwrap();
    assert!(edges.is_empty());
}

#[test]
fn file_based_graph() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test_pkg.db");

    {
        let g = PkgGraph::open(&db_path).unwrap();
        g.insert_node(&make_node("person:prateek", "person", "Prateek")).unwrap();
    }

    // Reopen and verify persistence
    {
        let g = PkgGraph::open(&db_path).unwrap();
        let node = g.get_node("person:prateek").unwrap();
        assert_eq!(node.label, "Prateek");
    }
}
