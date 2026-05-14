import type Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import type { CategoryBreakdown, Anomaly } from "../../schemas/transaction.js";
import type { ReportSummary } from "../../schemas/market.js";
import { detectAnomalies } from "../anomaly.js";

export function querySpending(
  db: Database.Database,
  params: {
    period: "month" | "quarter" | "ytd" | "custom";
    category?: string;
    account?: string;
    start?: string;
    end?: string;
    currency?: string;
  }
): { breakdown: CategoryBreakdown[]; total: number; currency: string } {
  const { startDate, endDate } = resolvePeriod(params.period, params.start, params.end);
  const currency = params.currency ?? "CAD";

  let sql = `
    SELECT category, subcategory, SUM(amount) as total, COUNT(*) as count, currency
    FROM fin_transactions
    WHERE date >= ? AND date <= ? AND amount < 0
  `;
  const sqlParams: (string | number)[] = [startDate, endDate];

  if (params.category) {
    sql += " AND category = ?";
    sqlParams.push(params.category);
  }
  if (params.account) {
    sql += " AND account_id = ?";
    sqlParams.push(params.account);
  }

  sql += " GROUP BY category, subcategory ORDER BY total ASC";

  const rows = db.prepare(sql).all(...sqlParams) as {
    category: string;
    subcategory: string;
    total: number;
    count: number;
    currency: string;
  }[];

  const grandTotal = rows.reduce((s, r) => s + Math.abs(r.total), 0);

  const breakdown: CategoryBreakdown[] = rows.map((r) => ({
    category: r.category ?? "uncategorized",
    subcategory: r.subcategory,
    total: Math.abs(r.total),
    count: r.count,
    currency: currency as "CAD" | "USD" | "INR",
    pct_of_total: grandTotal > 0 ? Math.round((Math.abs(r.total) / grandTotal) * 10000) / 100 : 0,
  }));

  return { breakdown, total: grandTotal, currency };
}

export function monthlyReport(
  db: Database.Database,
  params: { year: number; month: number; vault_path?: string }
): { report_path: string; summary: ReportSummary } {
  const monthStr = `${params.year}-${String(params.month).padStart(2, "0")}`;
  const startDate = `${monthStr}-01`;
  const endDate = `${monthStr}-31`; // SQLite handles overflow gracefully

  // Income
  const incomeRow = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM fin_transactions
       WHERE date >= ? AND date <= ? AND amount > 0`
    )
    .get(startDate, endDate) as { total: number };

  // Expenses
  const expenseRow = db
    .prepare(
      `SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM fin_transactions
       WHERE date >= ? AND date <= ? AND amount < 0`
    )
    .get(startDate, endDate) as { total: number };

  // Top categories
  const topCats = db
    .prepare(
      `SELECT category, SUM(ABS(amount)) as total, COUNT(*) as count
       FROM fin_transactions
       WHERE date >= ? AND date <= ? AND amount < 0
       GROUP BY category ORDER BY total DESC LIMIT 10`
    )
    .all(startDate, endDate) as { category: string; total: number; count: number }[];

  // Recurring count
  const recurringRow = db
    .prepare(
      `SELECT COUNT(DISTINCT merchant_normalized) as count FROM fin_transactions
       WHERE date >= ? AND date <= ? AND is_recurring = 1`
    )
    .get(startDate, endDate) as { count: number };

  // Anomalies
  const anomalies = detectAnomalies(db, startDate);
  const monthAnomalies = anomalies.filter((a) => {
    const txn = db
      .prepare("SELECT date FROM fin_transactions WHERE id = ?")
      .get(a.transaction_id) as { date: string } | undefined;
    return txn && txn.date >= startDate && txn.date <= endDate;
  });

  const totalIncome = incomeRow.total;
  const totalExpenses = expenseRow.total;
  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  const summary: ReportSummary = {
    period: monthStr,
    total_income: Math.round(totalIncome * 100) / 100,
    total_expenses: Math.round(totalExpenses * 100) / 100,
    net_savings: Math.round(netSavings * 100) / 100,
    savings_rate: Math.round(savingsRate * 100) / 100,
    top_categories: topCats.map((c) => ({
      category: c.category ?? "uncategorized",
      amount: Math.round(c.total * 100) / 100,
      pct: totalExpenses > 0 ? Math.round((c.total / totalExpenses) * 10000) / 100 : 0,
    })),
    anomaly_count: monthAnomalies.length,
    recurring_count: recurringRow.count,
    currency: "CAD",
  };

  // Write vault file
  const vaultDir = params.vault_path ?? path.join(process.cwd(), "vault", "domains", "finance");
  fs.mkdirSync(vaultDir, { recursive: true });

  const reportPath = path.join(vaultDir, `${monthStr}.md`);
  const md = generateReportMarkdown(summary, topCats, monthAnomalies);
  fs.writeFileSync(reportPath, md, "utf-8");

  return { report_path: reportPath, summary };
}

export function listAnomalies(
  db: Database.Database,
  params: { since?: string; severity?: "low" | "medium" | "high" }
): Anomaly[] {
  let anomalies = detectAnomalies(db, params.since);

  if (params.severity) {
    anomalies = anomalies.filter((a) => a.severity === params.severity);
  }

  return anomalies;
}

function resolvePeriod(
  period: string,
  start?: string,
  end?: string
): { startDate: string; endDate: string } {
  const now = new Date();

  switch (period) {
    case "month": {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      return { startDate: `${y}-${m}-01`, endDate: `${y}-${m}-31` };
    }
    case "quarter": {
      const y = now.getFullYear();
      const q = Math.floor(now.getMonth() / 3);
      const qStart = q * 3 + 1;
      return {
        startDate: `${y}-${String(qStart).padStart(2, "0")}-01`,
        endDate: `${y}-${String(qStart + 2).padStart(2, "0")}-31`,
      };
    }
    case "ytd": {
      return {
        startDate: `${now.getFullYear()}-01-01`,
        endDate: now.toISOString().split("T")[0]!,
      };
    }
    case "custom":
      return {
        startDate: start ?? `${now.getFullYear()}-01-01`,
        endDate: end ?? now.toISOString().split("T")[0]!,
      };
    default:
      return {
        startDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
        endDate: now.toISOString().split("T")[0]!,
      };
  }
}

function generateReportMarkdown(
  summary: ReportSummary,
  topCats: { category: string; total: number }[],
  anomalies: Anomaly[]
): string {
  const entityIds = topCats.map((c) => `category:${c.category}`);

  let md = `---
created: ${new Date().toISOString()}
domain: finance
type: monthly-report
period: ${summary.period}
entities: [${entityIds.join(", ")}]
---

# Monthly Financial Report — ${summary.period}

## Cash Flow Summary

| Metric | Amount |
|--------|--------|
| **Income** | $${summary.total_income.toLocaleString()} |
| **Expenses** | $${summary.total_expenses.toLocaleString()} |
| **Net Savings** | $${summary.net_savings.toLocaleString()} |
| **Savings Rate** | ${summary.savings_rate}% |

## Top Spending Categories

| Category | Amount | % of Total |
|----------|--------|-----------|
`;

  for (const cat of summary.top_categories) {
    md += `| ${cat.category} | $${cat.amount.toLocaleString()} | ${cat.pct}% |\n`;
  }

  md += `\n## Recurring Charges\n\n${summary.recurring_count} recurring merchants detected this month.\n`;

  if (anomalies.length > 0) {
    md += `\n## Anomalies (${anomalies.length})\n\n`;
    for (const a of anomalies) {
      md += `- **${a.merchant}** (${a.category}): $${Math.abs(a.amount)} — ${a.sigma_deviation}σ above average (expected ~$${a.expected_mean}) [${a.severity}]\n`;
    }
  }

  return md;
}
