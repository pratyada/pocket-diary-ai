# TESTING.md — How to test the Finance Domain

## Quick start (2 minutes)

```bash
cd domains/finance
npm install
npm run demo
```

This runs a full demo with sample data: imports transactions, analyzes spending, imports holdings, logs mistakes, and generates investment suggestions.

---

## Run automated tests

```bash
npm test              # run all 19 tests
npm run test:watch    # watch mode (re-runs on file changes)
```

---

## CLI Reference

All commands are run from `domains/finance/`:

```bash
npx tsx src/cli.ts <command> [options]
# or
npm run cli -- <command> [options]
```

### 1. Import a bank statement

```bash
# Import the sample CSV
npm run cli -- import fixtures/sample-transactions.csv --account account:rbc-chequing --currency CAD

# Import YOUR real bank statement
npm run cli -- import ~/Downloads/rbc-march-2026.csv --account account:rbc-chequing --currency CAD
npm run cli -- import ~/Downloads/hdfc-statement.csv --account account:hdfc-savings --currency INR
npm run cli -- import ~/Downloads/chase-statement.pdf --account account:chase-checking --currency USD
```

### 2. View spending

```bash
# This month
npm run cli -- spending

# By quarter
npm run cli -- spending --period quarter

# Year to date
npm run cli -- spending --period ytd

# Only groceries
npm run cli -- spending --category groceries

# Custom date range
npm run cli -- spending --period custom --start 2026-01-01 --end 2026-03-31
```

### 3. Monthly report

```bash
# Generate April 2026 report (saved to vault)
npm run cli -- report 2026 4
```

### 4. Anomalies

```bash
# All anomalies
npm run cli -- anomalies

# Only high severity
npm run cli -- anomalies --severity high
```

### 5. Import holdings

```bash
# Sample holdings
npm run cli -- holdings fixtures/sample-holdings.csv --account invest:wealthsimple-tfsa --currency CAD

# YOUR brokerage export
npm run cli -- holdings ~/Downloads/wealthsimple-export.csv --account invest:wealthsimple-tfsa --currency CAD
npm run cli -- holdings ~/Downloads/zerodha-holdings.csv --account invest:zerodha-demat --currency INR
```

### 6. Portfolio

```bash
npm run cli -- portfolio
npm run cli -- portfolio --owner partner
```

### 7. Allocation drift

```bash
npm run cli -- drift
```

Note: You need to set allocation targets first. Use the SQLite DB directly:

```bash
# Open the database
sqlite3 data/finance.db

# Set your targets
INSERT INTO fin_allocation_targets VALUES ('prateek', 'equity_us', 40);
INSERT INTO fin_allocation_targets VALUES ('prateek', 'equity_ca', 20);
INSERT INTO fin_allocation_targets VALUES ('prateek', 'equity_intl', 15);
INSERT INTO fin_allocation_targets VALUES ('prateek', 'fixed_income', 15);
INSERT INTO fin_allocation_targets VALUES ('prateek', 'equity_in', 10);
.quit
```

### 8. Market data

```bash
# Major indices (S&P 500, NASDAQ, TSX, NIFTY, SENSEX)
npm run cli -- market

# Specific tickers
npm run cli -- market --tickers AAPL,MSFT,RY.TO,RELIANCE.NS
```

### 9. Watchlist

```bash
npm run cli -- watchlist list
npm run cli -- watchlist add --ticker AAPL --name "Apple Inc"
npm run cli -- watchlist add --ticker RELIANCE.NS --name "Reliance Industries"
npm run cli -- watchlist remove --ticker AAPL
```

### 10. Where to invest

```bash
# Where should I put $10,000 CAD?
npm run cli -- invest 10000

# Where should I put $5,000 USD?
npm run cli -- invest 5000 --currency USD

# For partner
npm run cli -- invest 7000 --owner partner
```

### 11. Net worth

```bash
npm run cli -- networth
```

### 12. Expense forecast

```bash
npm run cli -- forecast --months 6
```

### 13. Mistake journal

```bash
# Log a mistake
npm run cli -- mistake log \
  --ticker TSLA \
  --action "Bought at peak after Elon tweet" \
  --lesson "Never buy on social media hype" \
  --fix "48-hour cooling period, check P/E first" \
  --category fomo

# List all mistakes
npm run cli -- mistake list

# List only FOMO mistakes
npm run cli -- mistake list --category fomo

# Analyze patterns
npm run cli -- mistake analyze
```

---

## Financial Advisor (Agentic Mode)

The advisor analyzes ALL your data and gives you a prioritized action list:

```bash
# Quick checkup (prints to console)
npm run advisor

# Full digest (prints + saves to vault)
npm run advisor:digest
```

The advisor checks:
- Spending trends (month-over-month changes)
- Savings rate (flags if below 20%)
- Category concentration (any category > 30% of spending)
- Subscription burn rate
- Portfolio drift vs targets
- Holdings concentration risk (any position > 25%)
- Mistake patterns (repeating costly behaviors)
- Spending anomalies

---

## Testing with YOUR real data

### Step 1: Export from your banks

| Bank | How to export |
|------|--------------|
| **RBC** | Online Banking → Accounts → Download Transactions → CSV |
| **TD** | EasyWeb → Account Activity → Download → CSV |
| **Wealthsimple** | Activity → Export → CSV |
| **HDFC** | NetBanking → Statement → Download → CSV/PDF |
| **Chase** | Activity → Download → CSV |

### Step 2: Import

```bash
# Canada
npm run cli -- import ~/Downloads/rbc-2026.csv --account account:rbc-chequing --currency CAD

# India
npm run cli -- import ~/Downloads/hdfc-2026.csv --account account:hdfc-savings --currency INR

# US
npm run cli -- import ~/Downloads/chase-2026.csv --account account:chase-checking --currency USD
```

### Step 3: Add your merchants

If the categorizer misses merchants, add them to `rules/merchants.yaml`:

```yaml
# Add your frequently used merchants
restaurant_name: { category: dining, subcategory: restaurants }
your_gym: { category: health, subcategory: gym }
```

### Step 4: Import holdings

Export your holdings from each brokerage and import:

```bash
npm run cli -- holdings ~/Downloads/wealthsimple-tfsa.csv --account invest:wealthsimple-tfsa --currency CAD
npm run cli -- holdings ~/Downloads/zerodha-demat.csv --account invest:zerodha-demat --currency INR
```

### Step 5: Run the advisor

```bash
npm run advisor:digest
```

---

## Database location

All data is stored locally at `domains/finance/data/finance.db` (SQLite).

To inspect directly:

```bash
sqlite3 data/finance.db

-- See all transactions
SELECT date, merchant_raw, amount, category FROM fin_transactions ORDER BY date DESC LIMIT 20;

-- See all holdings
SELECT ticker, shares, avg_cost, current_price FROM fin_holdings;

-- See all mistakes
SELECT date, ticker, action, category FROM fin_mistakes;

-- Monthly spending summary
SELECT strftime('%Y-%m', date) as month, SUM(ABS(amount)) as total
FROM fin_transactions WHERE amount < 0
GROUP BY month ORDER BY month;
```

---

## Vault output

Reports are saved as Markdown in `vault/domains/finance/`:

```
vault/domains/finance/
+-- 2026-04.md              # Monthly report
+-- advisor/
    +-- 2026-05-14.md        # Advisor digest
```

These are Obsidian-compatible — open the vault folder in Obsidian to browse.
