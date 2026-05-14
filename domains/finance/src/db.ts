import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS fin_transactions (
    id              TEXT PRIMARY KEY,
    account_id      TEXT NOT NULL,
    date            TEXT NOT NULL,
    amount          REAL NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'CAD',
    type            TEXT NOT NULL DEFAULT 'debit',
    merchant_raw    TEXT NOT NULL,
    merchant_normalized TEXT,
    category        TEXT,
    subcategory     TEXT,
    confidence      REAL NOT NULL DEFAULT 1.0,
    is_recurring    INTEGER NOT NULL DEFAULT 0,
    source_statement_id TEXT,
    notes           TEXT,
    tags            TEXT DEFAULT '[]',
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_fin_txn_account ON fin_transactions(account_id);
  CREATE INDEX IF NOT EXISTS idx_fin_txn_date ON fin_transactions(date);
  CREATE INDEX IF NOT EXISTS idx_fin_txn_category ON fin_transactions(category);
  CREATE INDEX IF NOT EXISTS idx_fin_txn_merchant ON fin_transactions(merchant_normalized);

  CREATE TABLE IF NOT EXISTS fin_statements (
    id              TEXT PRIMARY KEY,
    account_id      TEXT NOT NULL,
    file_path       TEXT NOT NULL,
    file_format     TEXT NOT NULL,
    bank_detected   TEXT,
    period_start    TEXT NOT NULL,
    period_end      TEXT NOT NULL,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    imported_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fin_holdings (
    id              TEXT PRIMARY KEY,
    account_id      TEXT NOT NULL,
    ticker          TEXT NOT NULL,
    name            TEXT NOT NULL,
    shares          REAL NOT NULL,
    avg_cost        REAL NOT NULL,
    currency        TEXT NOT NULL,
    asset_class     TEXT NOT NULL DEFAULT 'other',
    current_price   REAL,
    current_value   REAL,
    last_updated    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_fin_holdings_account ON fin_holdings(account_id);
  CREATE INDEX IF NOT EXISTS idx_fin_holdings_ticker ON fin_holdings(ticker);

  CREATE TABLE IF NOT EXISTS fin_allocation_targets (
    owner           TEXT NOT NULL,
    asset_class     TEXT NOT NULL,
    target_pct      REAL NOT NULL,
    PRIMARY KEY (owner, asset_class)
  );

  CREATE TABLE IF NOT EXISTS fin_watchlist (
    ticker          TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    exchange        TEXT NOT NULL,
    alert_rules     TEXT NOT NULL DEFAULT '[]',
    notes           TEXT,
    added_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fin_mistakes (
    id              TEXT PRIMARY KEY,
    date            TEXT NOT NULL,
    ticker          TEXT,
    action          TEXT NOT NULL,
    amount          REAL,
    amount_currency TEXT,
    loss_realized   REAL,
    loss_currency   TEXT,
    lesson          TEXT NOT NULL,
    category        TEXT NOT NULL DEFAULT 'other',
    would_do_differently TEXT NOT NULL,
    tags            TEXT DEFAULT '[]',
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fin_market_cache (
    ticker          TEXT PRIMARY KEY,
    data            TEXT NOT NULL,
    fetched_at      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fin_fx_rates (
    pair            TEXT NOT NULL,
    rate            REAL NOT NULL,
    date            TEXT NOT NULL,
    PRIMARY KEY (pair, date)
  );
`;

let db: Database.Database | null = null;

export function getDb(dbPath?: string): Database.Database {
  if (db) return db;

  const resolvedPath = dbPath ?? path.join(process.cwd(), "data", "finance.db");
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(resolvedPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/** For tests — creates an in-memory database. */
export function getTestDb(): Database.Database {
  const testDb = new Database(":memory:");
  testDb.pragma("foreign_keys = ON");
  testDb.exec(SCHEMA);
  return testDb;
}
