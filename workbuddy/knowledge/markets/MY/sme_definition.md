# SME definition (Malaysia), structured for the agent

Source: SME Corp Malaysia, *Guideline on SME Definition*, updated March 2024 (definition endorsed by the 14th NSDC, July 2013; effective 1 January 2014).
Official PDF: https://www.smecorp.gov.my/images/pdf/2024/Guideline_on_SME_Definition_March_2024_Final.pdf
Section references (§) are to that guideline. Read 10 Oct 2026.

> The original PDF could not be downloaded from our sandbox (the site blocks it). Download it yourself from the link above and save it as `knowledge/markets/MY/sme_definition_guideline.pdf`. This file is the machine-readable version of the same rules.

## 1. A business is an SME only if ALL three hold (§II)

- **A. Size** within the thresholds below
- **B. Establishment type**: registered under Companies Act 2016, Registration of Businesses Act 1956, or LLP Act 2012; or with Sabah/Sarawak authorities; or with a statutory body for professional service providers. Youth associations, trade unions and consumer associations are not SMEs (FAQ 13).
- **C. Shareholding**: not listed on a main board (Bursa Main Market or foreign main boards), and not a subsidiary of a main-board company, large firm, MNC, GLC, MKD (Syarikat Menteri Kewangan Diperbadankan) or state-owned enterprise. ACE/LEAP-listed firms can be SMEs. A subsidiary is an SME only if both parent and subsidiary meet the definition (§II(C)).

## 2. Size thresholds (§II(A)(i))

| Category | Manufacturing | Services & other sectors |
|---|---|---|
| Micro | Turnover < RM300,000 **or** < 5 full-time employees | Turnover < RM300,000 **or** < 5 full-time employees |
| Small | RM300,000 to < RM15 mil **or** 5 to < 75 employees | RM300,000 to < RM3 mil **or** 5 to < 30 employees |
| Medium | RM15 mil to ≤ RM50 mil **or** 75 to ≤ 200 employees | RM3 mil to ≤ RM20 mil **or** 30 to ≤ 75 employees |

"Other sectors" = primary agriculture, construction, mining & quarrying (§IV). F&B (restaurants, cafés) is **services**.

## 3. Rules the agent must apply

1. **OR basis, smaller category wins.** If turnover and employees point to different categories, classify into the **smaller** one (§II(A)(i); FAQ 5). Example: RM400k turnover (small) + 4 employees (micro) → **micro**.
2. **Sales turnover** = total revenue including other income.
3. **Full-time employee** = paid worker on ≥ 6 h/day and ≥ 20 days/month, or ≥ 120 h/month; includes foreign and contract workers; excludes working proprietors, active partners, and unpaid family members (§II(A)(ii)).
4. **Status change** needs 2 consecutive financial years over (or back under) the thresholds on both criteria.
5. **Per legal entity**, not per group (FAQ 12). Control = board control, or > 50% voting power/share capital, or indirect control through a subsidiary (§IV).
6. **Foreign ownership** does not change size class, but government programmes generally require > 50% local equity (§III). Individual programmes set their own threshold (often 51% or 60%); always check the programme row in funding_db.xlsx.
7. Agencies may add their own criteria on top (§V). MIDA incentives and LHDN tax treatment follow their own legislation, not this definition.

## 4. Machine-readable rules (copy into the skill)

```json
{
  "source": "SME Corp Guideline on SME Definition, updated Mar 2024",
  "url": "https://www.smecorp.gov.my/images/pdf/2024/Guideline_on_SME_Definition_March_2024_Final.pdf",
  "thresholds": {
    "manufacturing": {
      "micro":  {"turnover_lt": 300000,   "employees_lt": 5},
      "small":  {"turnover_lt": 15000000, "employees_lt": 75},
      "medium": {"turnover_le": 50000000, "employees_le": 200}
    },
    "services_other": {
      "micro":  {"turnover_lt": 300000,   "employees_lt": 5},
      "small":  {"turnover_lt": 3000000,  "employees_lt": 30},
      "medium": {"turnover_le": 20000000, "employees_le": 75}
    }
  },
  "conflict_rule": "classify each criterion separately; take the SMALLER category",
  "excluded_ownership": ["main_board_listed", "subsidiary_of_main_board_listed", "subsidiary_of_large_firm", "MNC_subsidiary", "GLC_subsidiary", "MKD_subsidiary", "state_owned_subsidiary"],
  "employee_definition": ">=6h/day and >=20 days/month OR >=120h/month; excludes owners, active partners, unpaid family"
}
```

```python
def classify(sector: str, turnover: float, employees: int) -> str | None:
    """Return 'micro' | 'small' | 'medium' | None (not SME). sector: 'manufacturing' or 'services_other'."""
    order = ["micro", "small", "medium"]
    def by_turnover():
        if turnover < 300_000: return "micro"
        if sector == "manufacturing":
            return "small" if turnover < 15_000_000 else ("medium" if turnover <= 50_000_000 else None)
        return "small" if turnover < 3_000_000 else ("medium" if turnover <= 20_000_000 else None)
    def by_employees():
        if employees < 5: return "micro"
        if sector == "manufacturing":
            return "small" if employees < 75 else ("medium" if employees <= 200 else None)
        return "small" if employees < 30 else ("medium" if employees <= 75 else None)
    t, e = by_turnover(), by_employees()
    cats = [c for c in (t, e) if c is not None]
    if not cats:
        return None                     # exceeds both -> not SME
    return min(cats, key=order.index)   # OR basis: smaller category wins
```

Test cases for the skill:
- services, RM265,000, 4 employees → micro (Rock Cafe)
- services, RM400,000, 4 employees → micro (conflict rule)
- services, RM25 mil, 40 employees → medium (employees qualify; turnover alone would exclude)
- manufacturing, RM60 mil, 250 employees → not SME
