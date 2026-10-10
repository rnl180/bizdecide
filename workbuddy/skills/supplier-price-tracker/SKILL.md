---
name: supplier-price-tracker
description: BizDecide. Tracks unit prices per supplier and item over time and flags quiet price rises, with extra cost paid so far, projected yearly cost, and whether the rise is item-specific or supplier-wide.
version: 1.1.0
---

# Supplier price tracker (BizDecide)

## Run
```bash
python3 scripts/track.py --data "<link from get_data_link>" [--threshold 5]
```

## Output (JSON)
- `alerts[]` (largest yearly impact first): supplier, item, baseline and latest price with invoice numbers, `changePct`, each price `step`, `extraPaidSinceFirstRise`, `projectedExtraPerYear` / `PerMonth`, `scope` (item-specific vs supplier-wide), `supplierNotifiedPriceChange`, `evidenceInvoices`
- each alert also has `series` (every invoice: date, invoice, price, qty, for a sparkline), `formula`, `source` (the purchase rows) and `sst`
- `stableItems[]`, each with its `series` and `sst`
- `sst`: `{ratePct, note: {en, ms}, sourceUrl}` from `references/sst_rates.json` (fresh milk, rice, vegetables: 0%, so a rise is the supplier's margin, not tax). `ratePct: null` means the item is not listed: say "SST status not verified", never guess a rate.

## How to use the result
- An alert with `supplierNotifiedPriceChange: "No"` is a quiet price rise: recommend asking the supplier for the reason and getting alternative quotes.
- Use `projectedExtraPerMonth` as the decision's RM impact. Cite the baseline and latest invoices.
