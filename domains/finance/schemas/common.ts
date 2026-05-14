import { z } from "zod";

export const Currency = z.enum(["CAD", "USD", "INR"]);
export type Currency = z.infer<typeof Currency>;

export const Region = z.enum(["CA", "IN", "US"]);
export type Region = z.infer<typeof Region>;

export const Money = z.object({
  amount: z.number(),
  currency: Currency,
});
export type Money = z.infer<typeof Money>;

export const Owner = z.enum(["prateek", "partner", "joint", "ved"]);
export type Owner = z.infer<typeof Owner>;

export const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const Period = z.enum(["month", "quarter", "ytd", "custom"]);
export type Period = z.infer<typeof Period>;

export const Severity = z.enum(["low", "medium", "high"]);
export type Severity = z.infer<typeof Severity>;

export const ImportStats = z.object({
  total_rows: z.number(),
  imported: z.number(),
  skipped: z.number(),
  errors: z.number(),
  duration_ms: z.number(),
});
export type ImportStats = z.infer<typeof ImportStats>;
