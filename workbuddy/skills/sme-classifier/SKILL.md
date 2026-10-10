---
name: sme-classifier
description: BizDecide. Official SME category for the business's market (Malaysia: SME Corp micro / small / medium; Singapore: Enterprise Singapore SME test) from actual sales and full-time employees, with headroom, years operating and owner facts for funding eligibility.
version: 1.1.0
---

# SME classifier (BizDecide)

The market comes from `profile.market` (default `MY`). A market without rules returns an `error`; never fall back to another country's rules.

- **Malaysia** (SME Corp Malaysia, Guideline on SME Definition 2024): classify by sales turnover **or** full-time employees, whichever gives the **lower** category. Manufacturing and services/other sectors have different thresholds.
- **Singapore** (Enterprise Singapore): an SME if **group** sales ≤ S$100m **or** group employees ≤ 200; non-SME only if both are exceeded. One tier, no micro/small/medium. Most schemes also need ≥ 30% local ownership, reported in `ownerFacts`.

## Run
```bash
python3 scripts/classify.py --data "<link from get_data_link>"
# or directly:
python3 scripts/classify.py --sector "F&B" --sales 252571 --employees 4 [--market SG]
```

## Output (JSON)
`category`, `bySales`, `byEmployees`, `salesUsed` and its source (actual data, not the owner's declared figure), `declaredVsActual` if they differ, `next.salesHeadroom` (e.g. how far below a RM300k programme minimum), `yearsOperating`, `ownerFacts` (age, gender, Bumiputera; for Singapore also `localShareholdingPct`, `localQualifyingEmployees` and staff by residency), `unknownForEligibility` (data you must **ask** the owner for before matching programmes that need it), `source`.
