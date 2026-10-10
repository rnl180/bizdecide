# BizDecide WorkBuddy skills

The repository ships three executable skills. Import their ZIP packages from the
app's `/skills` page, or use the scripts in this checkout. Keep `run_all.py`,
`bizdecide_instructions.md` and `knowledge/` in the WorkBuddy workspace too:
`run_all.py` orchestrates the scripts and the funding pre-screen.

| Skill | Actual output |
|---|---|
| `financial-analyzer` | Monthly sales and supplier purchases; bank/payables/settlement reconciliation; candidate issues and data limitations. It does not establish net profit from incomplete expense data. |
| `supplier-price-tracker` | Price changes from the first to latest invoice for each supplier/item; historical extra cost and conditional monthly/yearly projections. Default alert threshold: above 5%. |
| `sme-classifier` | SME size category using supported annual turnover and/or employee count; annual data coverage, owner facts and missing eligibility information. |

Funding pre-screening runs in `run_all.py`; WorkBuddy reviews the remaining
programme conditions and produces the application pack. There is no standalone
`funding-matcher` package. A separate `brief-writer` PDF skill is optional and is
not shipped. Completed emails and documents are printable from the app.

## Packaging and updates

Each downloadable folder contains `SKILL.md` with name, description and version,
and its own scripts and required resources. The ZIP contains only that folder.
Do not include credentials. Keep packages below the importer's size limit and
bump the skill version when code or instructions change.

After an update, refresh the BizDecide MCP tools and reload
`workbuddy/bizdecide_instructions.md`. Use the provided skill versions instead of
generating different implementations from older example prompts. Numeric decision
effects must be confirmed with `get_impact_checks` before delivery.
