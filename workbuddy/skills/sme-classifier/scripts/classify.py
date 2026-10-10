#!/usr/bin/env python3
"""BizDecide sme-classifier: official SME category for the business's market (profile.market).

Usage: python3 classify.py --data <link-or-file>
   or: python3 classify.py --sector "F&B" --sales 252571 --employees 4 [--market SG]
MY (SME Corp Malaysia, 2024): sales OR full-time employees, whichever gives the LOWER of micro/small/medium.
   The thresholds, the group-ownership rule and the e-invoice threshold come from references/sme_rules.json
   (a copy of knowledge/markets/MY/sme_rules.json; keep the two the same).
SG (Enterprise Singapore): SME if group sales <= S$100m OR group employees <= 200; one tier, no micro/small split.
"""
import json, os, sys
from datetime import date
from _load import load, out, r2

with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "references", "sme_rules.json"), encoding="utf-8") as fh:
    MY_RULES = json.load(fh)
SOURCE = MY_RULES["source_url"]

def _limits(sector):
    s = MY_RULES["sectors"][sector]
    return [("Micro", s["micro"]["sales_rm_lt"], s["micro"]["employees_lt"]),
            ("Small", s["small"]["sales_rm_lt"], s["small"]["employees_lt"]),
            ("Medium", s["medium"]["sales_rm_lte"], s["medium"]["employees_lte"])]

RULES = {k: _limits(k) for k in ("manufacturing", "services_and_other")}
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
months = sorted({s["period"][:7] for s in sales_rows})[-12:]
actual = sum(s["amountRm"] for s in sales_rows if s["period"][:7] in months) if sales_rows else None
declared = p.get("annualSalesDeclaredRm")
emp = p.get("employeesFullTime")
market = p.get("market") or "MY"
res = classify_market(market, p.get("sector"), actual if actual is not None else declared, emp)
res["salesUsed"] = r2(actual) if actual is not None else declared
res["salesSource"] = f"actual sales data, {len(months)} months" if actual is not None else "owner's declared figure"
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
res["unknownForEligibility"] = [k for k in ("householdIncomeMonthlyRm",) if x.get(k) is None and k in x]

def group_status(extras):
    """independent / group / unknown, from the legal form (sole proprietors and partners have no shareholders) or the owner's answer."""
    rule = MY_RULES["group_rule"]
    form = str(extras.get("legalForm") or "").strip().lower()
    answer = str(extras.get("groupOwnership") or "").strip().lower()
    if form and any(form.startswith(f) for f in rule["independent_legal_forms"]):
        return "independent", f"legal form: {extras.get('legalForm')}"
    if answer == "independent":
        return "independent", "owner's answer: independent"
    if answer == "group":
        return "group", "owner's answer: part of a group"
    return "unknown", ("company with unknown group ties" if form else "legal form unknown")

def einvoice(status, declared, actual):
    """MyInvois exemption today: exempt below the threshold, required at or above it, cannot_determine when group ties are unknown."""
    rule = MY_RULES["einvoice"]
    threshold = rule["exemption_threshold_rm"]
    revenue = max([v for v in (declared, actual) if v is not None], default=None)
    if revenue is None:
        verdict = "cannot_determine"
    elif revenue >= threshold:
        verdict = "required"
    else:
        verdict = "exempt" if status == "independent" else "cannot_determine"  # a related company at RM3m+ removes the exemption
    e = {"status": verdict, "thresholdRm": threshold, "revenueUsedRm": r2(revenue) if revenue is not None else None,
         "headroomRm": r2(threshold - revenue) if revenue is not None else None,  # RM, not a ratio
         "declaredRm": declared, "actualRm": r2(actual) if actual is not None else None,
         "nextCheck": rule["next_check"], "nextCheckReason": rule["next_check_reason"],
         "ruleVersion": rule["rule_version"], "sourceUrl": rule["source_url"]}
    if verdict == "cannot_determine" and revenue is not None and revenue < threshold:
        e["why"] = "group ties unknown: a related company with RM3m+ revenue removes the exemption"
    return {k: v for k, v in e.items() if v is not None}

if market in (None, "", "MY"):
    status, basis = group_status(x)
    res["sizeCategory"] = res.get("category")  # the size test only; assistance also needs independence
    res["groupStatus"] = status
    res["groupBasis"] = basis
    if res.get("category") == "Not an SME":
        res["assistanceEligibility"] = "not_eligible"
    elif status == "independent":
        res["assistanceEligibility"] = "eligible"
    else:
        res["assistanceEligibility"] = "cannot_determine"
        res["assistanceNote"] = MY_RULES["group_rule"]["rule"]
        if status == "unknown":
            res["unknownForEligibility"].append("groupOwnership")
            res["askOwner"] = MY_RULES["group_rule"]["ask"]
    res["einvoice"] = einvoice(status, declared, actual)
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
