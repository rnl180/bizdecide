# Masar Team: research + demo data pack (Dormathon 2026, Track 2)

Built 10 Oct 2026. Folder layout matches the task list.

```
knowledge/
  sme_definition.md            SME Corp 2024 guideline as rules + Python classifier (item 1)
  funding_db.xlsx / .csv / .json   20 programmes, one row each (item 2)
  programs/<id>.md             one fact sheet per programme with official URL (item 3)
research/
  market_stats.md              every number with source link; 2 numbers from the brief corrected (items 4–5)
  competitors.md               Bukku, AutoCount, SQL Account from vendor pages (item 6)
  interviews.md                5-minute script + capture sheet (item 7: you must do these)
demo/kedai-kopi-aminah/        fictional business (items 8–12)
  business_profile.json
  sales_daily_2025-10_to_2026-09.csv, sales_2025-10_to_2026-09.xlsx (Daily + Monthly)
  invoices/*.pdf (25 supplier invoices + 1 unclear receipt), invoices/photos/*.jpg (6 phone-style photos)
  invoices/_index_ground_truth.csv   line items for OCR accuracy testing
  suppliers.csv, supplier_price_history.csv, payables_ledger.csv
  bank/bank_statement_2026-09.pdf + .csv
  ANSWER_KEY.md                planted anomalies + expected funding verdicts. Keep it away from the agent
```

## What still needs a human

1. **Download the original PDFs** (our sandbox is blocked from these sites). Links are in `knowledge/markets/MY/sme_definition.md` and each `programs/*.md`. Save as `knowledge/markets/MY/sme_definition_guideline.pdf` and `knowledge/markets/MY/programs/<id>.pdf`.
2. **Item 2 said "run the funding prompt in WorkBuddy".** Not needed; the DB is built. If you still run it, diff its output against funding_db.xlsx and keep whichever row has an official source.
3. **Interviews (item 7).** Script in research/interviews.md.
4. **Rows marked VERIFY** in funding_db.xlsx (9 of 20). Only matters for rows you show on stage.

## Corrections to the original brief

| Brief said | Problem | Use instead |
|---|---|---|
| "1.3M MSMEs, 96%" (DOSM) | Minister's round number, not a DOSM count | 1,101,725 MSMEs, 96.9% of establishments (2023) |
| "60% unaware of financing" (SME Corp & Huawei) | ~7-year-old survey | 50.6% lack awareness of DFIs (ACCCIM, H1 2026) |
| Competitors = "manual data entry" | False: all three have OCR + bank recon | Differentiate on decisions and funding matching |
| Funding DB = "complete" | ~140 schemes exist per the ministry | Say "20 of ~140, prioritised for micro F&B" |

## Data provenance

- Everything under `knowledge/` and `research/` comes from pages read on 10 Oct 2026; URLs are inline.
- Everything under `demo/` is synthetic (Python, seed 42). The bank, suppliers, owner and SSM number are fictional and every document is watermarked DEMO. Don't remove the watermark.
