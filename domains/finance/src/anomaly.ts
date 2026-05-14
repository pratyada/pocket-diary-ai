import type Database from "better-sqlite3";
import type { Anomaly } from "../schemas/transaction.js";
import { v4 as uuid } from "uuid";

interface TxnRow {
  merchant_normalized: string;
  category: string;
  amount: number;
  currency: string;
  date: string;
  id: string;
}

interface Stats {
  mean: number;
  stddev: number;
  count: number;
}

function computeStats(values: number[]): Stats {
  if (values.length === 0) return { mean: 0, stddev: 0, count: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return { mean, stddev: Math.sqrt(variance), count: values.length };
}

/**
 * Detect anomalies: transactions where the amount deviates > 2σ
 * from the rolling 6-month mean for (merchant, category) pair.
 */
export function detectAnomalies(
  db: Database.Database,
  since?: string
): Anomaly[] {
  const sixMonthsAgo = since
    ?? new Date(Date.now() - 180 * 86400000).toISOString().split("T")[0]!;

  // Get all transactions in the window
  const recentTxns = db
    .prepare(
      `SELECT id, merchant_normalized, category, amount, currency, date
       FROM fin_transactions
       WHERE date >= ? AND amount < 0
       ORDER BY date ASC`
    )
    .all(sixMonthsAgo) as TxnRow[];

  // Group by (merchant, category)
  const groups = new Map<string, TxnRow[]>();
  for (const txn of recentTxns) {
    const key = `${txn.merchant_normalized}::${txn.category}`;
    const group = groups.get(key) ?? [];
    group.push(txn);
    groups.set(key, group);
  }

  const anomalies: Anomaly[] = [];

  for (const [_, txns] of groups) {
    if (txns.length < 3) continue; // need at least 3 data points

    const amounts = txns.map((t) => Math.abs(t.amount));
    const stats = computeStats(amounts);
    if (stats.stddev === 0) continue;

    for (const txn of txns) {
      const absAmount = Math.abs(txn.amount);
      const sigmas = (absAmount - stats.mean) / stats.stddev;

      if (sigmas > 2) {
        anomalies.push({
          id: `anomaly:${uuid()}`,
          transaction_id: txn.id,
          category: txn.category ?? "uncategorized",
          merchant: txn.merchant_normalized ?? txn.id,
          amount: txn.amount,
          currency: txn.currency as "CAD" | "USD" | "INR",
          expected_mean: Math.round(stats.mean * 100) / 100,
          expected_stddev: Math.round(stats.stddev * 100) / 100,
          sigma_deviation: Math.round(sigmas * 100) / 100,
          severity: sigmas > 4 ? "high" : sigmas > 3 ? "medium" : "low",
          detected_at: new Date().toISOString(),
        });
      }
    }
  }

  return anomalies.sort((a, b) => b.sigma_deviation - a.sigma_deviation);
}
