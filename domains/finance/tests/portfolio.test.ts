import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb } from "../src/db.js";
import { driftReport, importHoldings } from "../src/handlers/portfolio.js";
import type Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import os from "os";

let db: Database.Database;

function seedHoldings(db: Database.Database) {
  const insert = db.prepare(
    `INSERT INTO fin_holdings (id, account_id, ticker, name, shares, avg_cost, currency, asset_class, current_price, current_value)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  db.transaction(() => {
    insert.run("h:1", "invest:tfsa", "VFV.TO", "Vanguard S&P 500", 100, 50.00, "CAD", "equity_us", 55.00, 5500);
    insert.run("h:2", "invest:tfsa", "XIC.TO", "iShares S&P/TSX", 80, 30.00, "CAD", "equity_ca", 32.00, 2560);
    insert.run("h:3", "invest:tfsa", "ZAG.TO", "BMO Agg Bond", 200, 15.00, "CAD", "fixed_income", 14.50, 2900);
    insert.run("h:4", "invest:rrsp", "VTI", "Vanguard Total US", 50, 200.00, "USD", "equity_us", 220.00, 11000);
  })();
}

function seedTargets(db: Database.Database) {
  const insert = db.prepare(
    "INSERT INTO fin_allocation_targets (owner, asset_class, target_pct) VALUES (?, ?, ?)"
  );

  db.transaction(() => {
    insert.run("prateek", "equity_us", 50);
    insert.run("prateek", "equity_ca", 20);
    insert.run("prateek", "fixed_income", 20);
    insert.run("prateek", "equity_intl", 10);
  })();
}

beforeEach(() => {
  db = getTestDb();
});

describe("driftReport", () => {
  it("reports no drift when no targets set", () => {
    seedHoldings(db);
    const result = driftReport(db, { owner: "prateek" });
    expect(result.drift).toHaveLength(0);
    expect(result.rebalance_suggestions[0]).toContain("No allocation targets");
  });

  it("calculates drift against targets", () => {
    seedHoldings(db);
    seedTargets(db);

    const result = driftReport(db, { owner: "prateek" });
    expect(result.drift.length).toBeGreaterThan(0);

    // equity_us should be overweight (VFV + VTI combined)
    const usEquity = result.drift.find((d) => d.asset_class === "equity_us");
    expect(usEquity).toBeDefined();
    expect(usEquity!.actual_pct).toBeGreaterThan(usEquity!.target_pct);

    // equity_intl should be underweight (0%)
    const intl = result.drift.find((d) => d.asset_class === "equity_intl");
    expect(intl).toBeDefined();
    expect(intl!.actual_pct).toBe(0);
    expect(intl!.action).toBe("buy");
  });
});

describe("importHoldings", () => {
  it("imports holdings from CSV", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "finance-test-"));
    const csvPath = path.join(tmpDir, "holdings.csv");

    fs.writeFileSync(
      csvPath,
      `Symbol,Name,Shares,Book Cost
VFV.TO,Vanguard S&P 500 Index,100,50.00
XIC.TO,iShares S&P/TSX 60,80,"$2,400.00"
ZAG.TO,BMO Aggregate Bond,200,15.00
`,
      "utf-8"
    );

    const result = await importHoldings(db, {
      path: csvPath,
      account_id: "invest:tfsa",
      currency: "CAD",
    });

    expect(result.imported).toBe(3);
    expect(result.holdings.length).toBe(3);
    expect(result.holdings[0]!.ticker).toBe("VFV.TO");
    expect(result.holdings[0]!.asset_class).toBe("equity_ca"); // .TO suffix

    // Clean up
    fs.rmSync(tmpDir, { recursive: true });
  });
});
