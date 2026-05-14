import fs from "fs";
import { parse } from "csv-parse/sync";
import { v4 as uuid } from "uuid";
import type { Transaction, ColumnMapping } from "../../schemas/transaction.js";
import { categorize } from "../categorizer.js";

const DEFAULT_MAPPING: ColumnMapping = {
  date: "Date",
  amount: "Amount",
  description: "Description",
};

export function parseCSV(
  filePath: string,
  accountId: string,
  currency: "CAD" | "USD" | "INR",
  mapping?: Partial<ColumnMapping>
): Transaction[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const m = { ...DEFAULT_MAPPING, ...mapping };

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const transactions: Transaction[] = [];

  for (const row of records) {
    const dateRaw = row[m.date];
    const amountRaw = row[m.amount];
    const descRaw = row[m.description];

    if (!dateRaw || !amountRaw || !descRaw) continue;

    const amount = parseFloat(amountRaw.replace(/[$,]/g, ""));
    if (isNaN(amount)) continue;

    const date = normalizeDate(dateRaw);
    if (!date) continue;

    const cat = categorize(descRaw);

    // Detect type from amount and optional type column
    const typeRaw = m.type ? row[m.type] : undefined;
    const type = inferType(amount, typeRaw);

    transactions.push({
      id: `txn:${uuid()}`,
      account_id: accountId,
      date,
      amount,
      currency,
      type,
      merchant_raw: descRaw,
      merchant_normalized: cat.merchant_normalized,
      category: cat.category,
      subcategory: cat.subcategory,
      confidence: cat.confidence,
      is_recurring: false,
      notes: undefined,
      tags: [],
    });
  }

  return transactions;
}

function normalizeDate(raw: string): string | null {
  // Try common formats: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, DD-Mon-YYYY
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return raw;

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, m, d, y] = slashMatch;
    return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }

  const dashMonMatch = raw.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (dashMonMatch) {
    const [, d, mon, y] = dashMonMatch;
    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04",
      may: "05", jun: "06", jul: "07", aug: "08",
      sep: "09", oct: "10", nov: "11", dec: "12",
    };
    const monthNum = months[mon!.toLowerCase()];
    if (monthNum) return `${y}-${monthNum}-${d!.padStart(2, "0")}`;
  }

  // Try JS Date as last resort
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0]!;
  }

  return null;
}

function inferType(
  amount: number,
  typeRaw?: string
): Transaction["type"] {
  if (typeRaw) {
    const t = typeRaw.toLowerCase();
    if (t.includes("credit") || t.includes("deposit")) return "credit";
    if (t.includes("debit") || t.includes("withdrawal")) return "debit";
    if (t.includes("transfer")) return "transfer";
    if (t.includes("fee")) return "fee";
    if (t.includes("interest")) return "interest";
    if (t.includes("dividend")) return "dividend";
    if (t.includes("refund")) return "refund";
  }
  return amount >= 0 ? "credit" : "debit";
}

/** Detect CSV format from headers and auto-map columns. */
export function detectCSVFormat(
  filePath: string
): { bank: string; mapping: ColumnMapping } | null {
  const content = fs.readFileSync(filePath, "utf-8");
  const firstLine = content.split("\n")[0]?.toLowerCase() ?? "";

  // Wealthsimple
  if (firstLine.includes("transaction date") && firstLine.includes("market value")) {
    return {
      bank: "Wealthsimple",
      mapping: { date: "Transaction Date", amount: "Market Value", description: "Description" },
    };
  }

  // RBC CSV export
  if (firstLine.includes("account type") && firstLine.includes("cad$")) {
    return {
      bank: "RBC",
      mapping: { date: "Transaction Date", amount: "CAD$", description: "Description 1" },
    };
  }

  // BMO CSV
  if (firstLine.includes("transaction date") && firstLine.includes("transaction amount")) {
    return {
      bank: "BMO",
      mapping: { date: "Transaction Date", amount: "Transaction Amount", description: "Description" },
    };
  }

  // HDFC
  if (firstLine.includes("value dat") && firstLine.includes("withdrawal")) {
    return {
      bank: "HDFC",
      mapping: { date: "Value Dat", amount: "Withdrawal Amt.", description: "Narration" },
    };
  }

  // Generic fallback
  if (firstLine.includes("date") && firstLine.includes("amount")) {
    return {
      bank: "Generic",
      mapping: DEFAULT_MAPPING,
    };
  }

  return null;
}
