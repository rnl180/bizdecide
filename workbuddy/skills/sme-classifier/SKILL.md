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
`category` (also as `sizeCategory`), `bySales`, `byEmployees`, `salesUsed` and its source (actual data, not the owner's declared figure), `declaredVsActual` if they differ, `next.salesHeadroom` in RM (e.g. how far below a RM300k programme minimum), `yearsOperating`, `ownerFacts` (age, gender, Bumiputera), `unknownForEligibility` (data you must **ask** the owner for before matching programmes that need it), `source`.

Malaysia also returns:
- `groupStatus` (`independent` / `group` / `unknown`) and `assistanceEligibility` (`eligible` / `not_eligible` / `cannot_determine`). Sole proprietorships and partnerships (`profileExtras.legalForm`, matched by prefix) are independent by construction; a company with no `profileExtras.groupOwnership` answer is `cannot_determine`, and `askOwner` gives the question to ask (independent / part of a group / not sure). Never assume independent.
- `einvoice`: LHDN MyInvois status today (`exempt` / `required` / `cannot_determine`), `thresholdRm`, `headroomRm` (RM, not a ratio), `declaredRm`, `actualRm`, `nextCheck`, `ruleVersion`, `sourceUrl`. Never say "compliant".

The rules live in `references/sme_rules.json`, a copy of `knowledge/markets/MY/sme_rules.json`; keep the two the same.
