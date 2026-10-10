# BizDecide WorkBuddy skills

Generate each skill **inside WorkBuddy** (this keeps the build on WorkBuddy) with the prompt below, install it, then save the generated files into this folder so they're in the repo.

Data shapes: see `lib/types.ts` (Profile, Sale, Purchase, Supplier, Result).

## 1. sme-classifier
> Create a WorkBuddy skill named "sme-classifier". Input: sector, annual sales in RM, full-time employees. Use the rules in knowledge/sme_rules.json (SME Corp Malaysia): classify by sales OR employees, whichever is LOWER; manufacturing vs services_and_other thresholds. Output JSON: {category, basis, salesCategory, employeeCategory, source_url}. Implement the rules in code, not by guessing.

## 2. financial-analyzer
> Create a WorkBuddy skill named "financial-analyzer". Input: JSON with sales [{period, amountRm}] and purchases [{date, invoiceNo, supplier, item, totalRm}]. Remove exact duplicates (same invoiceNo + totalRm) and list them. Group purchases by month and category (ingredients, packaging, rent, utilities, payroll, other). Output per month: revenue, costs by category, net profit, margin %, plus 12-month totals, average monthly net profit, and month-on-month trend. All maths in code.

## 3. supplier-price-tracker
> Create a WorkBuddy skill named "supplier-price-tracker". Input: purchases with supplier, item, date, qty, unitPriceRm. For each supplier+item, compute the unit price over time and flag any increase above 5% versus the trailing 6-month average. Output: flagged items with old price, new price, % change, months affected, extra RM paid, and projected monthly extra cost.

## 4. funding-matcher
> Create a WorkBuddy skill named "funding-matcher". Input: business profile (SME category, sector, years since registration, ownership flags, average monthly net profit, goal) and knowledge/funding_db.xlsx. Score every programme on eligibility (hard criteria pass/fail) and fit (amount vs goal, repayment ≤ 30% of monthly net profit). Output the top 5 with reasons, required documents and official URLs.

## 5. brief-writer (optional)
> Create a WorkBuddy skill named "brief-writer" that turns a BizDecide Result JSON into a branded one-page PDF "CFO Brief" (BizDecide, green #1F6B4A), three numbered decisions with RM impact and evidence, checks and assumptions at the bottom.
