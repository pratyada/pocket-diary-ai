import type Database from "better-sqlite3";
import type { Holding, Portfolio, DriftItem } from "../../schemas/portfolio.js";
import type { Money, Owner } from "../../schemas/common.js";
import { refreshHoldingPrices } from "../market-data.js";
import { toCAD } from "../currency.js";

interface HoldingRow {
  id: string;
  account_id: string;
  ticker: string;
  name: string;
  shares: number;
  avg_cost: number;
  currency: string;
  asset_class: string;
  current_price: number | null;
  current_value: number | null;
  last_updated: string | null;
}

export async function portfolioSummary(
  db: Database.Database,
  params: { owner?: string; account_type?: string }
): Promise<{ portfolios: Portfolio[]; total_value: Money }> {
  // Refresh prices first
  await refreshHoldingPrices(db);

  const holdings = db
    .prepare("SELECT * FROM fin_holdings ORDER BY account_id, ticker")
    .all() as HoldingRow[];

  // Group by account
  const byAccount = new Map<string, HoldingRow[]>();
  for (const h of holdings) {
    const group = byAccount.get(h.account_id) ?? [];
    group.push(h);
    byAccount.set(h.account_id, group);
  }

  const portfolios: Portfolio[] = [];
  let grandTotal = 0;

  for (const [accountId, accountHoldings] of byAccount) {
    const holdingList: Holding[] = accountHoldings.map((h) => {
      const currentValue = h.current_price ? h.shares * h.current_price : h.shares * h.avg_cost;
      const totalCost = h.shares * h.avg_cost;
      const gainLoss = currentValue - totalCost;

      return {
        id: h.id,
        account_id: h.account_id,
        ticker: h.ticker,
        name: h.name,
        shares: h.shares,
        avg_cost: h.avg_cost,
        currency: h.currency as "CAD" | "USD" | "INR",
        asset_class: h.asset_class as Holding["asset_class"],
        current_price: h.current_price ?? undefined,
        current_value: Math.round(currentValue * 100) / 100,
        gain_loss: Math.round(gainLoss * 100) / 100,
        gain_loss_pct: totalCost > 0 ? Math.round((gainLoss / totalCost) * 10000) / 100 : 0,
        last_updated: h.last_updated ?? undefined,
      };
    });

    const totalValue = holdingList.reduce((s, h) => s + (h.current_value ?? 0), 0);
    const totalCost = holdingList.reduce((s, h) => s + h.shares * h.avg_cost, 0);
    const gainLoss = totalValue - totalCost;
    const currency = accountHoldings[0]?.currency ?? "CAD";

    portfolios.push({
      account_id: accountId,
      account_label: accountId, // TODO: join with account registry
      owner: (params.owner ?? "prateek") as Owner,
      type: "brokerage", // TODO: derive from account
      region: "CA",
      currency: currency as "CAD" | "USD" | "INR",
      holdings: holdingList,
      total_value: { amount: Math.round(totalValue * 100) / 100, currency: currency as "CAD" | "USD" | "INR" },
      total_cost: { amount: Math.round(totalCost * 100) / 100, currency: currency as "CAD" | "USD" | "INR" },
      total_gain_loss: { amount: Math.round(gainLoss * 100) / 100, currency: currency as "CAD" | "USD" | "INR" },
      total_gain_loss_pct: totalCost > 0 ? Math.round((gainLoss / totalCost) * 10000) / 100 : 0,
    });

    grandTotal += toCAD(totalValue, currency as "CAD" | "USD" | "INR");
  }

  return {
    portfolios,
    total_value: { amount: Math.round(grandTotal * 100) / 100, currency: "CAD" },
  };
}

export function driftReport(
  db: Database.Database,
  params: { owner?: string }
): { drift: DriftItem[]; rebalance_suggestions: string[] } {
  const owner = params.owner ?? "prateek";

  // Get targets
  const targets = db
    .prepare("SELECT asset_class, target_pct FROM fin_allocation_targets WHERE owner = ?")
    .all(owner) as { asset_class: string; target_pct: number }[];

  if (targets.length === 0) {
    return {
      drift: [],
      rebalance_suggestions: [
        "No allocation targets set. Use 'set_allocation_target' to define your target allocation.",
      ],
    };
  }

  // Get current allocation
  const holdings = db
    .prepare("SELECT asset_class, SUM(COALESCE(current_value, shares * avg_cost)) as total FROM fin_holdings GROUP BY asset_class")
    .all() as { asset_class: string; total: number }[];

  const grandTotal = holdings.reduce((s, h) => s + h.total, 0);
  if (grandTotal === 0) {
    return { drift: [], rebalance_suggestions: ["No holdings found."] };
  }

  const actualMap = new Map(holdings.map((h) => [h.asset_class, h.total]));
  const suggestions: string[] = [];

  const drift: DriftItem[] = targets.map((t) => {
    const actual = actualMap.get(t.asset_class) ?? 0;
    const actualPct = (actual / grandTotal) * 100;
    const driftPct = actualPct - t.target_pct;

    let action: "buy" | "sell" | "hold" = "hold";
    if (driftPct < -2) action = "buy";
    if (driftPct > 2) action = "sell";

    if (action !== "hold") {
      const amountToRebalance = Math.abs(driftPct / 100) * grandTotal;
      suggestions.push(
        `${action === "buy" ? "Buy" : "Sell"} ~$${Math.round(amountToRebalance)} of ${t.asset_class} (${driftPct > 0 ? "+" : ""}${driftPct.toFixed(1)}% drift)`
      );
    }

    return {
      asset_class: t.asset_class as DriftItem["asset_class"],
      target_pct: t.target_pct,
      actual_pct: Math.round(actualPct * 100) / 100,
      drift_pct: Math.round(driftPct * 100) / 100,
      current_value: { amount: Math.round(actual * 100) / 100, currency: "CAD" as const },
      action,
      amount_to_rebalance:
        action !== "hold"
          ? { amount: Math.round(Math.abs(driftPct / 100) * grandTotal * 100) / 100, currency: "CAD" as const }
          : undefined,
    };
  });

  return { drift, rebalance_suggestions: suggestions };
}

export function importHoldings(
  db: Database.Database,
  params: { path: string; account_id: string; currency?: "CAD" | "USD" | "INR" }
): { imported: number; holdings: Holding[] } {
  const currency = params.currency ?? "CAD";
  // Read CSV — expect columns: ticker/symbol, name, shares/quantity, avg_cost/book_cost
  const fs = require("fs");
  const { parse } = require("csv-parse/sync");

  const content = fs.readFileSync(params.path, "utf-8");
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  const insertStmt = db.prepare(
    `INSERT OR REPLACE INTO fin_holdings (id, account_id, ticker, name, shares, avg_cost, currency, asset_class)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const holdings: Holding[] = [];
  let imported = 0;

  const insertAll = db.transaction(() => {
    for (const row of records) {
      const ticker = row["Symbol"] ?? row["Ticker"] ?? row["ticker"] ?? "";
      const name = row["Name"] ?? row["name"] ?? row["Description"] ?? ticker;
      const shares = parseFloat(row["Shares"] ?? row["Quantity"] ?? row["shares"] ?? "0");
      const avgCost = parseFloat(
        (row["Book Cost"] ?? row["Avg Cost"] ?? row["avg_cost"] ?? row["Average Cost"] ?? "0")
          .replace(/[$,]/g, "")
      );

      if (!ticker || isNaN(shares) || shares === 0) continue;

      const id = `holding:${params.account_id}:${ticker}`;
      const assetClass = inferAssetClass(ticker);

      insertStmt.run(id, params.account_id, ticker, name, shares, avgCost, currency, assetClass);
      imported++;

      holdings.push({
        id,
        account_id: params.account_id,
        ticker,
        name,
        shares,
        avg_cost: avgCost,
        currency: currency as "CAD" | "USD" | "INR",
        asset_class: assetClass as Holding["asset_class"],
      });
    }
  });

  insertAll();
  return { imported, holdings };
}

function inferAssetClass(ticker: string): string {
  if (ticker.endsWith(".TO") || ticker.endsWith(".V")) return "equity_ca";
  if (ticker.endsWith(".NS") || ticker.endsWith(".BO")) return "equity_in";
  if (ticker.includes("BND") || ticker.includes("BOND") || ticker.includes("AGG")) return "fixed_income";
  if (ticker.includes("GLD") || ticker.includes("GOLD")) return "gold";
  if (ticker.includes("BTC") || ticker.includes("ETH")) return "crypto";
  if (ticker.includes("REIT") || ticker.includes("VNQ")) return "real_estate";
  // Default: US equity for unrecognized
  return "equity_us";
}
