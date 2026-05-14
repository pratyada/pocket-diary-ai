import { z } from "zod";
import { Currency, DateStr, Money, Owner } from "./common.js";

export const AssetClass = z.enum([
  "equity_us",
  "equity_ca",
  "equity_in",
  "equity_intl",
  "fixed_income",
  "real_estate",
  "gold",
  "crypto",
  "cash",
  "other",
]);
export type AssetClass = z.infer<typeof AssetClass>;

export const Holding = z.object({
  id: z.string(), // "holding:tfsa-wealthsimple:VTI"
  account_id: z.string(), // "invest:wealthsimple-tfsa"
  ticker: z.string(),
  name: z.string(),
  shares: z.number(),
  avg_cost: z.number(),
  currency: Currency,
  asset_class: AssetClass,
  current_price: z.number().optional(),
  current_value: z.number().optional(),
  gain_loss: z.number().optional(),
  gain_loss_pct: z.number().optional(),
  last_updated: z.string().optional(),
});
export type Holding = z.infer<typeof Holding>;

export const Portfolio = z.object({
  account_id: z.string(),
  account_label: z.string(),
  owner: Owner,
  type: z.string(), // "tfsa", "rrsp", etc.
  region: z.string(),
  currency: Currency,
  holdings: z.array(Holding),
  total_value: Money,
  total_cost: Money,
  total_gain_loss: Money,
  total_gain_loss_pct: z.number(),
  contribution_room: z.number().optional(),
});
export type Portfolio = z.infer<typeof Portfolio>;

export const AllocationTarget = z.object({
  asset_class: AssetClass,
  target_pct: z.number().min(0).max(100),
});
export type AllocationTarget = z.infer<typeof AllocationTarget>;

export const DriftItem = z.object({
  asset_class: AssetClass,
  target_pct: z.number(),
  actual_pct: z.number(),
  drift_pct: z.number(), // actual - target
  current_value: Money,
  action: z.enum(["buy", "sell", "hold"]),
  amount_to_rebalance: Money.optional(),
});
export type DriftItem = z.infer<typeof DriftItem>;

export const InvestSuggestion = z.object({
  account_id: z.string(),
  account_type: z.string(),
  reason: z.string(), // "TFSA has $6500 room", "RRSP reduces tax bracket"
  suggested_amount: Money,
  suggested_assets: z.array(
    z.object({
      ticker: z.string(),
      asset_class: AssetClass,
      allocation_pct: z.number(),
      rationale: z.string(),
    })
  ),
  tax_benefit: z.string().optional(),
});
export type InvestSuggestion = z.infer<typeof InvestSuggestion>;

export const MistakeEntry = z.object({
  id: z.string(),
  date: DateStr,
  ticker: z.string().optional(),
  action: z.string(), // "bought at peak", "sold too early", "FOMO buy"
  amount: Money.optional(),
  loss_realized: Money.optional(),
  lesson: z.string(),
  category: z
    .enum([
      "fomo",
      "panic_sell",
      "no_stop_loss",
      "overconcentration",
      "timing",
      "ignored_fundamentals",
      "emotional",
      "other",
    ])
    .default("other"),
  would_do_differently: z.string(),
  tags: z.array(z.string()).default([]),
});
export type MistakeEntry = z.infer<typeof MistakeEntry>;

export const WatchlistItem = z.object({
  ticker: z.string(),
  name: z.string(),
  exchange: z.string(),
  current_price: z.number().optional(),
  alert_rules: z.array(
    z.object({
      type: z.enum(["price_above", "price_below", "pe_above", "pe_below", "volume_spike"]),
      threshold: z.number(),
      triggered: z.boolean().default(false),
    })
  ),
  added_at: z.string(),
  notes: z.string().optional(),
});
export type WatchlistItem = z.infer<typeof WatchlistItem>;
