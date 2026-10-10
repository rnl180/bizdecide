---
name: sme-classifier
description: BizDecide. Official SME Corp Malaysia category (micro / small / medium, 2024 definition) from actual sales and full-time employees, with headroom, years operating and owner facts for funding eligibility.
version: 1.2.0
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
`category`, `bySales`, `byEmployees`, `salesUsed`, `salesSource`, `observedSales`, `limitations`, `declaredVsActual` when a complete year can be compared, `next.salesHeadroom`, `yearsOperating`, `ownerFacts`, `unknownForEligibility`, `source`.

Actual annual sales require 12 consecutive complete months. A monthly summary covers a month; daily exports must include every day, including zero-sales days. Otherwise `salesUsed` is the owner's declared annual figure, explicitly labelled unverified, or null. Never classify a partial-period sum as annual turnover. A category based only on employees does not establish a programme's annual-sales eligibility.
