---
name: financial-analyzer
description: BizDecide. Computes a small business's P&L and reconciles sales, payables and the bank statement in code. Finds duplicate payments, missing QR/card settlements and non-supplier card purchases, and lists what is normal so it is not flagged.
version: 1.1.0
---

# Financial analyzer (BizDecide)

Use this for any BizDecide request before writing decisions. Figures are computed from uploaded rows; missing data and incomplete periods still limit the conclusions. Sales minus supplier purchases is not net profit when rent, wages or other costs are missing.

## Run
1. Get a data link with the `bizdecide` MCP tool `get_data_link(businessId)` (valid 15 minutes).
2. Run:
   ```bash
   python3 scripts/analyze.py --data "<link>"
   ```
   (`--data` also accepts a local JSON file.)

## Output (JSON, ~5 KB)
- `salesTotal` for the observed period; `turnover12m` only for 12 consecutive complete months (otherwise null); `limitations`, `averageMonthlyRevenue`, `monthly[]`, `seasonalDips[]`
- `bank`: opening, closing, totals, `balanceReconciles`
- `findings`: `duplicatePayments`, `missingQrSettlements`, `missingCardSettlements`, `ledgerPaymentsNotInBank`, `nonSupplierCardPurchases` (with receipt lines to split), `cashToRecover`
- `normal_do_not_flag`: cash-on-delivery invoices, QR settling after statement end, card merchant discount rate, delivery payout %, owner drawings

## How to use the result
- Every item in `findings` is a candidate decision; quote the invoice numbers, references and dates as evidence.
- Before delivering numeric impact, use `get_impact_checks` and copy the supported check's id, exact amount/type and all sources. A finding is not automatically an accepted financial effect.
- Never flag anything in `normal_do_not_flag`; mention it as verified instead.
- For `nonSupplierCardPurchases`, propose a line-by-line split and `ask_user` only about unclear lines.
