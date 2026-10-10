---
name: supplier-price-tracker
description: BizDecide. Tracks unit prices per supplier and item over time and flags quiet price rises, with extra cost paid so far, projected yearly cost, and whether the rise is item-specific or supplier-wide.
version: 1.0.0
---

# Supplier price tracker (BizDecide)

## Run
```bash
python3 scripts/track.py --data "<link from get_data_link>" [--threshold 5]
```

## Output (JSON)
- `alerts[]` (largest yearly impact first): supplier, item, baseline and latest price with invoice numbers, `changePct`, each price `step`, `extraPaidSinceFirstRise`, `projectedExtraPerYear` / `PerMonth`, `scope` (item-specific vs supplier-wide), `supplierNotifiedPriceChange`, `evidenceInvoices`
- `stableItems[]`

## How to use the result
- An alert with `supplierNotifiedPriceChange: "No"` is a quiet price rise: recommend asking the supplier for the reason and getting alternative quotes.
- Use `projectedExtraPerMonth` as the decision's RM impact. Cite the baseline and latest invoices.
