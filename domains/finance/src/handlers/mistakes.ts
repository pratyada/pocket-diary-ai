import type Database from "better-sqlite3";
import { v4 as uuid } from "uuid";
import type { MistakeEntry } from "../../schemas/portfolio.js";

export function logMistake(
  db: Database.Database,
  entry: Omit<MistakeEntry, "id">
): MistakeEntry {
  const id = `mistake:${uuid()}`;

  db.prepare(
    `INSERT INTO fin_mistakes (id, date, ticker, action, amount, amount_currency, loss_realized, loss_currency, lesson, category, would_do_differently, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    entry.date,
    entry.ticker,
    entry.action,
    entry.amount?.amount,
    entry.amount?.currency,
    entry.loss_realized?.amount,
    entry.loss_realized?.currency,
    entry.lesson,
    entry.category,
    entry.would_do_differently,
    JSON.stringify(entry.tags)
  );

  return { ...entry, id };
}

export function listMistakes(
  db: Database.Database,
  params?: { category?: string; ticker?: string; limit?: number }
): MistakeEntry[] {
  let sql = "SELECT * FROM fin_mistakes";
  const conditions: string[] = [];
  const sqlParams: string[] = [];

  if (params?.category) {
    conditions.push("category = ?");
    sqlParams.push(params.category);
  }
  if (params?.ticker) {
    conditions.push("ticker = ?");
    sqlParams.push(params.ticker);
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }

  sql += " ORDER BY date DESC";

  if (params?.limit) {
    sql += ` LIMIT ${params.limit}`;
  }

  const rows = db.prepare(sql).all(...sqlParams) as Record<string, unknown>[];

  return rows.map((r) => ({
    id: r.id as string,
    date: r.date as string,
    ticker: r.ticker as string | undefined,
    action: r.action as string,
    amount:
      r.amount != null
        ? { amount: r.amount as number, currency: (r.amount_currency as "CAD" | "USD" | "INR") ?? "CAD" }
        : undefined,
    loss_realized:
      r.loss_realized != null
        ? { amount: r.loss_realized as number, currency: (r.loss_currency as "CAD" | "USD" | "INR") ?? "CAD" }
        : undefined,
    lesson: r.lesson as string,
    category: (r.category as MistakeEntry["category"]) ?? "other",
    would_do_differently: r.would_do_differently as string,
    tags: JSON.parse((r.tags as string) ?? "[]") as string[],
  }));
}

export function analyzeMistakePatterns(
  db: Database.Database
): { patterns: Pattern[] } {
  const mistakes = listMistakes(db);

  // Group by category
  const byCategory = new Map<string, MistakeEntry[]>();
  for (const m of mistakes) {
    const cat = m.category;
    const group = byCategory.get(cat) ?? [];
    group.push(m);
    byCategory.set(cat, group);
  }

  const patterns: Pattern[] = [];

  for (const [category, entries] of byCategory) {
    if (entries.length < 2) continue;

    const totalLoss = entries.reduce(
      (s, e) => s + (e.loss_realized?.amount ?? 0),
      0
    );

    const lessons = entries.map((e) => e.lesson);
    const tickers = [...new Set(entries.map((e) => e.ticker).filter(Boolean))];

    patterns.push({
      category,
      occurrence_count: entries.length,
      total_loss: Math.round(totalLoss * 100) / 100,
      common_tickers: tickers as string[],
      lessons,
      recommendation: generateRecommendation(category, entries.length),
    });
  }

  return {
    patterns: patterns.sort((a, b) => b.total_loss - a.total_loss),
  };
}

interface Pattern {
  category: string;
  occurrence_count: number;
  total_loss: number;
  common_tickers: string[];
  lessons: string[];
  recommendation: string;
}

function generateRecommendation(category: string, count: number): string {
  const recommendations: Record<string, string> = {
    fomo: `FOMO pattern detected ${count}x. Consider: set a 48-hour cooling period before any buy triggered by news/social media.`,
    panic_sell: `Panic selling detected ${count}x. Consider: set stop-losses at entry time, then do NOT touch them.`,
    no_stop_loss: `No stop-loss ${count}x. Rule: never enter a position without a defined exit price.`,
    overconcentration: `Overconcentration ${count}x. Rule: no single position > 10% of portfolio.`,
    timing: `Market timing attempts ${count}x. Consider: DCA instead of lump-sum entries.`,
    ignored_fundamentals: `Ignored fundamentals ${count}x. Rule: always check P/E, revenue trend, and debt before buying.`,
    emotional: `Emotional trading ${count}x. Consider: write down your thesis BEFORE trading. If you can't, don't trade.`,
  };

  return recommendations[category] ?? `Pattern "${category}" occurred ${count}x. Review and create a rule to prevent it.`;
}
