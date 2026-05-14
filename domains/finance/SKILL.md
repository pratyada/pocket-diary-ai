# SKILL.md — Finance Domain (Pocket Diary AI)

> **Purpose:** Track all financial activity across Canada, India, and US — accounts, investments, expenses, portfolios, and market positions — for Prateek and his wife, with learning from past mistakes.

**Privacy class:** `local-preferred`

---

## Accounts & Regions

| Region | Account types | Currency | Example institutions |
|--------|--------------|----------|---------------------|
| Canada | Chequing, Savings, TFSA, RRSP, RESP (Ved) | CAD | RBC, TD, BMO, Wealthsimple |
| India | Savings, Demat, PPF, FD | INR | HDFC, SBI, ICICI, Zerodha |
| USA | Checking, Savings, Brokerage | USD | Chase, Schwab, IBKR |

**Owners:** `person:prateek`, `person:partner` (wife). Each account tagged with owner.

---

## MCP Tools

### Statement & Transaction Management

| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `import_statement` | `{ path: string, format?: 'pdf'\|'csv'\|'auto' }` | `{ transactions: Transaction[], stats: ImportStats }` | Parse a bank/card statement file, categorize transactions, write to PKG |
| `import_csv` | `{ path: string, mapping?: ColumnMapping }` | `{ transactions: Transaction[], stats: ImportStats }` | Import transactions from CSV with configurable column mapping |
| `query_spending` | `{ period: 'month'\|'quarter'\|'ytd'\|'custom', category?: string, account?: string, start?: string, end?: string }` | `{ breakdown: CategoryBreakdown[], total: Money }` | Query spending by period, category, or account |
| `monthly_report` | `{ year: number, month: number }` | `{ report_path: string, summary: ReportSummary }` | Generate monthly cash-flow report → vault |
| `list_anomalies` | `{ since?: string, severity?: 'low'\|'medium'\|'high' }` | `{ anomalies: Anomaly[] }` | Transactions that deviate >2σ from rolling average |

### Investment & Portfolio

| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `portfolio_summary` | `{ owner?: string, account_type?: string }` | `{ portfolios: Portfolio[], total_value: Money }` | Consolidated view across all investment accounts |
| `import_holdings` | `{ path: string, account_id: string }` | `{ holdings: Holding[], stats: ImportStats }` | Import holdings from brokerage CSV/statement |
| `drift_report` | `{ owner?: string }` | `{ drift: DriftItem[], rebalance_suggestions: Suggestion[] }` | Compare current allocation vs target, suggest rebalance |
| `market_snapshot` | `{ tickers?: string[], indices?: string[] }` | `{ quotes: MarketQuote[], indices: IndexQuote[] }` | Live/delayed quotes from NASDAQ, TSX, NIFTY |
| `watchlist` | `{ action: 'list'\|'add'\|'remove', ticker?: string, alert?: AlertRule }` | `{ items: WatchlistItem[] }` | Manage price/P-E/news alert watchlist |
| `where_to_invest` | `{ amount: Money, owner: string, goal?: string }` | `{ suggestions: InvestSuggestion[] }` | Analyze TFSA/RRSP/RESP room, tax efficiency, suggest allocation |

### Learning & Planning

| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `mistake_journal` | `{ action: 'log'\|'list'\|'analyze', entry?: MistakeEntry }` | `{ entries: MistakeEntry[], patterns?: Pattern[] }` | Log investment mistakes, cluster patterns quarterly |
| `net_worth` | `{ as_of?: string }` | `{ by_region: RegionBreakdown[], by_type: TypeBreakdown[], total: Money }` | Net worth across all regions in base currency (CAD) |
| `expense_forecast` | `{ months: number }` | `{ forecast: MonthForecast[] }` | Project expenses N months forward based on patterns |

---

## Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `transaction.imported` | After statement parsing | `{ transaction_id, account_id, amount, merchant, category }` |
| `transaction.categorized` | After categorization | `{ transaction_id, category, confidence }` |
| `transaction.review_needed` | Confidence < 0.7 | `{ transaction_id, merchant_raw, suggested_category, confidence }` |
| `transaction.recurring_detected` | Recurring pattern found | `{ merchant, amount, cadence, account_id }` |
| `anomaly.detected` | Spending > 2σ | `{ transaction_id, category, amount, expected_range, severity }` |
| `portfolio.drift_alert` | Drift > threshold | `{ account_id, asset_class, target_pct, actual_pct, drift_pct }` |
| `market.alert_triggered` | Watchlist threshold hit | `{ ticker, rule, current_value, threshold }` |
| `mistake.logged` | New mistake entry | `{ entry_id, ticker, lesson }` |

---

## Events Subscribed

| Event | From | Action |
|-------|------|--------|
| `system.daily_cron` | system | Refresh market quotes for portfolio holdings + watchlist |
| `system.weekly_cron` | system | Generate weekly spending digest |
| `system.monthly_cron` | system | Generate monthly report, run drift check |

---

## Cron Schedule

| Schedule | Task |
|----------|------|
| Daily 8:00 AM ET | Refresh market data (quotes for all holdings + watchlist) |
| Weekly Sunday 8:00 PM ET | Weekly spending digest → vault |
| Monthly 1st, 9:00 AM ET | Monthly cash-flow report → vault, portfolio drift check |
| Quarterly | Mistake journal pattern analysis |

---

## PKG Node Types

| Type | ID Pattern | Props |
|------|-----------|-------|
| `account` | `account:<bank>-<type>` | `{ bank, type, currency, region, owner, account_number_last4 }` |
| `merchant` | `merchant:<normalized>` | `{ raw_names: string[], category, subcategory }` |
| `holding` | `holding:<account>:<ticker>` | `{ ticker, shares, avg_cost, currency, asset_class }` |
| `investment_account` | `invest:<bank>-<type>` | `{ bank, type: 'tfsa'\|'rrsp'\|'resp'\|'demat'\|'brokerage', owner, currency, region, contribution_room? }` |

---

## PKG Edge Types

| Edge | From → To | Props |
|------|----------|-------|
| `owns` | person → account/invest | `{ since }` |
| `beneficiary_of` | person → invest (RESP) | `{ beneficiary: 'ved' }` |
| `transacts_at` | account → merchant | `{ frequency, avg_amount }` |
| `holds` | invest → holding | `{ shares, avg_cost }` |

---

## Vault Output

| File pattern | Content |
|-------------|---------|
| `vault/domains/finance/YYYY-MM.md` | Monthly cash-flow: income, expenses by category, savings rate, anomalies |
| `vault/domains/finance/weekly/YYYY-Www.md` | Weekly spending digest |
| `vault/domains/finance/portfolio/YYYY-MM.md` | Portfolio snapshot, drift, market commentary |
| `vault/domains/finance/mistakes/YYYY.md` | Annual mistake journal with pattern analysis |

YAML front-matter: `created`, `domain: finance`, `entities: [list of PKG node IDs touched]`

---

## Cascade Rules

| Action | Goes to Cascade Inbox? | Reason |
|--------|----------------------|--------|
| New account node creation | Yes | Verify account details |
| New merchant categorization (confidence < 0.7) | Yes | Human review needed |
| Rebalance suggestion | Yes | Never auto-trade |
| Where-to-invest suggestion | Yes | Advisory only |
| Routine transaction import | No | Auto-apply |
| Market quote refresh | No | Auto-apply |
| Monthly report generation | No | Auto-apply |

---

## Multi-Currency

Base currency: **CAD**. All cross-currency aggregations convert to CAD using daily rates.

Exchange rate source: European Central Bank (free, no API key) or fallback to hardcoded quarterly averages.

Supported: `CAD`, `USD`, `INR`

---

## Statement Templates

| Bank | Format | Detection |
|------|--------|-----------|
| RBC | PDF | "Royal Bank of Canada" on page 1 |
| TD | PDF | "TD Canada Trust" on page 1 |
| BMO | PDF/CSV | "Bank of Montreal" or BMO CSV headers |
| Wealthsimple | CSV | Column headers match WS export format |
| HDFC | PDF | "HDFC Bank" on page 1 |
| SBI | PDF | "State Bank of India" on page 1 |
| ICICI | PDF/CSV | "ICICI Bank" header detection |
| Chase | PDF/CSV | "JPMorgan Chase" on page 1 |
| Generic CSV | CSV | Configurable column mapping |

---

## Market Data Sources

| Source | Markets | Rate limit | API key needed? |
|--------|---------|-----------|-----------------|
| Yahoo Finance (yfinance) | NASDAQ, TSX, NSE/BSE | ~2000/hr | No |
| Alpha Vantage | All | 5/min free | Yes (free tier) |

Primary: Yahoo Finance. Fallback: Alpha Vantage.

Tickers use exchange suffixes: `AAPL` (NASDAQ), `RY.TO` (TSX), `RELIANCE.NS` (NSE).

---

## File Structure

```
domains/finance/
├── SKILL.md              # this file
├── package.json
├── tsconfig.json
├── taxonomy.yaml         # spending category taxonomy
├── rules/
│   └── merchants.yaml    # merchant → category rules
├── schemas/
│   ├── account.ts
│   ├── transaction.ts
│   ├── portfolio.ts
│   ├── market.ts
│   └── index.ts
├── src/
│   ├── server.ts         # MCP server entry
│   ├── handlers/
│   │   ├── statements.ts # import_statement, import_csv
│   │   ├── spending.ts   # query_spending, monthly_report, list_anomalies
│   │   ├── portfolio.ts  # portfolio_summary, drift_report, import_holdings
│   │   ├── market.ts     # market_snapshot, watchlist
│   │   ├── planning.ts   # where_to_invest, expense_forecast, net_worth
│   │   └── mistakes.ts   # mistake_journal
│   ├── parsers/
│   │   ├── pdf.ts        # PDF text extraction
│   │   ├── csv.ts        # CSV parsing
│   │   └── templates/    # bank-specific templates
│   ├── categorizer.ts    # rules + LLM fallback
│   ├── market-data.ts    # Yahoo Finance + Alpha Vantage client
│   ├── currency.ts       # FX conversion
│   └── anomaly.ts        # statistical anomaly detection
├── tests/
│   ├── statements.test.ts
│   ├── categorizer.test.ts
│   ├── portfolio.test.ts
│   └── anomaly.test.ts
└── fixtures/
    ├── sample-rbc.pdf
    ├── sample-transactions.csv
    └── sample-holdings.csv
```
