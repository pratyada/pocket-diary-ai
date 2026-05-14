import fs from "fs";
import { v4 as uuid } from "uuid";
import type { Transaction } from "../../schemas/transaction.js";
import { categorize } from "../categorizer.js";

interface BankTemplate {
  name: string;
  detect: (text: string) => boolean;
  parseTransactions: (text: string, accountId: string, currency: "CAD" | "USD" | "INR") => Transaction[];
}

// Common transaction line pattern: date, description, amount
const TXN_LINE =
  /(\d{1,2}[\s/-][A-Za-z]{3}[\s/-]?\d{0,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+?)\s+([-]?\$?[\d,]+\.\d{2})\s*$/;

const templates: BankTemplate[] = [
  {
    name: "RBC",
    detect: (text) =>
      text.includes("Royal Bank") || text.includes("RBC Royal Bank"),
    parseTransactions: (text, accountId, currency) =>
      parseGenericLines(text, accountId, currency),
  },
  {
    name: "TD",
    detect: (text) =>
      text.includes("TD Canada Trust") || text.includes("TD Bank"),
    parseTransactions: (text, accountId, currency) =>
      parseGenericLines(text, accountId, currency),
  },
  {
    name: "BMO",
    detect: (text) =>
      text.includes("Bank of Montreal") || text.includes("BMO"),
    parseTransactions: (text, accountId, currency) =>
      parseGenericLines(text, accountId, currency),
  },
  {
    name: "HDFC",
    detect: (text) => text.includes("HDFC Bank"),
    parseTransactions: (text, accountId, currency) =>
      parseGenericLines(text, accountId, currency),
  },
  {
    name: "SBI",
    detect: (text) => text.includes("State Bank of India"),
    parseTransactions: (text, accountId, currency) =>
      parseGenericLines(text, accountId, currency),
  },
  {
    name: "Chase",
    detect: (text) =>
      text.includes("JPMorgan Chase") || text.includes("Chase Bank"),
    parseTransactions: (text, accountId, currency) =>
      parseGenericLines(text, accountId, currency),
  },
];

function parseGenericLines(
  text: string,
  accountId: string,
  currency: "CAD" | "USD" | "INR"
): Transaction[] {
  const lines = text.split("\n");
  const transactions: Transaction[] = [];

  for (const line of lines) {
    const match = line.match(TXN_LINE);
    if (!match) continue;

    const [, dateRaw, descRaw, amountRaw] = match;
    if (!dateRaw || !descRaw || !amountRaw) continue;

    const amount = parseFloat(amountRaw.replace(/[$,]/g, ""));
    if (isNaN(amount)) continue;

    const date = normalizePdfDate(dateRaw);
    if (!date) continue;

    const cat = categorize(descRaw);

    transactions.push({
      id: `txn:${uuid()}`,
      account_id: accountId,
      date,
      amount: amount > 0 ? -amount : amount, // statements usually show debits as positive
      currency,
      type: amount > 0 ? "debit" : "credit",
      merchant_raw: descRaw.trim(),
      merchant_normalized: cat.merchant_normalized,
      category: cat.category,
      subcategory: cat.subcategory,
      confidence: cat.confidence,
      is_recurring: false,
      tags: [],
    });
  }

  return transactions;
}

function normalizePdfDate(raw: string): string | null {
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04",
    may: "05", jun: "06", jul: "07", aug: "08",
    sep: "09", oct: "10", nov: "11", dec: "12",
  };

  // "15 Jan 2026" or "15-Jan-2026" or "15 Jan"
  const match = raw.match(/(\d{1,2})[\s/-]([A-Za-z]{3})[\s/-]?(\d{4})?/);
  if (match) {
    const [, d, mon, y] = match;
    const monthNum = months[mon!.toLowerCase()];
    const year = y ?? new Date().getFullYear().toString();
    if (monthNum) return `${year}-${monthNum}-${d!.padStart(2, "0")}`;
  }

  // ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // MM/DD/YYYY
  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slashMatch) {
    const [, m, d, y] = slashMatch;
    const year = y
      ? y.length === 2 ? `20${y}` : y
      : new Date().getFullYear().toString();
    return `${year}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }

  return null;
}

export function detectBank(text: string): string | null {
  for (const tpl of templates) {
    if (tpl.detect(text)) return tpl.name;
  }
  return null;
}

export async function extractTextFromPDF(filePath: string): Promise<string> {
  // Dynamic import to handle ESM/CJS issues with pdfjs-dist
  const pdfjsLib = await import("pdfjs-dist");

  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjsLib.getDocument({ data }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(text);
  }

  return pages.join("\n");
}

export function parsePDFText(
  text: string,
  accountId: string,
  currency: "CAD" | "USD" | "INR"
): { bank: string | null; transactions: Transaction[] } {
  const bank = detectBank(text);

  if (bank) {
    const template = templates.find((t) => t.name === bank);
    if (template) {
      return {
        bank,
        transactions: template.parseTransactions(text, accountId, currency),
      };
    }
  }

  // Fallback: generic line parsing
  return {
    bank,
    transactions: parseGenericLines(text, accountId, currency),
  };
}
