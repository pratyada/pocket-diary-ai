import type Database from "better-sqlite3";
import type { MarketQuote, IndexQuote } from "../../schemas/market.js";
import type { WatchlistItem } from "../../schemas/portfolio.js";
import { getQuotes, getIndexQuotes, INDICES } from "../market-data.js";

export async function marketSnapshot(
  db: Database.Database,
  params: { tickers?: string[]; indices?: string[] }
): Promise<{ quotes: MarketQuote[]; indices: IndexQuote[] }> {
  const tickers = params.tickers ?? [];
  const indexSymbols = params.indices ?? Object.values(INDICES);

  const [quotes, indexQuotes] = await Promise.all([
    tickers.length > 0 ? getQuotes(tickers, db) : Promise.resolve([]),
    getIndexQuotes(indexSymbols),
  ]);

  return { quotes, indices: indexQuotes };
}

export function watchlistAction(
  db: Database.Database,
  params: {
    action: "list" | "add" | "remove";
    ticker?: string;
    name?: string;
    exchange?: string;
    alert_rules?: WatchlistItem["alert_rules"];
    notes?: string;
  }
): { items: WatchlistItem[] } {
  switch (params.action) {
    case "add": {
      if (!params.ticker) throw new Error("ticker required for add");
      db.prepare(
        `INSERT OR REPLACE INTO fin_watchlist (ticker, name, exchange, alert_rules, notes)
         VALUES (?, ?, ?, ?, ?)`
      ).run(
        params.ticker,
        params.name ?? params.ticker,
        params.exchange ?? "UNKNOWN",
        JSON.stringify(params.alert_rules ?? []),
        params.notes
      );
      break;
    }
    case "remove": {
      if (!params.ticker) throw new Error("ticker required for remove");
      db.prepare("DELETE FROM fin_watchlist WHERE ticker = ?").run(params.ticker);
      break;
    }
  }

  // Return current list
  const rows = db.prepare("SELECT * FROM fin_watchlist ORDER BY added_at DESC").all() as Record<string, unknown>[];

  return {
    items: rows.map((r) => ({
      ticker: r.ticker as string,
      name: r.name as string,
      exchange: r.exchange as string,
      alert_rules: JSON.parse((r.alert_rules as string) ?? "[]"),
      added_at: r.added_at as string,
      notes: r.notes as string | undefined,
    })),
  };
}

export async function checkWatchlistAlerts(
  db: Database.Database
): Promise<{ triggered: { ticker: string; rule: string; value: number; threshold: number }[] }> {
  const items = db.prepare("SELECT * FROM fin_watchlist").all() as Record<string, unknown>[];
  const triggered: { ticker: string; rule: string; value: number; threshold: number }[] = [];

  for (const item of items) {
    const ticker = item.ticker as string;
    const rules = JSON.parse((item.alert_rules as string) ?? "[]") as WatchlistItem["alert_rules"];

    if (rules.length === 0) continue;

    const quotes = await getQuotes([ticker], db);
    const quote = quotes[0];
    if (!quote) continue;

    for (const rule of rules) {
      if (rule.triggered) continue;

      let shouldTrigger = false;
      switch (rule.type) {
        case "price_above":
          shouldTrigger = quote.price > rule.threshold;
          break;
        case "price_below":
          shouldTrigger = quote.price < rule.threshold;
          break;
        case "pe_above":
          shouldTrigger = (quote.pe_ratio ?? 0) > rule.threshold;
          break;
        case "pe_below":
          shouldTrigger = (quote.pe_ratio ?? Infinity) < rule.threshold;
          break;
        case "volume_spike":
          shouldTrigger = quote.volume > rule.threshold;
          break;
      }

      if (shouldTrigger) {
        triggered.push({
          ticker,
          rule: rule.type,
          value: rule.type.startsWith("pe") ? (quote.pe_ratio ?? 0) : quote.price,
          threshold: rule.threshold,
        });
        rule.triggered = true;
      }
    }

    // Update triggered flags
    db.prepare("UPDATE fin_watchlist SET alert_rules = ? WHERE ticker = ?").run(
      JSON.stringify(rules),
      ticker
    );
  }

  return { triggered };
}
