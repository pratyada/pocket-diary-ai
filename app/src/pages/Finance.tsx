import { useState } from 'react';
import PillTabBar from '../components/PillTabBar';
import {
  useSpending,
  useSummary,
  usePortfolio,
  useAdvisor,
  useMistakes,
  useMarketIndices,
} from '../features/finance';
import type {
  CategoryBreakdown,
  Holding,
  DriftItem,
  AdvisorInsight,
  MistakeEntry,
  MarketIndex,
} from '../features/finance';

type FinanceTab = 'overview' | 'spending' | 'portfolio' | 'advisor' | 'mistakes';

const Finance = () => {
  const [selectedTab, setSelectedTab] = useState<FinanceTab>('overview');

  return (
    <div className="min-h-full px-4 pt-6 pb-10">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-display font-bold text-stone-900">Finance</h1>
          <span className="text-xs font-mono text-stone-400">Pocket Diary AI</span>
        </div>

        <PillTabBar
          items={[
            { label: 'Overview', value: 'overview' as FinanceTab },
            { label: 'Spending', value: 'spending' as FinanceTab },
            { label: 'Portfolio', value: 'portfolio' as FinanceTab },
            { label: 'Advisor', value: 'advisor' as FinanceTab },
            { label: 'Mistakes', value: 'mistakes' as FinanceTab },
          ]}
          selected={selectedTab}
          onChange={(tab) => setSelectedTab(tab)}
          activeClassName="border-primary-600 bg-primary-600 text-white"
        />

        <div className="animate-fade-up">
          {selectedTab === 'overview' && <OverviewTab />}
          {selectedTab === 'spending' && <SpendingTab />}
          {selectedTab === 'portfolio' && <PortfolioTab />}
          {selectedTab === 'advisor' && <AdvisorTab />}
          {selectedTab === 'mistakes' && <MistakesTab />}
        </div>
      </div>
    </div>
  );
};

// ─── Overview Tab ─────────────────────────────────────────────

function OverviewTab() {
  const { summary, loading: summaryLoading } = useSummary();
  const { indices } = useMarketIndices();
  const { insights } = useAdvisor();

  if (summaryLoading) return <LoadingCard />;
  if (!summary) return null;

  const urgentCount = insights.filter((i) => i.priority === 'urgent').length;

  return (
    <div className="space-y-4">
      {/* Cash Flow Summary */}
      <Card>
        <CardTitle>Monthly Cash Flow</CardTitle>
        <p className="text-xs text-stone-400 mb-3">{summary.period}</p>
        <div className="grid grid-cols-2 gap-3">
          <MetricBox label="Income" value={`$${summary.total_income.toLocaleString()}`} color="text-sage-600" />
          <MetricBox label="Expenses" value={`$${summary.total_expenses.toLocaleString()}`} color="text-coral-600" />
          <MetricBox label="Net Savings" value={`$${summary.net_savings.toLocaleString()}`} color="text-primary-600" />
          <MetricBox
            label="Savings Rate"
            value={`${summary.savings_rate}%`}
            color={summary.savings_rate >= 30 ? 'text-sage-600' : summary.savings_rate >= 20 ? 'text-amber-600' : 'text-coral-600'}
          />
        </div>
      </Card>

      {/* Market Indices */}
      <Card>
        <CardTitle>Markets</CardTitle>
        <div className="space-y-2">
          {indices.map((idx) => (
            <MarketIndexRow key={idx.symbol} index={idx} />
          ))}
        </div>
      </Card>

      {/* Advisor Alert */}
      {urgentCount > 0 && (
        <div className="bg-coral-50 border border-coral-200 rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <span className="text-coral-600 font-semibold text-sm">
              {urgentCount} urgent insight{urgentCount > 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-xs text-coral-700 mt-1">
            {insights.find((i) => i.priority === 'urgent')?.title}
          </p>
        </div>
      )}

      {/* Quick Stats */}
      <Card>
        <CardTitle>This Month</CardTitle>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-display font-bold text-stone-900">{summary.recurring_count}</p>
            <p className="text-xs text-stone-500">Recurring</p>
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-stone-900">{summary.anomaly_count}</p>
            <p className="text-xs text-stone-500">Anomalies</p>
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-stone-900">{summary.top_categories.length}</p>
            <p className="text-xs text-stone-500">Categories</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Spending Tab ─────────────────────────────────────────────

function SpendingTab() {
  const { spending, loading } = useSpending();

  if (loading) return <LoadingCard />;

  const total = spending.reduce((s, c) => s + c.total, 0);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Spending by Category</CardTitle>
          <span className="text-lg font-display font-bold text-stone-900">
            ${total.toLocaleString()}
          </span>
        </div>

        {/* Bar chart */}
        <div className="space-y-3">
          {spending.map((cat) => (
            <SpendingBar key={cat.category + cat.subcategory} item={cat} maxAmount={spending[0]?.total ?? 1} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function SpendingBar({ item, maxAmount }: { item: CategoryBreakdown; maxAmount: number }) {
  const pct = (item.total / maxAmount) * 100;

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-stone-700 font-medium">{item.category}</span>
        <span className="text-stone-900 font-mono">${item.total.toLocaleString()}</span>
      </div>
      <div className="mt-1 h-2 bg-stone-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-stone-400 mt-0.5">
        <span>{item.count} txns</span>
        <span>{item.pct_of_total}%</span>
      </div>
    </div>
  );
}

// ─── Portfolio Tab ────────────────────────────────────────────

function PortfolioTab() {
  const { portfolio, drift, loading } = usePortfolio();
  const [showDrift, setShowDrift] = useState(false);

  if (loading) return <LoadingCard />;
  if (!portfolio) return null;

  return (
    <div className="space-y-4">
      {/* Total Value */}
      <Card>
        <CardTitle>Portfolio Value</CardTitle>
        <p className="text-3xl font-display font-bold text-stone-900 mt-1">
          ${portfolio.total_value.amount.toLocaleString()}
          <span className="text-sm font-normal text-stone-400 ml-1">{portfolio.total_value.currency}</span>
        </p>
        <p className={`text-sm mt-1 ${portfolio.total_gain_loss_pct >= 0 ? 'text-sage-600' : 'text-coral-600'}`}>
          {portfolio.total_gain_loss_pct >= 0 ? '+' : ''}{portfolio.total_gain_loss_pct}%
          {' '}(${portfolio.total_gain_loss.amount.toLocaleString()})
        </p>
      </Card>

      {/* Holdings */}
      <Card>
        <CardTitle>Holdings</CardTitle>
        <div className="space-y-3 mt-3">
          {portfolio.holdings.map((h) => (
            <HoldingRow key={h.id} holding={h} />
          ))}
        </div>
      </Card>

      {/* Allocation Drift */}
      <Card>
        <button
          onClick={() => setShowDrift(!showDrift)}
          className="w-full flex items-center justify-between"
        >
          <CardTitle>Allocation Drift</CardTitle>
          <span className="text-xs text-primary-600">{showDrift ? 'Hide' : 'Show'}</span>
        </button>

        {showDrift && (
          <div className="mt-3 space-y-3">
            {drift.map((d) => (
              <DriftRow key={d.asset_class} item={d} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function HoldingRow({ holding }: { holding: Holding }) {
  const isPositive = (holding.gain_loss_pct ?? 0) >= 0;

  return (
    <div className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0">
      <div>
        <p className="text-sm font-semibold text-stone-900">{holding.ticker}</p>
        <p className="text-xs text-stone-500">{holding.name}</p>
        <p className="text-xs text-stone-400">{holding.shares} shares @ ${holding.avg_cost}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-mono text-stone-900">${holding.current_value?.toLocaleString()}</p>
        <p className={`text-xs font-mono ${isPositive ? 'text-sage-600' : 'text-coral-600'}`}>
          {isPositive ? '+' : ''}{holding.gain_loss_pct}%
        </p>
      </div>
    </div>
  );
}

function DriftRow({ item }: { item: DriftItem }) {
  const actionColor = item.action === 'buy' ? 'text-sage-600 bg-sage-50' : item.action === 'sell' ? 'text-coral-600 bg-coral-50' : 'text-stone-500 bg-stone-50';

  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm text-stone-700">{item.asset_class.replace(/_/g, ' ')}</p>
        <p className="text-xs text-stone-400">Target: {item.target_pct}% | Actual: {item.actual_pct}%</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-stone-600">
          {item.drift_pct > 0 ? '+' : ''}{item.drift_pct}%
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionColor}`}>
          {item.action}
        </span>
      </div>
    </div>
  );
}

// ─── Advisor Tab ──────────────────────────────────────────────

function AdvisorTab() {
  const { insights, loading, refresh } = useAdvisor();

  if (loading) return <LoadingCard />;

  const urgent = insights.filter((i) => i.priority === 'urgent');
  const important = insights.filter((i) => i.priority === 'important');
  const info = insights.filter((i) => i.priority === 'info');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">{insights.length} insights</p>
        <button onClick={refresh} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
          Refresh
        </button>
      </div>

      {urgent.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-coral-600 uppercase tracking-wide">Action Required</p>
          {urgent.map((i, idx) => (
            <InsightCard key={idx} insight={i} />
          ))}
        </div>
      )}

      {important.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Worth Your Attention</p>
          {important.map((i, idx) => (
            <InsightCard key={idx} insight={i} />
          ))}
        </div>
      )}

      {info.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">FYI</p>
          {info.map((i, idx) => (
            <InsightCard key={idx} insight={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function InsightCard({ insight }: { insight: AdvisorInsight }) {
  const borderColor =
    insight.priority === 'urgent' ? 'border-l-coral-500' :
    insight.priority === 'important' ? 'border-l-amber-500' : 'border-l-stone-300';

  return (
    <div className={`bg-white rounded-xl shadow-soft border border-stone-200 border-l-4 ${borderColor} p-4`}>
      <div className="flex items-start justify-between">
        <p className="text-sm font-semibold text-stone-900">{insight.title}</p>
        <span className="text-xs text-stone-400 ml-2 shrink-0">{insight.category}</span>
      </div>
      <p className="text-xs text-stone-500 mt-1 whitespace-pre-line">{insight.detail}</p>
      <p className="text-xs text-primary-600 mt-2 font-medium">{insight.action}</p>
    </div>
  );
}

// ─── Mistakes Tab ─────────────────────────────────────────────

function MistakesTab() {
  const { mistakes, loading } = useMistakes();

  if (loading) return <LoadingCard />;

  const totalLoss = mistakes.reduce((s, m) => s + (m.loss_realized?.amount ?? 0), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Mistake Journal</CardTitle>
        <p className="text-xs text-stone-500 mt-1">
          {mistakes.length} entries | Total lessons cost: <span className="text-coral-600 font-mono">${totalLoss.toLocaleString()}</span>
        </p>
      </Card>

      {mistakes.map((m) => (
        <MistakeCard key={m.id} mistake={m} />
      ))}

      {mistakes.length === 0 && (
        <Card>
          <p className="text-sm text-stone-500 text-center py-4">
            No mistakes logged yet. That's either great discipline or you haven't started journaling.
          </p>
        </Card>
      )}
    </div>
  );
}

function MistakeCard({ mistake }: { mistake: MistakeEntry }) {
  const categoryColors: Record<string, string> = {
    fomo: 'bg-amber-50 text-amber-700',
    panic_sell: 'bg-coral-50 text-coral-700',
    timing: 'bg-primary-50 text-primary-700',
    no_stop_loss: 'bg-coral-50 text-coral-700',
    emotional: 'bg-amber-50 text-amber-700',
  };

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-stone-900">{mistake.ticker ?? 'General'}</p>
          <p className="text-xs text-stone-400">{mistake.date}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColors[mistake.category] ?? 'bg-stone-100 text-stone-600'}`}>
          {mistake.category.replace(/_/g, ' ')}
        </span>
      </div>
      <p className="text-sm text-stone-700 mt-2">{mistake.action}</p>
      <div className="mt-3 bg-stone-50 rounded-lg p-3 space-y-1">
        <p className="text-xs text-stone-600"><span className="font-medium">Lesson:</span> {mistake.lesson}</p>
        <p className="text-xs text-primary-600"><span className="font-medium">Next time:</span> {mistake.would_do_differently}</p>
      </div>
      {mistake.loss_realized && (
        <p className="text-xs text-coral-600 mt-2 font-mono">
          Loss: ${mistake.loss_realized.amount.toLocaleString()} {mistake.loss_realized.currency}
        </p>
      )}
    </Card>
  );
}

// ─── Shared Components ────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-soft border border-stone-200 p-5">
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-stone-900">{children}</h3>;
}

function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-stone-50 rounded-xl p-3 text-center">
      <p className={`text-lg font-display font-bold ${color}`}>{value}</p>
      <p className="text-xs text-stone-500 mt-0.5">{label}</p>
    </div>
  );
}

function MarketIndexRow({ index }: { index: MarketIndex }) {
  const isUp = index.change >= 0;
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-stone-700">{index.name}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-mono text-stone-900">{index.value.toLocaleString()}</span>
        <span className={`text-xs font-mono ${isUp ? 'text-sage-600' : 'text-coral-600'}`}>
          {isUp ? '+' : ''}{index.change_pct.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="bg-white rounded-2xl shadow-soft border border-stone-200 p-8 flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-stone-200" />
        <div className="h-3 w-24 bg-stone-200 rounded" />
      </div>
    </div>
  );
}

export default Finance;
