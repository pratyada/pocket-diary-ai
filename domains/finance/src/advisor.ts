#!/usr/bin/env node
/**
 * Pocket Diary AI — Financial Advisor Agent
 *
 * An agentic AI that analyzes all your finance data and produces
 * actionable guidance. Runs as a digest (weekly/monthly) or on-demand.
 *
 * Run: npx tsx src/advisor.ts [digest|checkup|deep-dive]
 */

import fs from "fs";
import path from "path";
import { getDb, closeDb } from "./db.js";
import { querySpending } from "./handlers/spending.js";
import { driftReport } from "./handlers/portfolio.js";
import { detectAnomalies } from "./anomaly.js";
import { analyzeMistakePatterns } from "./handlers/mistakes.js";
import { toCAD } from "./currency.js";

interface AdvisorInsight {
  priority: "urgent" | "important" | "info";
  category: string;
  title: string;
  detail: string;
  action: string;
}

// ─── Core analysis functions ─────────────────────────────────────────

function analyzeSpendingHealth(db: ReturnType<typeof getDb>): AdvisorInsight[] {
  const insights: AdvisorInsight[] = [];
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;

  // This month's spending
  const current = querySpending(db, {
    period: "custom",
    start: `${thisMonth}-01`,
    end: `${thisMonth}-31`,
  });

  // Last month's spending
  const previous = querySpending(db, {
    period: "custom",
    start: `${lastMonthStr}-01`,
    end: `${lastMonthStr}-31`,
  });

  // Month-over-month change
  if (previous.total > 0 && current.total > 0) {
    const change = ((current.total - previous.total) / previous.total) * 100;
    if (change > 20) {
      insights.push({
        priority: "urgent",
        category: "spending",
        title: `Spending up ${change.toFixed(0)}% vs last month`,
        detail: `This month: $${current.total.toFixed(0)} vs last month: $${previous.total.toFixed(0)}`,
        action: "Review your top categories below and identify what spiked.",
      });
    } else if (change < -10) {
      insights.push({
        priority: "info",
        category: "spending",
        title: `Spending down ${Math.abs(change).toFixed(0)}% vs last month`,
        detail: `This month: $${current.total.toFixed(0)} vs last month: $${previous.total.toFixed(0)}`,
        action: "Great discipline. Keep it up.",
      });
    }
  }

  // Category analysis — flag any category > 30% of total
  for (const cat of current.breakdown) {
    if (cat.pct_of_total > 30 && cat.category !== "housing") {
      insights.push({
        priority: "important",
        category: "spending",
        title: `${cat.category} is ${cat.pct_of_total}% of your spending`,
        detail: `$${cat.total.toFixed(0)} across ${cat.count} transactions`,
        action: `Consider setting a monthly budget cap for ${cat.category}.`,
      });
    }
  }

  // Savings rate
  const income = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM fin_transactions
       WHERE date >= ? AND date <= ? AND amount > 0`
    )
    .get(`${thisMonth}-01`, `${thisMonth}-31`) as { total: number };

  if (income.total > 0) {
    const savingsRate = ((income.total - current.total) / income.total) * 100;
    if (savingsRate < 20) {
      insights.push({
        priority: "urgent",
        category: "savings",
        title: `Savings rate is only ${savingsRate.toFixed(0)}%`,
        detail: `Income: $${income.total.toFixed(0)}, Expenses: $${current.total.toFixed(0)}`,
        action: "Target at least 20-30% savings rate. Review subscriptions and dining first — they're usually the quick wins.",
      });
    } else if (savingsRate >= 40) {
      insights.push({
        priority: "info",
        category: "savings",
        title: `Excellent savings rate: ${savingsRate.toFixed(0)}%`,
        detail: `Saving $${(income.total - current.total).toFixed(0)} this month`,
        action: "Consider deploying excess savings into TFSA/RRSP.",
      });
    }
  }

  return insights;
}

function analyzeSubscriptions(db: ReturnType<typeof getDb>): AdvisorInsight[] {
  const insights: AdvisorInsight[] = [];

  // Find recurring transactions
  const recurring = db
    .prepare(
      `SELECT merchant_normalized, AVG(ABS(amount)) as avg_amount, COUNT(*) as count, currency
       FROM fin_transactions
       WHERE is_recurring = 1 AND amount < 0
       GROUP BY merchant_normalized
       ORDER BY avg_amount DESC`
    )
    .all() as { merchant_normalized: string; avg_amount: number; count: number; currency: string }[];

  const monthlyBurn = recurring.reduce((s, r) => s + r.avg_amount, 0);

  if (monthlyBurn > 0) {
    insights.push({
      priority: "important",
      category: "subscriptions",
      title: `You have ${recurring.length} recurring charges totaling ~$${monthlyBurn.toFixed(0)}/month`,
      detail: recurring.map((r) => `  ${r.merchant_normalized}: $${r.avg_amount.toFixed(2)}`).join("\n"),
      action: "Review each subscription. Cancel anything you haven't used in 30 days.",
    });
  }

  // Flag expensive recurring charges
  for (const r of recurring) {
    if (r.avg_amount > 50) {
      insights.push({
        priority: "info",
        category: "subscriptions",
        title: `${r.merchant_normalized}: $${r.avg_amount.toFixed(2)}/occurrence`,
        detail: `Charged ${r.count} times in your history`,
        action: `Is this still worth it? That's $${(r.avg_amount * 12).toFixed(0)}/year.`,
      });
    }
  }

  return insights;
}

function analyzeInvestments(db: ReturnType<typeof getDb>): AdvisorInsight[] {
  const insights: AdvisorInsight[] = [];

  // Portfolio drift
  const drift = driftReport(db, { owner: "prateek" });

  for (const item of drift.drift) {
    if (Math.abs(item.drift_pct) > 5) {
      insights.push({
        priority: "important",
        category: "investments",
        title: `${item.asset_class} is ${item.drift_pct > 0 ? "overweight" : "underweight"} by ${Math.abs(item.drift_pct).toFixed(1)}%`,
        detail: `Target: ${item.target_pct}%, Actual: ${item.actual_pct}%`,
        action: item.action === "buy"
          ? `Consider buying ~$${item.amount_to_rebalance?.amount.toFixed(0)} of ${item.asset_class}`
          : `Consider trimming ~$${item.amount_to_rebalance?.amount.toFixed(0)} of ${item.asset_class}`,
      });
    }
  }

  // Holdings concentration
  const holdings = db
    .prepare(
      `SELECT ticker, COALESCE(current_value, shares * avg_cost) as value
       FROM fin_holdings ORDER BY value DESC`
    )
    .all() as { ticker: string; value: number }[];

  const totalValue = holdings.reduce((s, h) => s + h.value, 0);

  for (const h of holdings) {
    const pct = (h.value / totalValue) * 100;
    if (pct > 25 && totalValue > 0) {
      insights.push({
        priority: "urgent",
        category: "investments",
        title: `${h.ticker} is ${pct.toFixed(0)}% of your portfolio`,
        detail: `Value: $${h.value.toFixed(0)} of $${totalValue.toFixed(0)} total`,
        action: "No single position should be >20%. Consider trimming to reduce risk.",
      });
    }
  }

  // TFSA/RRSP/RESP contribution reminders (simple check)
  insights.push({
    priority: "info",
    category: "investments",
    title: "Annual contribution check",
    detail: "2026 limits: TFSA $7,000 | RRSP 18% of income (max $31,560) | RESP $2,500 (for CESG match)",
    action: "Run 'invest 10000' to see personalized suggestions for where to deploy cash.",
  });

  return insights;
}

function analyzeMistakes(db: ReturnType<typeof getDb>): AdvisorInsight[] {
  const insights: AdvisorInsight[] = [];

  const { patterns } = analyzeMistakePatterns(db);

  for (const p of patterns) {
    insights.push({
      priority: p.total_loss > 1000 ? "urgent" : "important",
      category: "learning",
      title: `Repeating pattern: ${p.category} (${p.occurrence_count}x, $${p.total_loss} total loss)`,
      detail: p.lessons.slice(0, 3).join(" | "),
      action: p.recommendation,
    });
  }

  return insights;
}

function analyzeAnomalies(db: ReturnType<typeof getDb>): AdvisorInsight[] {
  const anomalies = detectAnomalies(db);
  return anomalies.slice(0, 5).map((a) => ({
    priority: a.severity === "high" ? "urgent" : a.severity === "medium" ? "important" : "info",
    category: "anomalies",
    title: `Unusual charge: ${a.merchant} — $${Math.abs(a.amount).toFixed(2)}`,
    detail: `${a.sigma_deviation}x above your average of $${a.expected_mean.toFixed(2)} for ${a.category}`,
    action: "Verify this transaction. If legitimate, no action needed.",
  }));
}

// ─── Digest generation ─────────────────────────────────────────────

function generateDigest(insights: AdvisorInsight[]): string {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];

  const urgent = insights.filter((i) => i.priority === "urgent");
  const important = insights.filter((i) => i.priority === "important");
  const info = insights.filter((i) => i.priority === "info");

  let md = `---
created: ${now.toISOString()}
domain: finance
type: advisor-digest
---

# Financial Advisor Digest — ${dateStr}

`;

  if (urgent.length > 0) {
    md += `## !! Action Required (${urgent.length})\n\n`;
    for (const i of urgent) {
      md += `### ${i.title}\n${i.detail}\n\n**Action:** ${i.action}\n\n`;
    }
  }

  if (important.length > 0) {
    md += `## Worth Your Attention (${important.length})\n\n`;
    for (const i of important) {
      md += `### ${i.title}\n${i.detail}\n\n**Action:** ${i.action}\n\n`;
    }
  }

  if (info.length > 0) {
    md += `## FYI (${info.length})\n\n`;
    for (const i of info) {
      md += `- **${i.title}** — ${i.action}\n`;
    }
  }

  md += `\n---\n*Generated by Pocket Diary AI Financial Advisor*\n`;
  return md;
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  const mode = process.argv[2] ?? "checkup";
  const db = getDb();

  console.log("\n" + "=".repeat(60));
  console.log("  POCKET DIARY AI — Financial Advisor");
  console.log("=".repeat(60));

  const allInsights: AdvisorInsight[] = [];

  console.log("\nAnalyzing your finances...\n");

  // Run all analyses
  const spending = analyzeSpendingHealth(db);
  allInsights.push(...spending);
  console.log(`  [x] Spending health: ${spending.length} insights`);

  const subs = analyzeSubscriptions(db);
  allInsights.push(...subs);
  console.log(`  [x] Subscriptions: ${subs.length} insights`);

  const investments = analyzeInvestments(db);
  allInsights.push(...investments);
  console.log(`  [x] Investments: ${investments.length} insights`);

  const mistakes = analyzeMistakes(db);
  allInsights.push(...mistakes);
  console.log(`  [x] Mistake patterns: ${mistakes.length} insights`);

  const anomalies = analyzeAnomalies(db);
  allInsights.push(...anomalies);
  console.log(`  [x] Anomalies: ${anomalies.length} insights`);

  // Sort by priority
  const priorityOrder = { urgent: 0, important: 1, info: 2 };
  allInsights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Print to console
  const urgent = allInsights.filter((i) => i.priority === "urgent");
  const important = allInsights.filter((i) => i.priority === "important");
  const info = allInsights.filter((i) => i.priority === "info");

  if (urgent.length > 0) {
    console.log(`\n${"!".repeat(3)} ACTION REQUIRED (${urgent.length}) ${"!".repeat(3)}\n`);
    for (const i of urgent) {
      console.log(`  [${i.category.toUpperCase()}] ${i.title}`);
      console.log(`    ${i.detail}`);
      console.log(`    >> ${i.action}\n`);
    }
  }

  if (important.length > 0) {
    console.log(`\nWORTH YOUR ATTENTION (${important.length})\n`);
    for (const i of important) {
      console.log(`  [${i.category.toUpperCase()}] ${i.title}`);
      console.log(`    ${i.detail}`);
      console.log(`    >> ${i.action}\n`);
    }
  }

  if (info.length > 0) {
    console.log(`\nFYI (${info.length})\n`);
    for (const i of info) {
      console.log(`  [${i.category}] ${i.title} — ${i.action}`);
    }
  }

  // Save digest to vault
  if (mode === "digest" || mode === "deep-dive") {
    const digest = generateDigest(allInsights);
    const vaultDir = path.join(process.cwd(), "vault", "domains", "finance", "advisor");
    fs.mkdirSync(vaultDir, { recursive: true });
    const digestPath = path.join(vaultDir, `${new Date().toISOString().split("T")[0]}.md`);
    fs.writeFileSync(digestPath, digest, "utf-8");
    console.log(`\nDigest saved to: ${digestPath}`);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${allInsights.length} total insights: ${urgent.length} urgent, ${important.length} important, ${info.length} info`);
  console.log(`${"=".repeat(60)}\n`);

  closeDb();
}

main().catch((err) => {
  console.error("Advisor error:", err);
  closeDb();
  process.exit(1);
});
