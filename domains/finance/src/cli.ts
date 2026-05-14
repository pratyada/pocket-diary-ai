#!/usr/bin/env node
/**
 * Pocket Diary AI — Finance Domain CLI
 *
 * Interactive testing tool for all finance capabilities.
 * Run: npx tsx src/cli.ts <command> [options]
 */

import path from "path";
import { handleToolCall } from "./server.js";
import { getDb, closeDb } from "./db.js";

const HELP = `
Pocket Diary AI — Finance Domain CLI
=====================================

STATEMENTS & SPENDING
  import <file> [--account <id>] [--currency CAD|USD|INR]
      Import a bank statement (CSV or PDF)

  spending [--period month|quarter|ytd] [--category <cat>]
      Show spending breakdown

  report <year> <month>
      Generate monthly cash-flow report to vault

  anomalies [--severity low|medium|high]
      List spending anomalies (>2σ from average)

INVESTMENTS & PORTFOLIO
  holdings <file> --account <id> [--currency CAD|USD|INR]
      Import holdings from brokerage CSV

  portfolio [--owner prateek|partner]
      Show consolidated portfolio summary

  drift [--owner prateek|partner]
      Show allocation drift vs targets

  market [--tickers AAPL,VFV.TO,RELIANCE.NS]
      Get market quotes + major index levels

  watchlist [add|remove|list] [--ticker <t>] [--name <n>]
      Manage price alert watchlist

  invest <amount> [--currency CAD] [--owner prateek]
      Get where-to-invest suggestions (TFSA/RRSP/RESP)

PLANNING & LEARNING
  networth
      Net worth across all regions

  forecast [--months 6]
      Expense forecast

  mistake log --ticker <t> --action <what> --lesson <why> --fix <what-differently> [--category fomo|panic_sell|timing|...]
      Log an investment mistake

  mistake list [--category <cat>]
      List past mistakes

  mistake analyze
      Analyze mistake patterns + get recommendations

DEMO
  demo
      Run a full demo with sample data (no real files needed)

  help
      Show this help
`;

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === "help" || cmd === "--help") {
    console.log(HELP);
    process.exit(0);
  }

  try {
    if (cmd === "demo") {
      await runDemo();
      return;
    }

    const result = await dispatch(cmd, args.slice(1));
    if (result) {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (err) {
    console.error("Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    closeDb();
  }
}

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

async function dispatch(cmd: string, args: string[]) {
  switch (cmd) {
    // === Statements ===
    case "import": {
      const file = args[0];
      if (!file) throw new Error("Usage: import <file> [--account <id>] [--currency CAD|USD|INR]");
      const account = getArg(args, "--account") ?? "account:rbc-chequing";
      const currency = getArg(args, "--currency") ?? "CAD";
      const result = await handleToolCall({
        name: "import_statement",
        params: { path: path.resolve(file), account_id: account, currency, format: "auto" },
      });
      if (result.success) {
        const d = result.data as { stats: Record<string, unknown>; transactions: unknown[] };
        console.log("\n--- Import Results ---");
        console.log(`Imported: ${d.stats.imported} transactions`);
        console.log(`Skipped:  ${d.stats.skipped} (duplicates)`);
        console.log(`Duration: ${d.stats.duration_ms}ms`);
        console.log(`\nFirst 5 transactions:`);
        const txns = d.transactions.slice(0, 5) as Record<string, unknown>[];
        for (const t of txns) {
          console.log(`  ${t.date}  ${String(t.merchant_raw).padEnd(30)} ${String(t.amount).padStart(10)}  [${t.category}/${t.subcategory}]  conf:${t.confidence}`);
        }
      }
      return result;
    }

    case "spending": {
      const period = getArg(args, "--period") ?? "month";
      const category = getArg(args, "--category");
      const result = await handleToolCall({
        name: "query_spending",
        params: { period, category },
      });
      if (result.success) {
        const d = result.data as { breakdown: Record<string, unknown>[]; total: number };
        console.log("\n--- Spending Breakdown ---");
        console.log(`${"Category".padEnd(25)} ${"Amount".padStart(12)} ${"Count".padStart(6)} ${"% of Total".padStart(10)}`);
        console.log("-".repeat(55));
        for (const b of d.breakdown) {
          console.log(`${String(b.category).padEnd(25)} $${String(b.total).padStart(10)} ${String(b.count).padStart(6)} ${String(b.pct_of_total).padStart(9)}%`);
        }
        console.log("-".repeat(55));
        console.log(`${"TOTAL".padEnd(25)} $${String(d.total).padStart(10)}`);
      }
      return result;
    }

    case "report": {
      const year = parseInt(args[0] ?? new Date().getFullYear().toString());
      const month = parseInt(args[1] ?? (new Date().getMonth() + 1).toString());
      const result = await handleToolCall({
        name: "monthly_report",
        params: { year, month },
      });
      if (result.success) {
        const d = result.data as { report_path: string; summary: Record<string, unknown> };
        console.log("\n--- Monthly Report ---");
        console.log(`Income:      $${d.summary.total_income}`);
        console.log(`Expenses:    $${d.summary.total_expenses}`);
        console.log(`Net Savings: $${d.summary.net_savings}`);
        console.log(`Savings Rate: ${d.summary.savings_rate}%`);
        console.log(`Anomalies:   ${d.summary.anomaly_count}`);
        console.log(`\nReport saved to: ${d.report_path}`);
      }
      return result;
    }

    case "anomalies": {
      const severity = getArg(args, "--severity");
      return await handleToolCall({
        name: "list_anomalies",
        params: { severity },
      });
    }

    // === Portfolio ===
    case "holdings": {
      const file = args[0];
      if (!file) throw new Error("Usage: holdings <file> --account <id>");
      const account = getArg(args, "--account") ?? "invest:tfsa";
      const currency = getArg(args, "--currency") ?? "CAD";
      const result = await handleToolCall({
        name: "import_holdings",
        params: { path: path.resolve(file), account_id: account, currency },
      });
      if (result.success) {
        const d = result.data as { imported: number; holdings: Record<string, unknown>[] };
        console.log(`\n--- Imported ${d.imported} holdings ---`);
        for (const h of d.holdings) {
          console.log(`  ${String(h.ticker).padEnd(15)} ${String(h.shares).padStart(8)} shares @ $${h.avg_cost}  [${h.asset_class}]`);
        }
      }
      return result;
    }

    case "portfolio": {
      const owner = getArg(args, "--owner");
      const result = await handleToolCall({
        name: "portfolio_summary",
        params: { owner },
      });
      if (result.success) {
        const d = result.data as { portfolios: Record<string, unknown>[]; total_value: Record<string, unknown> };
        console.log("\n--- Portfolio Summary ---");
        for (const p of d.portfolios) {
          console.log(`\n  Account: ${p.account_id}`);
          const holdings = p.holdings as Record<string, unknown>[];
          for (const h of holdings) {
            const gl = Number(h.gain_loss_pct) >= 0 ? `+${h.gain_loss_pct}%` : `${h.gain_loss_pct}%`;
            console.log(`    ${String(h.ticker).padEnd(15)} ${String(h.shares).padStart(8)} shares  Value: $${h.current_value}  ${gl}`);
          }
        }
        console.log(`\n  TOTAL VALUE: $${(d.total_value as Record<string,unknown>).amount} ${(d.total_value as Record<string,unknown>).currency}`);
      }
      return result;
    }

    case "drift": {
      const owner = getArg(args, "--owner");
      const result = await handleToolCall({
        name: "drift_report",
        params: { owner },
      });
      if (result.success) {
        const d = result.data as { drift: Record<string, unknown>[]; rebalance_suggestions: string[] };
        console.log("\n--- Allocation Drift ---");
        console.log(`${"Asset Class".padEnd(20)} ${"Target".padStart(8)} ${"Actual".padStart(8)} ${"Drift".padStart(8)} ${"Action".padStart(8)}`);
        for (const item of d.drift) {
          console.log(`${String(item.asset_class).padEnd(20)} ${String(item.target_pct + "%").padStart(8)} ${String(item.actual_pct + "%").padStart(8)} ${String((Number(item.drift_pct) > 0 ? "+" : "") + item.drift_pct + "%").padStart(8)} ${String(item.action).padStart(8)}`);
        }
        if (d.rebalance_suggestions.length > 0) {
          console.log("\nSuggestions:");
          for (const s of d.rebalance_suggestions) console.log(`  - ${s}`);
        }
      }
      return result;
    }

    case "market": {
      const tickerStr = getArg(args, "--tickers");
      const tickers = tickerStr ? tickerStr.split(",") : [];
      const result = await handleToolCall({
        name: "market_snapshot",
        params: { tickers },
      });
      if (result.success) {
        const d = result.data as { quotes: Record<string, unknown>[]; indices: Record<string, unknown>[] };
        console.log("\n--- Market Indices ---");
        for (const idx of d.indices) {
          const arrow = Number(idx.change) >= 0 ? "+" : "";
          console.log(`  ${String(idx.name).padEnd(20)} ${String(idx.value).padStart(10)}  ${arrow}${idx.change} (${arrow}${idx.change_pct}%)`);
        }
        if (d.quotes.length > 0) {
          console.log("\n--- Quotes ---");
          for (const q of d.quotes) {
            console.log(`  ${String(q.ticker).padEnd(15)} $${String(q.price).padStart(10)}  ${Number(q.change) >= 0 ? "+" : ""}${q.change_pct}%  Vol: ${q.volume}`);
          }
        }
      }
      return result;
    }

    case "watchlist": {
      const action = args[0] ?? "list";
      const ticker = getArg(args, "--ticker");
      const name = getArg(args, "--name");
      return await handleToolCall({
        name: "watchlist",
        params: { action, ticker, name, exchange: "UNKNOWN" },
      });
    }

    case "invest": {
      const amount = parseFloat(args[0] ?? "10000");
      const currency = getArg(args, "--currency") ?? "CAD";
      const owner = getArg(args, "--owner") ?? "prateek";
      const result = await handleToolCall({
        name: "where_to_invest",
        params: { amount: { amount, currency }, owner },
      });
      if (result.success) {
        const suggestions = result.data as Record<string, unknown>[];
        console.log("\n--- Where to Invest ---");
        for (const s of suggestions) {
          console.log(`\n  ${String(s.account_type).toUpperCase()} — ${s.reason}`);
          console.log(`  Suggested: $${(s.suggested_amount as Record<string, unknown>).amount}`);
          if (s.tax_benefit) console.log(`  Tax benefit: ${s.tax_benefit}`);
          const assets = s.suggested_assets as Record<string, unknown>[];
          for (const a of assets) {
            console.log(`    ${String(a.allocation_pct).padStart(3)}%  ${String(a.ticker).padEnd(10)}  ${a.rationale}`);
          }
        }
      }
      return result;
    }

    // === Planning ===
    case "networth": {
      return await handleToolCall({ name: "net_worth", params: {} });
    }

    case "forecast": {
      const months = parseInt(getArg(args, "--months") ?? "6");
      return await handleToolCall({ name: "expense_forecast", params: { months } });
    }

    // === Mistakes ===
    case "mistake": {
      const action = args[0];
      if (action === "log") {
        const entry = {
          date: getArg(args, "--date") ?? new Date().toISOString().split("T")[0],
          ticker: getArg(args, "--ticker"),
          action: getArg(args, "--action") ?? "unspecified",
          lesson: getArg(args, "--lesson") ?? "",
          category: getArg(args, "--category") ?? "other",
          would_do_differently: getArg(args, "--fix") ?? "",
          tags: [],
        };
        const result = await handleToolCall({
          name: "mistake_journal",
          params: { action: "log", entry },
        });
        if (result.success) console.log("\nMistake logged. Learn from it.");
        return result;
      }
      if (action === "list") {
        const category = getArg(args, "--category");
        return await handleToolCall({
          name: "mistake_journal",
          params: { action: "list", category },
        });
      }
      if (action === "analyze") {
        const result = await handleToolCall({
          name: "mistake_journal",
          params: { action: "analyze" },
        });
        if (result.success) {
          const d = result.data as { patterns: Record<string, unknown>[] };
          console.log("\n--- Mistake Pattern Analysis ---");
          for (const p of d.patterns) {
            console.log(`\n  Pattern: ${p.category} (${p.occurrence_count}x, total loss: $${p.total_loss})`);
            console.log(`  ${p.recommendation}`);
          }
        }
        return result;
      }
      throw new Error("Usage: mistake log|list|analyze [options]");
    }

    // === Demo ===
    default:
      console.log(`Unknown command: ${cmd}\nRun with 'help' to see available commands.`);
      process.exit(1);
  }
}

async function runDemo() {
  const fixturesDir = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "fixtures");

  console.log("=".repeat(60));
  console.log("  POCKET DIARY AI — Finance Domain Demo");
  console.log("=".repeat(60));

  // 1. Import sample transactions
  console.log("\n[1/7] Importing sample bank statement...");
  await dispatch("import", [
    path.join(fixturesDir, "sample-transactions.csv"),
    "--account", "account:rbc-chequing",
    "--currency", "CAD",
  ]);

  // 2. Spending breakdown
  console.log("\n[2/7] Spending breakdown...");
  await dispatch("spending", ["--period", "custom"]);

  // 3. Monthly report
  console.log("\n[3/7] Generating monthly report...");
  await dispatch("report", ["2026", "4"]);

  // 4. Import sample holdings
  console.log("\n[4/7] Importing investment holdings...");
  await dispatch("holdings", [
    path.join(fixturesDir, "sample-holdings.csv"),
    "--account", "invest:wealthsimple-tfsa",
    "--currency", "CAD",
  ]);

  // 5. Log a mistake
  console.log("\n[5/7] Logging an investment mistake...");
  await dispatch("mistake", [
    "log",
    "--ticker", "GME",
    "--action", "Bought during meme rally without checking fundamentals",
    "--lesson", "Never buy based on Reddit hype alone",
    "--fix", "Always check P/E ratio and revenue trend before buying",
    "--category", "fomo",
    "--date", "2025-01-15",
  ]);
  await dispatch("mistake", [
    "log",
    "--ticker", "TSLA",
    "--action", "Panic sold during 15% dip",
    "--lesson", "Quality stocks recover, panic selling locks in losses",
    "--fix", "Set stop-loss at entry, then hands off. Review after 48 hours.",
    "--category", "panic_sell",
    "--date", "2025-06-20",
  ]);

  // 6. Where to invest
  console.log("\n[6/7] Where to invest $10,000...");
  await dispatch("invest", ["10000"]);

  // 7. Mistake analysis
  console.log("\n[7/7] Analyzing mistake patterns...");
  await dispatch("mistake", ["analyze"]);

  console.log("\n" + "=".repeat(60));
  console.log("  Demo complete! Your data is in domains/finance/data/finance.db");
  console.log("  Vault report at vault/domains/finance/2026-04.md");
  console.log("=".repeat(60));
}

main();
