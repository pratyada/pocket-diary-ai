import type Database from "better-sqlite3";
import type { MarketQuote, IndexQuote } from "../schemas/market.js";

// Major indices
export const INDICES = {
  SP500: "^GSPC",
  NASDAQ: "^IXIC",
  TSX: "^GSPTSE",
  NIFTY: "^NSEI",
  SENSEX: "^BSESN",
  DOW: "^DJI",
} as const;

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function getQuote(
  ticker: string,
  db?: Database.Database
): Promise<MarketQuote | null> {
  // Check cache first
  if (db) {
    const cached = db
      .prepare("SELECT data, fetched_at FROM fin_market_cache WHERE ticker = ?")
      .get(ticker) as { data: string; fetched_at: string } | undefined;

    if (cached) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (age < CACHE_TTL_MS) {
        return JSON.parse(cached.data) as MarketQuote;
      }
    }
  }

  try {
    const yahooFinance = await import("yahoo-finance2");
    const yf = new yahooFinance.default();

    const result = await yf.quote(ticker);
    if (!result) return null;

    const quote: MarketQuote = {
      ticker,
      name: result.shortName ?? result.longName ?? ticker,
      exchange: result.exchange ?? "UNKNOWN",
      price: result.regularMarketPrice ?? 0,
      change: result.regularMarketChange ?? 0,
      change_pct: result.regularMarketChangePercent ?? 0,
      volume: result.regularMarketVolume ?? 0,
      market_cap: result.marketCap,
      pe_ratio: result.trailingPE,
      dividend_yield: result.dividendYield,
      high_52w: result.fiftyTwoWeekHigh,
      low_52w: result.fiftyTwoWeekLow,
      currency: result.currency ?? "USD",
      timestamp: new Date().toISOString(),
    };

    // Cache it
    if (db) {
      db.prepare(
        `INSERT OR REPLACE INTO fin_market_cache (ticker, data, fetched_at)
         VALUES (?, ?, ?)`
      ).run(ticker, JSON.stringify(quote), new Date().toISOString());
    }

    return quote;
  } catch (err) {
    console.error(`[finance] Failed to fetch quote for ${ticker}:`, err);
    return null;
  }
}

export async function getQuotes(
  tickers: string[],
  db?: Database.Database
): Promise<MarketQuote[]> {
  const results: MarketQuote[] = [];
  for (const ticker of tickers) {
    const quote = await getQuote(ticker, db);
    if (quote) results.push(quote);
  }
  return results;
}

export async function getIndexQuotes(
  symbols?: string[]
): Promise<IndexQuote[]> {
  const indices = symbols ?? Object.values(INDICES);
  const quotes: IndexQuote[] = [];

  for (const symbol of indices) {
    try {
      const yahooFinance = await import("yahoo-finance2");
      const yf = new yahooFinance.default();
      const result = await yf.quote(symbol);

      if (result) {
        quotes.push({
          symbol,
          name: result.shortName ?? symbol,
          value: result.regularMarketPrice ?? 0,
          change: result.regularMarketChange ?? 0,
          change_pct: result.regularMarketChangePercent ?? 0,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error(`[finance] Failed to fetch index ${symbol}:`, err);
    }
  }

  return quotes;
}

/** Get all unique tickers from holdings to refresh. */
export function getPortfolioTickers(db: Database.Database): string[] {
  const rows = db
    .prepare("SELECT DISTINCT ticker FROM fin_holdings")
    .all() as { ticker: string }[];
  return rows.map((r) => r.ticker);
}

/** Update holdings with latest prices. */
export async function refreshHoldingPrices(
  db: Database.Database
): Promise<number> {
  const tickers = getPortfolioTickers(db);
  let updated = 0;

  for (const ticker of tickers) {
    const quote = await getQuote(ticker, db);
    if (quote) {
      db.prepare(
        `UPDATE fin_holdings
         SET current_price = ?, current_value = shares * ?, last_updated = ?
         WHERE ticker = ?`
      ).run(quote.price, quote.price, new Date().toISOString(), ticker);
      updated++;
    }
  }

  return updated;
}
