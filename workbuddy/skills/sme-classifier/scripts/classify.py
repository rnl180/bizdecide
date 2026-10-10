#!/usr/bin/env python3
"""BizDecide sme-classifier: official SME category for the business's market (profile.market).

Usage: python3 classify.py --data <link-or-file>
   or: python3 classify.py --sector "F&B" --sales 252571 --employees 4 [--market SG]
MY (SME Corp Malaysia, 2024): sales OR full-time employees, whichever gives the LOWER of micro/small/medium.
SG (Enterprise Singapore): SME if group sales <= S$100m OR group employees <= 200; one tier, no micro/small split.
"""
import sys
from datetime import date
from _load import load, out, r2, annual_sales

SOURCE = "https://smecorp.gov.my/images/pdf/2024/Guideline_on_SME_Definition_March_2024_Final.pdf"
RULES = {
    "manufacturing": [("Micro", 300_000, 5), ("Small", 15_000_000, 75), ("Medium", 50_000_000, 200)],
    "services_and_other": [("Micro", 300_000, 5), ("Small", 3_000_000, 30), ("Medium", 20_000_000, 75)],
}
ORDER = ["Micro", "Small", "Medium", "Not an SME"]

SG_SOURCE = "https://www.enterprisesg.gov.sg/resources/all-faqs/edge-grant"
SG_SALES_MAX, SG_EMPLOYEES_MAX = 100_000_000, 200

def category(value, limits, idx):
    for name, sales_lt, emp_lt in limits:
        lim = (sales_lt, emp_lt)[idx]
        if (value < lim) if name != "Medium" else (value <= lim):
            return name
    return "Not an SME"

def classify(sector, sales, employees):
    group = "manufacturing" if "manufactur" in (sector or "").lower() else "services_and_other"
    by_sales = category(sales, RULES[group], 0) if sales is not None else None
    by_emp = category(employees, RULES[group], 1) if employees is not None else None
    cats = [c for c in (by_sales, by_emp) if c]
    final = min(cats, key=ORDER.index) if cats else None
    nxt = None
    if final in ("Micro", "Small"):
        i = ORDER.index(final)
        lim = RULES[group][i]
        nxt = {"nextCategory": ORDER[i + 1], "salesThreshold": lim[1], "salesHeadroom": r2(lim[1] - sales) if sales is not None else None}
    return {"sectorGroup": group, "bySales": by_sales, "byEmployees": by_emp, "category": final, "basis": "lower of sales and employees", "next": nxt, "source": SOURCE}

def classify_sg(sales, employees):
    """Either test is enough; non-SME only if both limits are exceeded. Figures are group level."""
    by_sales = None if sales is None else ("SME" if sales <= SG_SALES_MAX else "Non-SME")
    by_emp = None if employees is None else ("SME" if employees <= SG_EMPLOYEES_MAX else "Non-SME")
    tests = [c for c in (by_sales, by_emp) if c]
    final = ("SME" if "SME" in tests else "Non-SME") if tests else None
    headroom = {
        "salesBelowLimit": r2(SG_SALES_MAX - sales) if sales is not None else None,
        "employeesBelowLimit": SG_EMPLOYEES_MAX - employees if employees is not None else None,
    }
    return {"market": "SG", "bySales": by_sales, "byEmployees": by_emp, "category": final,
            "basis": "either test: group sales <= S$100m OR group employees <= 200",
            "headroom": headroom,
            "note": "Singapore has no official micro/small/medium tiers. Most Enterprise Singapore schemes also need >= 30% local (Citizen/PR) ownership; check that separately.",
            "source": SG_SOURCE}

def classify_market(market, sector, sales, employees):
    if market == "SG":
        return classify_sg(sales, employees)
    if market not in (None, "", "MY"):
        return {"market": market, "category": None, "error": f"No SME rules for market {market}. Do not apply another country's rules."}
    return classify(sector, sales, employees)

a = sys.argv[1:]
if "--sales" in a:
    sector = a[a.index("--sector") + 1] if "--sector" in a else "services"
    sales = float(a[a.index("--sales") + 1])
    emp = int(a[a.index("--employees") + 1]) if "--employees" in a else None
    market = a[a.index("--market") + 1] if "--market" in a else "MY"
    out(classify_market(market, sector, sales, emp))
    sys.exit()

d = load(a[a.index("--data") + 1] if "--data" in a else a[0])
p = d.get("profile", {})
x = d.get("profileExtras") or {}
sales_rows = d.get("sales", [])
coverage = annual_sales(sales_rows)
months = coverage["months"]
actual = coverage["annualTotal"]
declared = p.get("annualSalesDeclaredRm")
emp = p.get("employeesFullTime")
market = p.get("market") or "MY"
res = classify_market(market, p.get("sector"), actual if actual is not None else declared, emp)
res["salesUsed"] = r2(actual) if actual is not None else declared
res["salesSource"] = "actual sales data, 12 complete months" if actual is not None else ("owner's declared annual figure (not verified against a complete year)" if declared is not None else "unknown: a complete year or declared annual turnover is required")
res["observedSales"] = {"months": len(months), "total": coverage["observedTotal"], "completeYear": coverage["complete"]}
res["limitations"] = [] if coverage["complete"] else ["Incomplete annual sales coverage; do not use the observed total as annual turnover or infer funding turnover eligibility from it."]
if actual is not None:
    res["salesRows"] = {"table": "sales", "keys": months}  # month keys (YYYY-MM) open every day of that month
if declared and actual and abs(declared - actual) / actual > 0.05:
    res["declaredVsActual"] = {"declared": declared, "actual": r2(actual), "note": "Declared turnover differs from the data by more than 5%; use the actual figure."}
since = x.get("registeredOn") or p.get("registeredSince")
if since:
    y, m = int(since[:4]), int(since[5:7])
    t = date.today()
    res["yearsOperating"] = round((t.year - y) + (t.month - m) / 12, 1)
owner = x.get("owner") or {}
res["ownerFacts"] = {k: owner.get(k) for k in ("age", "gender", "bumiputera", "citizenship") if k in owner}
res["unknownForEligibility"] = [k for k in ("householdIncomeMonthlyRm",) if x.get(k) is None]
if actual is None and declared is None:
    res["unknownForEligibility"].append("annualSales")
if market == "SG":
    # Scheme conditions that sit outside the size test: local ownership and local (CPF-paid) staff.
    staff = x.get("staff") or []
    if "localShareholdingPct" in x:
        res["ownerFacts"]["localShareholdingPct"] = x["localShareholdingPct"]
    elif "local_30" in (p.get("ownershipFlags") or []):
        res["ownerFacts"]["localShareholdingPct"] = ">= 30 (owner ticked)"
    else:
        res["unknownForEligibility"].append("localShareholdingPct")
    if staff:
        local = [s for s in staff if s.get("cpf") and "work permit" not in str(s.get("residency", "")).lower()]
        res["ownerFacts"]["localQualifyingEmployees"] = len(local)
        res["ownerFacts"]["staffByResidency"] = {r: sum(1 for s in staff if s.get("residency") == r) for r in sorted({s.get("residency") for s in staff})}
    else:
        res["unknownForEligibility"].append("staff residency and CPF status")
out(res)
