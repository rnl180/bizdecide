---
name: sme-classifier
description: BizDecide. Official SME Corp Malaysia category (micro / small / medium, 2024 definition) from actual sales and full-time employees, with headroom, years operating and owner facts for funding eligibility.
version: 1.1.1
---

# SME classifier (BizDecide)

The market comes from `profile.market` (default `MY`). A market without rules returns an `error`; never fall back to another country's rules.

- **Malaysia** (SME Corp Malaysia, Guideline on SME Definition 2024): classify by sales turnover **or** full-time employees, whichever gives the **lower** category. Manufacturing and services/other sectors have different thresholds.

## Run
```bash
python3 scripts/classify.py --data "<link from get_data_link>"
# or directly:
python3 scripts/classify.py --sector "F&B" --sales 252571 --employees 4
```

## Output (JSON)
`category`, `bySales`, `byEmployees`, `salesUsed` and its source (actual data, not the owner's declared figure), `declaredVsActual` if they differ, `next.salesHeadroom` (e.g. how far below a RM300k programme minimum), `yearsOperating`, `ownerFacts` (age, gender, Bumiputera), `unknownForEligibility` (data you must **ask** the owner for before matching programmes that need it), `source`.
