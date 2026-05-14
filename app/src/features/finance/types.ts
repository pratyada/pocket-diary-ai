export interface Money {
  amount: number;
  currency: 'CAD' | 'USD' | 'INR';
}

export interface CategoryBreakdown {
  category: string;
  subcategory?: string;
  total: number;
  count: number;
  currency: string;
  pct_of_total: number;
}

export interface Transaction {
  id: string;
  account_id: string;
  date: string;
  amount: number;
  currency: string;
  type: string;
  merchant_raw: string;
  merchant_normalized?: string;
  category?: string;
  subcategory?: string;
  confidence: number;
  is_recurring: boolean;
}

export interface Holding {
  id: string;
  account_id: string;
  ticker: string;
  name: string;
  shares: number;
  avg_cost: number;
  currency: string;
  asset_class: string;
  current_price?: number;
  current_value?: number;
  gain_loss?: number;
  gain_loss_pct?: number;
}

export interface Portfolio {
  account_id: string;
  account_label: string;
  owner: string;
  type: string;
  currency: string;
  holdings: Holding[];
  total_value: Money;
  total_gain_loss: Money;
  total_gain_loss_pct: number;
}

export interface DriftItem {
  asset_class: string;
  target_pct: number;
  actual_pct: number;
  drift_pct: number;
  action: 'buy' | 'sell' | 'hold';
  amount_to_rebalance?: Money;
}

export interface AdvisorInsight {
  priority: 'urgent' | 'important' | 'info';
  category: string;
  title: string;
  detail: string;
  action: string;
}

export interface MistakeEntry {
  id: string;
  date: string;
  ticker?: string;
  action: string;
  amount?: Money;
  loss_realized?: Money;
  lesson: string;
  category: string;
  would_do_differently: string;
  tags: string[];
}

export interface ReportSummary {
  period: string;
  total_income: number;
  total_expenses: number;
  net_savings: number;
  savings_rate: number;
  top_categories: { category: string; amount: number; pct: number }[];
  anomaly_count: number;
  recurring_count: number;
  currency: string;
}

export interface MarketIndex {
  symbol: string;
  name: string;
  value: number;
  change: number;
  change_pct: number;
}
