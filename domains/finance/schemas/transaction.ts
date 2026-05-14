import { z } from "zod";
import { Currency, DateStr, Severity } from "./common.js";

export const TransactionType = z.enum([
  "debit",
  "credit",
  "transfer",
  "fee",
  "interest",
  "dividend",
  "refund",
]);
export type TransactionType = z.infer<typeof TransactionType>;

export const Transaction = z.object({
  id: z.string(), // "txn:<uuid>"
  account_id: z.string(), // "account:rbc-chequing"
  date: DateStr,
  amount: z.number(), // positive = inflow, negative = outflow
  currency: Currency,
  type: TransactionType,
  merchant_raw: z.string(),
  merchant_normalized: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  confidence: z.number().min(0).max(1).default(1.0),
  is_recurring: z.boolean().default(false),
  source_statement_id: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
});
export type Transaction = z.infer<typeof Transaction>;

export const Statement = z.object({
  id: z.string(), // "stmt:<uuid>"
  account_id: z.string(),
  file_path: z.string(),
  file_format: z.enum(["pdf", "csv"]),
  bank_detected: z.string().optional(),
  period_start: DateStr,
  period_end: DateStr,
  transaction_count: z.number(),
  imported_at: z.string(),
});
export type Statement = z.infer<typeof Statement>;

export const Anomaly = z.object({
  id: z.string(),
  transaction_id: z.string(),
  category: z.string(),
  merchant: z.string(),
  amount: z.number(),
  currency: Currency,
  expected_mean: z.number(),
  expected_stddev: z.number(),
  sigma_deviation: z.number(),
  severity: Severity,
  detected_at: z.string(),
});
export type Anomaly = z.infer<typeof Anomaly>;

export const CategoryBreakdown = z.object({
  category: z.string(),
  subcategory: z.string().optional(),
  total: z.number(),
  count: z.number(),
  currency: Currency,
  pct_of_total: z.number(),
});
export type CategoryBreakdown = z.infer<typeof CategoryBreakdown>;

export const ColumnMapping = z.object({
  date: z.string().default("Date"),
  amount: z.string().default("Amount"),
  description: z.string().default("Description"),
  type: z.string().optional(),
  category: z.string().optional(),
  currency: z.string().optional(),
});
export type ColumnMapping = z.infer<typeof ColumnMapping>;
