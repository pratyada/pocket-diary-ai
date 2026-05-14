import { getDb, closeDb } from "./db.js";
import { importStatement } from "./handlers/statements.js";
import { querySpending, monthlyReport, listAnomalies } from "./handlers/spending.js";
import { portfolioSummary, driftReport, importHoldings } from "./handlers/portfolio.js";
import { marketSnapshot, watchlistAction } from "./handlers/market.js";
import { logMistake, listMistakes, analyzeMistakePatterns } from "./handlers/mistakes.js";
import { netWorth, whereToInvest, expenseForecast } from "./handlers/planning.js";

export interface ToolCall {
  name: string;
  params: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

const TOOL_CATALOG = {
  // Statement & Transaction
  import_statement: {
    description: "Import a bank/card statement (PDF or CSV), parse transactions, categorize, and store",
    params: { path: "string", account_id: "string", currency: "CAD|USD|INR", format: "pdf|csv|auto" },
  },
  query_spending: {
    description: "Query spending breakdown by period, category, or account",
    params: { period: "month|quarter|ytd|custom", category: "string?", account: "string?", start: "string?", end: "string?" },
  },
  monthly_report: {
    description: "Generate monthly cash-flow report and write to vault",
    params: { year: "number", month: "number" },
  },
  list_anomalies: {
    description: "List spending anomalies (transactions > 2σ from rolling average)",
    params: { since: "string?", severity: "low|medium|high?" },
  },

  // Portfolio & Investments
  portfolio_summary: {
    description: "Consolidated portfolio view across all investment accounts",
    params: { owner: "string?", account_type: "string?" },
  },
  import_holdings: {
    description: "Import holdings from a brokerage CSV export",
    params: { path: "string", account_id: "string", currency: "CAD|USD|INR?" },
  },
  drift_report: {
    description: "Compare current allocation vs target, suggest rebalancing",
    params: { owner: "string?" },
  },
  market_snapshot: {
    description: "Get live/cached quotes for tickers and market indices (NASDAQ, TSX, NIFTY)",
    params: { tickers: "string[]?", indices: "string[]?" },
  },
  watchlist: {
    description: "Manage price/volume alert watchlist",
    params: { action: "list|add|remove", ticker: "string?", name: "string?", exchange: "string?", notes: "string?" },
  },

  // Learning & Planning
  mistake_journal: {
    description: "Log investment mistakes and analyze patterns to avoid repeating them",
    params: { action: "log|list|analyze", entry: "MistakeEntry?" },
  },
  net_worth: {
    description: "Net worth across all regions (CA/IN/US) in base currency CAD",
    params: {},
  },
  where_to_invest: {
    description: "Analyze TFSA/RRSP/RESP room and suggest tax-efficient allocation",
    params: { amount: "Money", owner: "string", goal: "string?" },
  },
  expense_forecast: {
    description: "Project expenses N months forward based on historical patterns",
    params: { months: "number" },
  },
};

export async function handleToolCall(call: ToolCall): Promise<ToolResult> {
  const db = getDb();

  try {
    switch (call.name) {
      // === Statements ===
      case "import_statement": {
        const result = await importStatement(db, call.params as {
          path: string;
          account_id: string;
          currency?: "CAD" | "USD" | "INR";
          format?: "pdf" | "csv" | "auto";
        });
        return { success: true, data: result };
      }

      case "query_spending": {
        const result = querySpending(db, call.params as {
          period: "month" | "quarter" | "ytd" | "custom";
          category?: string;
          account?: string;
          start?: string;
          end?: string;
        });
        return { success: true, data: result };
      }

      case "monthly_report": {
        const result = monthlyReport(db, call.params as { year: number; month: number });
        return { success: true, data: result };
      }

      case "list_anomalies": {
        const result = listAnomalies(db, call.params as { since?: string; severity?: "low" | "medium" | "high" });
        return { success: true, data: result };
      }

      // === Portfolio ===
      case "portfolio_summary": {
        const result = await portfolioSummary(db, call.params as { owner?: string; account_type?: string });
        return { success: true, data: result };
      }

      case "import_holdings": {
        const result = importHoldings(db, call.params as { path: string; account_id: string; currency?: "CAD" | "USD" | "INR" });
        return { success: true, data: result };
      }

      case "drift_report": {
        const result = driftReport(db, call.params as { owner?: string });
        return { success: true, data: result };
      }

      case "market_snapshot": {
        const result = await marketSnapshot(db, call.params as { tickers?: string[]; indices?: string[] });
        return { success: true, data: result };
      }

      case "watchlist": {
        const result = watchlistAction(db, call.params as {
          action: "list" | "add" | "remove";
          ticker?: string;
          name?: string;
          exchange?: string;
          notes?: string;
        });
        return { success: true, data: result };
      }

      // === Mistakes ===
      case "mistake_journal": {
        const p = call.params as { action: string; entry?: Record<string, unknown> };
        if (p.action === "log" && p.entry) {
          const result = logMistake(db, p.entry as Parameters<typeof logMistake>[1]);
          return { success: true, data: result };
        }
        if (p.action === "list") {
          const result = listMistakes(db, p as { category?: string; ticker?: string });
          return { success: true, data: { entries: result } };
        }
        if (p.action === "analyze") {
          const result = analyzeMistakePatterns(db);
          return { success: true, data: result };
        }
        return { success: false, error: "Invalid action for mistake_journal" };
      }

      // === Planning ===
      case "net_worth": {
        const result = netWorth(db);
        return { success: true, data: result };
      }

      case "where_to_invest": {
        const result = whereToInvest(db, call.params as {
          amount: { amount: number; currency: "CAD" | "USD" | "INR" };
          owner: string;
          goal?: string;
        });
        return { success: true, data: result };
      }

      case "expense_forecast": {
        const result = expenseForecast(db, call.params as { months: number });
        return { success: true, data: result };
      }

      default:
        return { success: false, error: `Unknown tool: ${call.name}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[finance] Tool ${call.name} failed:`, message);
    return { success: false, error: message };
  }
}

export function getToolCatalog() {
  return TOOL_CATALOG;
}

// Graceful shutdown
process.on("SIGINT", () => {
  closeDb();
  process.exit(0);
});

process.on("SIGTERM", () => {
  closeDb();
  process.exit(0);
});

// If run directly, print the tool catalog
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("[finance] Domain server ready");
  console.log("[finance] Available tools:", Object.keys(TOOL_CATALOG).join(", "));
}
