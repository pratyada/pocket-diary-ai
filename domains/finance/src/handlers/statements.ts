import type Database from "better-sqlite3";
import { v4 as uuid } from "uuid";
import type { Transaction, Statement } from "../../schemas/transaction.js";
import type { ImportStats } from "../../schemas/common.js";
import { parseCSV, detectCSVFormat } from "../parsers/csv.js";
import { extractTextFromPDF, parsePDFText } from "../parsers/pdf.js";
import { categorizeWithLLM } from "../categorizer.js";

export async function importStatement(
  db: Database.Database,
  params: {
    path: string;
    account_id: string;
    currency?: "CAD" | "USD" | "INR";
    format?: "pdf" | "csv" | "auto";
  }
): Promise<{ transactions: Transaction[]; stats: ImportStats; statement: Statement }> {
  const start = Date.now();
  const ext = params.path.split(".").pop()?.toLowerCase();
  const format = params.format === "auto" || !params.format
    ? ext === "csv" ? "csv" : "pdf"
    : params.format;

  const currency = params.currency ?? "CAD";
  let transactions: Transaction[] = [];
  let bankDetected: string | null = null;

  if (format === "csv") {
    const detected = detectCSVFormat(params.path);
    bankDetected = detected?.bank ?? null;
    transactions = parseCSV(
      params.path,
      params.account_id,
      currency,
      detected?.mapping
    );
  } else {
    const text = await extractTextFromPDF(params.path);
    const result = parsePDFText(text, params.account_id, currency);
    bankDetected = result.bank;
    transactions = result.transactions;
  }

  // Second pass: LLM categorization for unknowns
  for (const txn of transactions) {
    if (txn.confidence === 0) {
      const llmResult = await categorizeWithLLM(txn.merchant_raw);
      txn.category = llmResult.category;
      txn.subcategory = llmResult.subcategory;
      txn.merchant_normalized = llmResult.merchant_normalized;
      txn.confidence = llmResult.confidence;
    }
  }

  // Detect recurring patterns
  detectRecurring(transactions);

  // Determine period
  const dates = transactions.map((t) => t.date).sort();
  const periodStart = dates[0] ?? new Date().toISOString().split("T")[0]!;
  const periodEnd = dates[dates.length - 1] ?? periodStart;

  // Create statement record
  const statement: Statement = {
    id: `stmt:${uuid()}`,
    account_id: params.account_id,
    file_path: params.path,
    file_format: format,
    bank_detected: bankDetected ?? undefined,
    period_start: periodStart,
    period_end: periodEnd,
    transaction_count: transactions.length,
    imported_at: new Date().toISOString(),
  };

  // Persist
  const insertStmt = db.prepare(
    `INSERT OR IGNORE INTO fin_statements (id, account_id, file_path, file_format, bank_detected, period_start, period_end, transaction_count, imported_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertStmt.run(
    statement.id,
    statement.account_id,
    statement.file_path,
    statement.file_format,
    statement.bank_detected,
    statement.period_start,
    statement.period_end,
    statement.transaction_count,
    statement.imported_at
  );

  const insertTxn = db.prepare(
    `INSERT OR IGNORE INTO fin_transactions
     (id, account_id, date, amount, currency, type, merchant_raw, merchant_normalized, category, subcategory, confidence, is_recurring, source_statement_id, notes, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let imported = 0;
  let skipped = 0;

  const insertMany = db.transaction((txns: Transaction[]) => {
    for (const txn of txns) {
      const result = insertTxn.run(
        txn.id, txn.account_id, txn.date, txn.amount, txn.currency,
        txn.type, txn.merchant_raw, txn.merchant_normalized,
        txn.category, txn.subcategory, txn.confidence,
        txn.is_recurring ? 1 : 0, statement.id,
        txn.notes, JSON.stringify(txn.tags)
      );
      if (result.changes > 0) imported++;
      else skipped++;
    }
  });

  insertMany(transactions);

  const stats: ImportStats = {
    total_rows: transactions.length,
    imported,
    skipped,
    errors: 0,
    duration_ms: Date.now() - start,
  };

  return { transactions, stats, statement };
}

function detectRecurring(transactions: Transaction[]): void {
  // Group by normalized merchant
  const byMerchant = new Map<string, Transaction[]>();
  for (const txn of transactions) {
    if (!txn.merchant_normalized) continue;
    const key = txn.merchant_normalized;
    const group = byMerchant.get(key) ?? [];
    group.push(txn);
    byMerchant.set(key, group);
  }

  for (const [_, txns] of byMerchant) {
    if (txns.length < 2) continue;

    // Check if amounts are similar (within 10%)
    const amounts = txns.map((t) => Math.abs(t.amount));
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const allSimilar = amounts.every(
      (a) => Math.abs(a - avg) / avg < 0.1
    );

    if (allSimilar) {
      for (const txn of txns) {
        txn.is_recurring = true;
      }
    }
  }
}
