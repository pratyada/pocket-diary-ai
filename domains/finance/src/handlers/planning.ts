import type Database from "better-sqlite3";
import type { InvestSuggestion } from "../../schemas/portfolio.js";
import type { MonthForecast } from "../../schemas/market.js";
import type { Money } from "../../schemas/common.js";
import { toCAD } from "../currency.js";

interface NetWorthBreakdown {
  by_region: { region: string; total_cad: number; accounts: { id: string; value: number; currency: string }[] }[];
  by_type: { type: string; total_cad: number }[];
  total: Money;
}

export function netWorth(db: Database.Database): NetWorthBreakdown {
  // Investment holdings
  const holdings = db
    .prepare(
      `SELECT account_id, currency, SUM(COALESCE(current_value, shares * avg_cost)) as total
       FROM fin_holdings GROUP BY account_id`
    )
    .all() as { account_id: string; currency: string; total: number }[];

  // Bank account balances (from most recent transaction balance if tracked)
  // For now, just sum holdings

  // Group by assumed region from account_id or currency
  const byRegion = new Map<string, { total_cad: number; accounts: { id: string; value: number; currency: string }[] }>();

  let grandTotal = 0;

  for (const h of holdings) {
    const region = inferRegion(h.account_id, h.currency);
    const cadValue = toCAD(h.total, h.currency as "CAD" | "USD" | "INR");

    const entry = byRegion.get(region) ?? { total_cad: 0, accounts: [] };
    entry.total_cad += cadValue;
    entry.accounts.push({ id: h.account_id, value: h.total, currency: h.currency });
    byRegion.set(region, entry);

    grandTotal += cadValue;
  }

  const regionBreakdown = [...byRegion.entries()].map(([region, data]) => ({
    region,
    total_cad: Math.round(data.total_cad * 100) / 100,
    accounts: data.accounts,
  }));

  // By type (asset class)
  const byClass = db
    .prepare(
      `SELECT asset_class, SUM(COALESCE(current_value, shares * avg_cost)) as total, currency
       FROM fin_holdings GROUP BY asset_class`
    )
    .all() as { asset_class: string; total: number; currency: string }[];

  const typeBreakdown = byClass.map((c) => ({
    type: c.asset_class,
    total_cad: Math.round(toCAD(c.total, c.currency as "CAD" | "USD" | "INR") * 100) / 100,
  }));

  return {
    by_region: regionBreakdown,
    by_type: typeBreakdown,
    total: { amount: Math.round(grandTotal * 100) / 100, currency: "CAD" },
  };
}

export function whereToInvest(
  db: Database.Database,
  params: { amount: Money; owner: string; goal?: string }
): InvestSuggestion[] {
  const suggestions: InvestSuggestion[] = [];
  const amount = toCAD(params.amount.amount, params.amount.currency as "CAD" | "USD" | "INR");

  // Check TFSA room
  const tfsaAccounts = db
    .prepare("SELECT * FROM fin_holdings WHERE account_id LIKE '%tfsa%'")
    .all() as { account_id: string }[];

  // 2026 TFSA limit = $7,000 (cumulative since 2009)
  suggestions.push({
    account_id: tfsaAccounts[0]?.account_id ?? "invest:tfsa",
    account_type: "tfsa",
    reason: "TFSA: tax-free growth. No tax on withdrawals. Prioritize if you have contribution room.",
    suggested_amount: { amount: Math.min(amount, 7000), currency: "CAD" },
    suggested_assets: [
      {
        ticker: "VFV.TO",
        asset_class: "equity_us",
        allocation_pct: 40,
        rationale: "S&P 500 exposure via low-cost Canadian-listed ETF",
      },
      {
        ticker: "XIC.TO",
        asset_class: "equity_ca",
        allocation_pct: 20,
        rationale: "Canadian market exposure for dividend tax efficiency",
      },
      {
        ticker: "XEF.TO",
        asset_class: "equity_intl",
        allocation_pct: 20,
        rationale: "International developed markets diversification",
      },
      {
        ticker: "ZAG.TO",
        asset_class: "fixed_income",
        allocation_pct: 20,
        rationale: "Canadian bond exposure for stability",
      },
    ],
    tax_benefit: "All gains and income are tax-free forever",
  });

  // RRSP suggestion
  suggestions.push({
    account_id: "invest:rrsp",
    account_type: "rrsp",
    reason: "RRSP: tax-deferred growth. Contributions reduce taxable income. Best for higher tax brackets.",
    suggested_amount: { amount: Math.min(amount, 31560), currency: "CAD" }, // 2026 limit
    suggested_assets: [
      {
        ticker: "VTI",
        asset_class: "equity_us",
        allocation_pct: 50,
        rationale: "US-listed for withholding tax efficiency in RRSP (US-Canada treaty)",
      },
      {
        ticker: "VXUS",
        asset_class: "equity_intl",
        allocation_pct: 30,
        rationale: "International diversification",
      },
      {
        ticker: "BND",
        asset_class: "fixed_income",
        allocation_pct: 20,
        rationale: "US bond market, good for RRSP (interest income taxed at marginal rate otherwise)",
      },
    ],
    tax_benefit: "Contributions reduce taxable income; gains taxed only on withdrawal",
  });

  // RESP for Ved
  suggestions.push({
    account_id: "invest:resp",
    account_type: "resp",
    reason: "RESP for Ved: Government matches 20% of contributions (CESG) up to $2,500/year = $500 free.",
    suggested_amount: { amount: Math.min(amount, 2500), currency: "CAD" },
    suggested_assets: [
      {
        ticker: "VGRO.TO",
        asset_class: "equity_us",
        allocation_pct: 80,
        rationale: "Aggressive growth ETF — long time horizon (Ved is young)",
      },
      {
        ticker: "ZAG.TO",
        asset_class: "fixed_income",
        allocation_pct: 20,
        rationale: "Small bond allocation for stability",
      },
    ],
    tax_benefit: "$500/year CESG match + tax-sheltered growth. Taxed in child's hands at withdrawal (low rate).",
  });

  return suggestions;
}

export function expenseForecast(
  db: Database.Database,
  params: { months: number }
): MonthForecast[] {
  // Get last 6 months of spending by category
  const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString().split("T")[0]!;

  const monthlyTotals = db
    .prepare(
      `SELECT strftime('%Y-%m', date) as month,
              SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
              SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expenses
       FROM fin_transactions
       WHERE date >= ?
       GROUP BY month ORDER BY month`
    )
    .all(sixMonthsAgo) as { month: string; income: number; expenses: number }[];

  const avgIncome = monthlyTotals.length > 0
    ? monthlyTotals.reduce((s, m) => s + m.income, 0) / monthlyTotals.length
    : 0;
  const avgExpenses = monthlyTotals.length > 0
    ? monthlyTotals.reduce((s, m) => s + m.expenses, 0) / monthlyTotals.length
    : 0;

  // Category trends
  const catTrends = db
    .prepare(
      `SELECT category,
              strftime('%Y-%m', date) as month,
              SUM(ABS(amount)) as total
       FROM fin_transactions
       WHERE date >= ? AND amount < 0
       GROUP BY category, month`
    )
    .all(sixMonthsAgo) as { category: string; month: string; total: number }[];

  // Compute per-category average and trend
  const catMap = new Map<string, number[]>();
  for (const row of catTrends) {
    const arr = catMap.get(row.category) ?? [];
    arr.push(row.total);
    catMap.set(row.category, arr);
  }

  const forecasts: MonthForecast[] = [];
  const now = new Date();

  for (let i = 1; i <= params.months; i++) {
    const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}`;

    const topCategories = [...catMap.entries()]
      .map(([category, values]) => {
        const avg = values.reduce((s, v) => s + v, 0) / values.length;
        const last = values[values.length - 1] ?? avg;
        const trend: "rising" | "stable" | "falling" =
          last > avg * 1.1 ? "rising" : last < avg * 0.9 ? "falling" : "stable";
        return { category, projected: Math.round(avg * 100) / 100, trend };
      })
      .sort((a, b) => b.projected - a.projected)
      .slice(0, 5);

    forecasts.push({
      month: monthStr,
      projected_income: Math.round(avgIncome * 100) / 100,
      projected_expenses: Math.round(avgExpenses * 100) / 100,
      projected_savings: Math.round((avgIncome - avgExpenses) * 100) / 100,
      confidence: Math.max(0.5, 1 - i * 0.1), // confidence drops further out
      top_categories: topCategories,
    });
  }

  return forecasts;
}

function inferRegion(accountId: string, currency: string): string {
  if (currency === "INR") return "India";
  if (currency === "USD") return "USA";
  if (accountId.includes("hdfc") || accountId.includes("sbi") || accountId.includes("icici")) return "India";
  if (accountId.includes("chase") || accountId.includes("schwab")) return "USA";
  return "Canada";
}
