# SME definition (Singapore), structured for the agent

Source: Enterprise Singapore, *FAQ: EDGE Grant*, answer "What is the definition of an SME?" (EDGE launched 30 Sep 2026).
Official page: https://www.enterprisesg.gov.sg/resources/all-faqs/edge-grant
The same test appears on the Enterprise Financing Scheme pages (https://www.enterprisesg.gov.sg/financial-support/enterprise-financing-scheme---sme-working-capital) and in SingStat's glossary (https://www.singstat.gov.sg/find-data/explore-data-themes/industry/enterprises-and-corporate-sector/our-data-explained). Read 10 Oct 2026.

> Singapore does **not** use Malaysia's rule. Malaysia sorts a business into micro, small or medium by the *lower* of sales and employees. Singapore has **one** tier, SME or non-SME, and a business only has to pass **one** of the two tests.

## 1. The size test

An SME is a company with:

- **group** annual sales turnover of **not more than S$100 million**, **or**
- **group** employment of **no more than 200 workers**.

Meeting either limit is enough. SingStat states the converse explicitly: a non-SME has operating revenue *more than* $100mil **and** employment *more than* 200 workers.

| Group sales | Group employees | Result |
|---|---|---|
| ≤ S$100m | any | SME |
| > S$100m | ≤ 200 | SME |
| > S$100m | > 200 | Non-SME |

There are **no official micro / small / medium tiers**. Some blogs publish micro and small bands; none of the official sources cited here do. Do not invent a category below "SME".

## 2. "Group" (EDGE FAQ)

"The group refers to all companies that own more than 50% of the applicant company, as well as all companies that the applicant company owns more than 50% of." Add their sales and headcount before testing. A sole proprietorship with no corporate links is its own group.

For EFS loans, the *borrower group* is wider: corporate shareholders holding more than 50% at every level up, subsidiaries more than 50% owned at every level down, and other subsidiaries more than 50% owned by the ultimate parent.

## 3. Rules the agent must apply

1. **Either test passes.** S$150m sales with 150 staff is an SME. Never take "the smaller category": there is only one.
2. **Group level, not entity level** (EDGE, EFS). This is the opposite of Malaysia's per-entity rule.
3. **No full-time-employee definition is published** for the SME test. Use the headcount the owner reports and say so.
4. **Local ownership is a separate eligibility gate.** Most Enterprise Singapore support needs at least 30% held directly or indirectly by Singapore Citizens and/or PRs, traced to the individual owners (EDGE, EEG, EFS, F&B POP). A business can be an SME and still fail this gate.
5. **Schemes add their own tests.** The Energy Efficiency Grant and EFS accept businesses with group turnover up to **S$500 million**, and SME status only changes the support level (EEG base tier: 70% SME vs 30% non-SME). IRAS's SME Cash Grant 2026 uses YA 2025 revenue ≤ S$100m **or** ≤ 200 employees at 30 Jun 2026, and pays per *local qualifying employee* (Singapore Citizen/PR with on-time CPF contributions). Always read the programme row.
6. **Sole proprietorships count.** ACRA-registered sole proprietorships, partnerships, LLPs and companies can apply for EFS loans (EFS page). Sole proprietors and partners are not "employees" for the SME Cash Grant (IRAS).

## 4. Machine-readable rules (copy into the skill)

```json
{
  "source": "Enterprise Singapore, FAQ: EDGE Grant (Sep 2026)",
  "url": "https://www.enterprisesg.gov.sg/resources/all-faqs/edge-grant",
  "currency": "SGD",
  "thresholds": { "group_sales_lte": 100000000, "group_employees_lte": 200 },
  "combine": "either: SME if sales <= limit OR employees <= limit",
  "tiers": ["SME", "Non-SME"],
  "local_ownership_gate": ">= 30% Singapore Citizens/PRs, ultimate individual ownership (most EnterpriseSG schemes)",
  "group": "companies owning > 50% of the applicant + companies the applicant owns > 50% of"
}
```

```python
def classify_sg(group_sales_sgd: float | None, group_employees: int | None) -> dict:
    """Singapore: one tier. SME if EITHER limit is met; non-SME only if BOTH are exceeded."""
    SALES_MAX, EMP_MAX = 100_000_000, 200
    by_sales = None if group_sales_sgd is None else group_sales_sgd <= SALES_MAX
    by_emp = None if group_employees is None else group_employees <= EMP_MAX
    known = [x for x in (by_sales, by_emp) if x is not None]
    if not known:
        category = None
    elif any(known):
        category = "SME"
    elif len(known) == 2:
        category = "Non-SME"
    else:
        category = None  # one test failed, the other is unknown: ask for the missing figure
    return {
        "category": category,
        "passesSales": by_sales,
        "passesEmployees": by_emp,
        "salesHeadroom": None if group_sales_sgd is None else SALES_MAX - group_sales_sgd,
        "basis": "group sales <= S$100m OR group employees <= 200 (either is enough)",
    }
```

Test cases for the skill:
- F&B, S$406,484, 4 employees → SME (Mei Ling Kopi & Toast demo). Not "micro": there is no such tier.
- S$150 million, 150 employees → SME (employees pass; Malaysia's logic would wrongly say "not an SME")
- S$80 million, 600 employees → SME (sales pass)
- S$120 million, 250 employees → Non-SME
- S$120 million, employees unknown → unknown: ask for headcount

## 5. Not confirmed

- The date this definition took effect is reported as **1 April 2011** (a 22 Mar 2011 release held by the National Archives of Singapore). The archive copy could not be read from our sandbox. **VERIFY** before quoting the date.
