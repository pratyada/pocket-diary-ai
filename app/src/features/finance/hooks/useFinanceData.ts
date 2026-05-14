import { useState, useEffect, useCallback } from 'react';
import type {
  CategoryBreakdown,
  ReportSummary,
  Portfolio,
  DriftItem,
  AdvisorInsight,
  MistakeEntry,
  MarketIndex,
  Transaction,
} from '../types';

// Simulated data for development — will be replaced with actual
// finance domain calls via Tauri IPC or HTTP to the finance MCP server.

const MOCK_SPENDING: CategoryBreakdown[] = [
  { category: 'Housing', total: 1800, count: 1, currency: 'CAD', pct_of_total: 41.6 },
  { category: 'Groceries', total: 622, count: 4, currency: 'CAD', pct_of_total: 14.4 },
  { category: 'Shopping', total: 440, count: 2, currency: 'CAD', pct_of_total: 10.2 },
  { category: 'Transportation', total: 240, count: 4, currency: 'CAD', pct_of_total: 5.5 },
  { category: 'Insurance', total: 280, count: 2, currency: 'CAD', pct_of_total: 6.5 },
  { category: 'Dining', total: 87, count: 6, currency: 'CAD', pct_of_total: 2.0 },
  { category: 'Subscriptions', total: 122, count: 7, currency: 'CAD', pct_of_total: 2.8 },
  { category: 'Child', total: 150, count: 1, currency: 'CAD', pct_of_total: 3.5 },
  { category: 'Health', total: 87, count: 2, currency: 'CAD', pct_of_total: 2.0 },
  { category: 'Transfers', total: 500, count: 1, currency: 'CAD', pct_of_total: 11.6 },
];

const MOCK_SUMMARY: ReportSummary = {
  period: '2026-04',
  total_income: 7213,
  total_expenses: 4328,
  net_savings: 2885,
  savings_rate: 40.0,
  top_categories: MOCK_SPENDING.slice(0, 5).map((c) => ({
    category: c.category,
    amount: c.total,
    pct: c.pct_of_total,
  })),
  anomaly_count: 1,
  recurring_count: 7,
  currency: 'CAD',
};

const MOCK_PORTFOLIO: Portfolio = {
  account_id: 'invest:wealthsimple-tfsa',
  account_label: 'Wealthsimple TFSA',
  owner: 'prateek',
  type: 'tfsa',
  currency: 'CAD',
  holdings: [
    { id: 'h:1', account_id: 'invest:tfsa', ticker: 'VFV.TO', name: 'Vanguard S&P 500', shares: 150, avg_cost: 47.5, currency: 'CAD', asset_class: 'equity_us', current_price: 52.1, current_value: 7815, gain_loss: 690, gain_loss_pct: 9.7 },
    { id: 'h:2', account_id: 'invest:tfsa', ticker: 'XIC.TO', name: 'iShares S&P/TSX', shares: 200, avg_cost: 29.0, currency: 'CAD', asset_class: 'equity_ca', current_price: 31.5, current_value: 6300, gain_loss: 500, gain_loss_pct: 8.6 },
    { id: 'h:3', account_id: 'invest:tfsa', ticker: 'XEF.TO', name: 'iShares MSCI EAFE', shares: 100, avg_cost: 32.0, currency: 'CAD', asset_class: 'equity_intl', current_price: 34.2, current_value: 3420, gain_loss: 220, gain_loss_pct: 6.9 },
    { id: 'h:4', account_id: 'invest:tfsa', ticker: 'ZAG.TO', name: 'BMO Aggregate Bond', shares: 300, avg_cost: 14.5, currency: 'CAD', asset_class: 'fixed_income', current_price: 14.2, current_value: 4260, gain_loss: -90, gain_loss_pct: -2.1 },
    { id: 'h:5', account_id: 'invest:rrsp', ticker: 'VTI', name: 'Vanguard Total US', shares: 40, avg_cost: 220.0, currency: 'USD', asset_class: 'equity_us', current_price: 245.0, current_value: 9800, gain_loss: 1000, gain_loss_pct: 11.4 },
    { id: 'h:6', account_id: 'invest:demat', ticker: 'RELIANCE.NS', name: 'Reliance Industries', shares: 20, avg_cost: 2800, currency: 'INR', asset_class: 'equity_in', current_price: 3050, current_value: 61000, gain_loss: 5000, gain_loss_pct: 8.9 },
  ],
  total_value: { amount: 92595, currency: 'CAD' },
  total_gain_loss: { amount: 7320, currency: 'CAD' },
  total_gain_loss_pct: 8.6,
};

const MOCK_DRIFT: DriftItem[] = [
  { asset_class: 'equity_us', target_pct: 40, actual_pct: 47.2, drift_pct: 7.2, action: 'sell' },
  { asset_class: 'equity_ca', target_pct: 20, actual_pct: 16.8, drift_pct: -3.2, action: 'buy' },
  { asset_class: 'equity_intl', target_pct: 15, actual_pct: 9.1, drift_pct: -5.9, action: 'buy' },
  { asset_class: 'fixed_income', target_pct: 15, actual_pct: 11.4, drift_pct: -3.6, action: 'buy' },
  { asset_class: 'equity_in', target_pct: 10, actual_pct: 15.5, drift_pct: 5.5, action: 'sell' },
];

const MOCK_INSIGHTS: AdvisorInsight[] = [
  { priority: 'urgent', category: 'investments', title: 'RELIANCE.NS is 27% of India portfolio', detail: 'Single stock concentration risk. Value: INR 61,000', action: 'Consider trimming to <20% and diversifying into NIFTY 50 ETF' },
  { priority: 'important', category: 'spending', title: 'Subscriptions: $122/month across 7 services', detail: 'AWS $45, Anthropic $20, Netflix $16, Spotify $10, Google $18, Notion $10, GitHub $4', action: 'Review AWS usage — it is your biggest subscription.' },
  { priority: 'important', category: 'savings', title: 'Savings rate: 40% — excellent', detail: 'Income $7,213, Expenses $4,328, Saving $2,885/month', action: 'Deploy excess into TFSA (room: $7,000) before year-end.' },
  { priority: 'info', category: 'investments', title: 'RESP contribution reminder', detail: '2026 CESG match: contribute $2,500 for $500 free from government', action: 'Set up automatic monthly contribution of $208 to RESP.' },
  { priority: 'info', category: 'learning', title: 'No mistakes logged this month', detail: 'Last mistake: TSLA panic sell (June 2025)', action: 'Keep journaling — the pattern analysis improves with more data.' },
];

const MOCK_MISTAKES: MistakeEntry[] = [
  { id: 'm:1', date: '2025-01-15', ticker: 'GME', action: 'Bought during meme rally without checking fundamentals', lesson: 'Never buy based on Reddit hype alone', category: 'fomo', would_do_differently: 'Always check P/E and revenue trend', tags: ['meme-stock'], loss_realized: { amount: 500, currency: 'CAD' } },
  { id: 'm:2', date: '2025-06-20', ticker: 'TSLA', action: 'Panic sold during 15% dip', lesson: 'Quality stocks recover, panic selling locks in losses', category: 'panic_sell', would_do_differently: 'Set stop-loss at entry, then hands off', tags: ['tesla'], loss_realized: { amount: 1200, currency: 'USD' } },
];

const MOCK_INDICES: MarketIndex[] = [
  { symbol: '^GSPC', name: 'S&P 500', value: 5892.34, change: 23.45, change_pct: 0.40 },
  { symbol: '^IXIC', name: 'NASDAQ', value: 19234.12, change: -45.67, change_pct: -0.24 },
  { symbol: '^GSPTSE', name: 'S&P/TSX', value: 25123.89, change: 112.34, change_pct: 0.45 },
  { symbol: '^NSEI', name: 'NIFTY 50', value: 24567.00, change: 189.50, change_pct: 0.78 },
];

export function useSpending() {
  const [data, setData] = useState<CategoryBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Replace with actual finance domain call
    setTimeout(() => {
      setData(MOCK_SPENDING);
      setLoading(false);
    }, 300);
  }, []);

  return { spending: data, loading };
}

export function useSummary() {
  const [data, setData] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setData(MOCK_SUMMARY);
      setLoading(false);
    }, 200);
  }, []);

  return { summary: data, loading };
}

export function usePortfolio() {
  const [data, setData] = useState<Portfolio | null>(null);
  const [drift, setDrift] = useState<DriftItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setData(MOCK_PORTFOLIO);
      setDrift(MOCK_DRIFT);
      setLoading(false);
    }, 400);
  }, []);

  return { portfolio: data, drift, loading };
}

export function useAdvisor() {
  const [insights, setInsights] = useState<AdvisorInsight[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      setInsights(MOCK_INSIGHTS);
      setLoading(false);
    }, 500);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { insights, loading, refresh };
}

export function useMistakes() {
  const [data, setData] = useState<MistakeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setData(MOCK_MISTAKES);
      setLoading(false);
    }, 200);
  }, []);

  return { mistakes: data, loading };
}

export function useMarketIndices() {
  const [data, setData] = useState<MarketIndex[]>([]);

  useEffect(() => {
    setTimeout(() => setData(MOCK_INDICES), 100);
  }, []);

  return { indices: data };
}
