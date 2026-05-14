import { z } from "zod";

export const MarketQuote = z.object({
  ticker: z.string(),
  name: z.string(),
  exchange: z.string(), // "NASDAQ", "TSX", "NSE", "BSE"
  price: z.number(),
  change: z.number(),
  change_pct: z.number(),
  volume: z.number(),
  market_cap: z.number().optional(),
  pe_ratio: z.number().optional(),
  dividend_yield: z.number().optional(),
  high_52w: z.number().optional(),
  low_52w: z.number().optional(),
  currency: z.string(),
  timestamp: z.string(),
});
export type MarketQuote = z.infer<typeof MarketQuote>;

export const IndexQuote = z.object({
  symbol: z.string(), // "^GSPC", "^IXIC", "^GSPTSE", "^NSEI"
  name: z.string(), // "S&P 500", "NASDAQ", "S&P/TSX", "NIFTY 50"
  value: z.number(),
  change: z.number(),
  change_pct: z.number(),
  timestamp: z.string(),
});
export type IndexQuote = z.infer<typeof IndexQuote>;

export const MonthForecast = z.object({
  month: z.string(), // "2026-06"
  projected_income: z.number(),
  projected_expenses: z.number(),
  projected_savings: z.number(),
  confidence: z.number(),
  top_categories: z.array(
    z.object({
      category: z.string(),
      projected: z.number(),
      trend: z.enum(["rising", "stable", "falling"]),
    })
  ),
});
export type MonthForecast = z.infer<typeof MonthForecast>;

export const ReportSummary = z.object({
  period: z.string(),
  total_income: z.number(),
  total_expenses: z.number(),
  net_savings: z.number(),
  savings_rate: z.number(),
  top_categories: z.array(
    z.object({ category: z.string(), amount: z.number(), pct: z.number() })
  ),
  anomaly_count: z.number(),
  recurring_count: z.number(),
  currency: z.string(),
});
export type ReportSummary = z.infer<typeof ReportSummary>;
