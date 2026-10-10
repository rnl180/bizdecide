#!/usr/bin/env python3
"""BizDecide: one call for the whole analysis (run from the workbuddy/ folder).

    python3 run_all.py --data "<link from get_data_link>" [--inputs <dir>]

--inputs: a folder holding financial.json, prices.json and sme.json already produced by the three
skills for the same data; those are read instead of run again (the server's Claude engine does this).

Downloads the data once, runs the three skills in parallel (financial-analyzer,
supplier-price-tracker, sme-classifier), pre-screens the funding programmes in
knowledge/funding_db.csv with the rules that can be checked in code, and prints
one compact JSON with candidate decisions ranked by RM impact.
The agent writes the decisions; this script only computes. Standard library only.
"""
import csv, json, os, re, subprocess, sys, tempfile, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
t0 = time.time()

args = sys.argv[1:]
src = args[args.index("--data") + 1] if "--data" in args else (args[0] if args else None)
inputs = args[args.index("--inputs") + 1] if "--inputs" in args else None
if not src:
    sys.exit('usage: python3 run_all.py --data "<link-or-file>"')

# 1) download once
if src.startswith("http"):
    with urllib.request.urlopen(src, timeout=30) as r:
        raw = r.read()
    fd, path = tempfile.mkstemp(suffix=".json")
    os.write(fd, raw)
    os.close(fd)
else:
    path = src

# 2) the three skills, in parallel
SCRIPTS = {
    "financial": "skills/financial-analyzer/scripts/analyze.py",
    "prices": "skills/supplier-price-tracker/scripts/track.py",
    "sme": "skills/sme-classifier/scripts/classify.py",
}

def run(item):
    name, rel = item
    cached = os.path.join(inputs, f"{name}.json") if inputs else None
    if cached and os.path.exists(cached):
        with open(cached, encoding="utf-8") as fh:
            return name, json.load(fh)
    p = subprocess.run([sys.executable, os.path.join(HERE, rel), "--data", path], capture_output=True, text=True, timeout=60)
    if p.returncode != 0:
        return name, {"error": p.stderr.strip()[-500:]}
    return name, json.loads(p.stdout)

with ThreadPoolExecutor(max_workers=3) as ex:
    res = dict(ex.map(run, SCRIPTS.items()))
fin, prices, sme = res["financial"], res["prices"], res["sme"]

# 3) funding pre-screen (deterministic checks only; the agent gives the final verdict)
def money(s):
    m = re.search(r"RM\s?([\d,]+)", s or "")
    return float(m.group(1).replace(",", "")) if m else None

owner = sme.get("ownerFacts", {}) if isinstance(sme, dict) else {}
age, gender, bumi = owner.get("age"), owner.get("gender"), owner.get("bumiputera")
years = sme.get("yearsOperating") if isinstance(sme, dict) else None
turnover = sme.get("salesUsed") if isinstance(sme, dict) else None
unknown = set(sme.get("unknownForEligibility", [])) if isinstance(sme, dict) else set()
group_unknown = isinstance(sme, dict) and sme.get("groupStatus") == "unknown"  # a company whose group ties nobody has told us

# market pack: knowledge/markets/<profile.market>/ (default MY); older flat layout as fallback
try:
    data = json.load(open(path, encoding="utf-8"))
except Exception:
    data = {}
profile = data.get("profile") or {}
market = profile.get("market") or "MY"
pack = os.path.join(HERE, "knowledge", "markets", market)
fund_file = "funding_db.csv"
try:
    fund_file = json.load(open(os.path.join(pack, "market.json"), encoding="utf-8")).get("files", {}).get("fundingDb", fund_file)
except Exception:
    pass
db = os.path.join(pack, fund_file)
if not os.path.exists(db):
    db = os.path.join(HERE, "knowledge", "funding_db.csv")

# Budget 2027 and other tabled measures: proposed, never rules in force. Linked to programmes by id.
try:
    proposed = json.load(open(os.path.join(pack, "proposed_measures.json"), encoding="utf-8"))
except Exception:
    proposed = {}

def proposed_notes(pid):
    label = (proposed.get("label") or {}).get("en", "Proposed, not yet law")
    return [
        f'{label}: ' + ((m.get("note") or {}).get("en") or m["measure"]).replace("{share}", m["program_ids"][pid])
        for m in proposed.get("measures", []) if pid in (m.get("program_ids") or {})
    ]

# Document checklist: each "documents" item of a programme row, marked from the data we hold.
MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
MONTHS_MS = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogos", "Sep", "Okt", "Nov", "Dis"]
NOT_LISTED = re.compile(r"^(not listed|not stated|not published|see |via bank|application form \+ supporting|pitch deck)", re.I)
EXTRA = re.compile(r"^(additional|other) documents|^others? (on request|per bank)|^any accepted", re.I)
bank_months = sorted({str(t.get("date", ""))[:7] for t in data.get("bank") or [] if t.get("date")})
sales_months = sorted({str(s.get("period", ""))[:7] for s in data.get("sales") or [] if s.get("period")})

def month_name(ym, names):
    return f"{names[int(ym[5:7]) - 1]} {ym[:4]}"

def last_months(end, n):
    y, m = int(end[:4]), int(end[5:7])
    out = []
    for _ in range(n):
        out.append(f"{y:04d}-{m:02d}")
        y, m = (y, m - 1) if m > 1 else (y - 1, 12)
    return out[::-1]

def doc_status(item):
    """(status, detail en, detail ms) for one required document, from the data we hold. Never ready unless the data has it."""
    low = item.lower()
    m = re.search(r"(\d+)\s*months?", low)
    if "bank statement" in low or "account statement" in low:
        n = int(m.group(1)) if m else 3
        if "sales records" in low and len(sales_months) >= n:
            return "ready", f"{len(sales_months)} months of sales records ({month_name(sales_months[0], MONTHS_EN)} to {month_name(sales_months[-1], MONTHS_EN)})", \
                f"{len(sales_months)} bulan rekod jualan ({month_name(sales_months[0], MONTHS_MS)} hingga {month_name(sales_months[-1], MONTHS_MS)})"
        if not bank_months:
            return "missing", f"Download the latest {n} months from your bank app", f"Muat turun {n} bulan terkini dari aplikasi bank anda"
        need = last_months(bank_months[-1], n)
        have = [x for x in need if x in bank_months]
        lack = [x for x in need if x not in bank_months]
        if not lack:
            return "ready", f"{n} months on file ({month_name(need[0], MONTHS_EN)} to {month_name(need[-1], MONTHS_EN)})", \
                f"{n} bulan dalam fail ({month_name(need[0], MONTHS_MS)} hingga {month_name(need[-1], MONTHS_MS)})"
        span = lambda xs, names: month_name(xs[0], names) if len(xs) == 1 else f"{names[int(xs[0][5:7]) - 1]}–{month_name(xs[-1], names)}"
        if not have:
            return "missing", f"Download {span(lack, MONTHS_EN)} from your bank app", f"Muat turun {span(lack, MONTHS_MS)} dari aplikasi bank anda"
        return "partial", f"{span(have, MONTHS_EN)} only ({len(have)} of {n} months); download {span(lack, MONTHS_EN)} from your bank app", \
            f"{span(have, MONTHS_MS)} sahaja ({len(have)} daripada {n} bulan); muat turun {span(lack, MONTHS_MS)} dari aplikasi bank anda"
    if re.search(r"\bssm\b|registration", low) and not re.search(r"\bic\b|passport|mykad", low):  # SSM counts where registration is accepted
        ssm = profile.get("ssmNumber")
        if ssm:
            return "ready", f"SSM registration {ssm}", f"Pendaftaran SSM {ssm}"
        return "missing", "Download your SSM certificate from ezBiz", "Muat turun sijil SSM anda dari ezBiz"
    if "sales records" in low and sales_months:
        return "ready", f"{len(sales_months)} months of sales records ({month_name(sales_months[0], MONTHS_EN)} to {month_name(sales_months[-1], MONTHS_EN)})", \
            f"{len(sales_months)} bulan rekod jualan ({month_name(sales_months[0], MONTHS_MS)} hingga {month_name(sales_months[-1], MONTHS_MS)})"
    return "missing", "", ""

def split_items(text):
    """Split on ';' outside parentheses: 'a; b (x; y); c' -> ['a', 'b (x; y)', 'c']."""
    items, depth, cur = [], 0, ""
    for ch in text:
        depth += (ch == "(") - (ch == ")")
        if ch == ";" and depth <= 0:
            items.append(cur)
            cur = ""
        else:
            cur += ch
    return [re.sub(r"^no full checklist.*?:\s*", "", i.strip(), flags=re.I) for i in items + [cur] if i.strip()]

def checklist(documents):
    if not documents.strip() or NOT_LISTED.match(documents.strip()):
        return []
    items = [d for d in split_items(documents) if not EXTRA.search(d)]
    out = []
    for item in items:
        status, en, ms = doc_status(item)
        out.append({k: v for k, v in (("item", item[:160]), ("status", status), ("detail", en), ("detailMs", ms)) if v})
    return out

funding = []
if os.path.exists(db):
    for row in csv.DictReader(open(db, encoding="utf-8")):
        r = {k: (v or "") for k, v in row.items()}
        for k in ("bumi_only", "women_only", "age_rule", "min_operating", "min_turnover", "other_criteria", "notes", "sectors", "status", "verify_flag", "source_url", "id", "program", "type", "min_rm", "max_rm", "shariah", "documents"):
            r.setdefault(k, "")
        checks, ask = [], []
        if r["bumi_only"].strip().upper().startswith("Y") and bumi is not None:
            checks.append(("Bumiputera owner", bool(bumi)))
        if r["women_only"].strip().upper().startswith("Y") and gender:
            checks.append(("Women-owned", gender == "female"))
        rule = r["age_rule"]
        if age is not None:
            m = re.search(r"≤\s?(\d+)", rule)
            if m:
                checks.append((f"Owner age ≤ {m.group(1)}", age <= int(m.group(1))))
            m = re.search(r"(\d+)\s?[-–]\s?(\d+)", rule)
            if m and "≤" not in rule:
                checks.append((f"Owner age {m.group(1)}–{m.group(2)}", int(m.group(1)) <= age <= int(m.group(2))))
        op = r["min_operating"]
        if years is not None:
            m = re.search(r"less than (\d+) years", op, re.I)
            if m:
                checks.append((f"Operating < {m.group(1)} years", years < int(m.group(1))))
            m = re.search(r"(\d+)\s*months", op)
            if m and "to" not in op:
                checks.append((f"Operating ≥ {m.group(1)} months", years * 12 >= int(m.group(1))))
        mt = money(r["min_turnover"])
        if mt and turnover is not None and "≤" not in r["min_turnover"]:
            checks.append((f"Turnover ≥ RM{mt:,.0f}", turnover >= mt))
            if turnover < mt:
                ask.append(f"short by RM{mt - turnover:,.0f}")
        if re.search(r"household income", r["other_criteria"] + r["notes"], re.I) and "householdIncomeMonthlyRm" in unknown:
            ask.append("household income unknown: ASK the owner before deciding")
        if group_unknown:
            ask.append("SME status cannot be determined (group ownership unknown): ASK the owner (independent / part of a group / not sure) before deciding")
        failed = [c for c, ok in checks if not ok]
        funding.append({
            "id": r["id"], "program": r["program"], "type": r["type"],
            "amountRm": [r["min_rm"] or None, r["max_rm"] or None],
            "screen": "fails: " + "; ".join(failed) if failed else ("needs info" if ask else "passes code checks"),
            "checks": [f"{'✓' if ok else '✗'} {c}" for c, ok in checks],
            "notes": ask,
            "otherCriteria": r["other_criteria"][:160],
            "sectors": r["sectors"][:70],
            "status": r["status"][:50],
            "verify": r["verify_flag"] or None,
            "source": r["source_url"],
            # Shariah-compliant: Y / N in the pack; blank means unknown, never assumed
            "shariah": True if r["shariah"].strip().upper().startswith("Y") else (False if r["shariah"].strip().upper().startswith("N") else None),
            "ladder": "matched",  # matched -> eligible -> document_ready (the Verifier moves it); never "approved"
            "checklist": checklist(r["documents"]),
            "proposed": proposed_notes(r["id"]),
        })

# 4) candidate decisions, ranked by RM impact (the agent picks and words the final 3)
cands = []
f = fin.get("findings", {}) if isinstance(fin, dict) else {}
for x in f.get("duplicatePayments", []):
    cands.append({"type": "duplicate_payment", "impactRm": x["overpaid"], "oneOff": True, "evidence": [x["invoiceNo"]] + [b["reference"] for b in x["bankLines"]], "source": x.get("source"), "detail": x})
for x in f.get("missingQrSettlements", []):
    cands.append({"type": "missing_qr_settlement", "impactRm": x["expectedAmount"], "oneOff": True, "evidence": [x["expectedDescription"]], "source": x.get("source"), "detail": x})
for x in f.get("missingCardSettlements", []):
    cands.append({"type": "missing_card_settlement", "impactRm": x["expectedGross"], "oneOff": True, "evidence": [x["saleDate"]], "source": x.get("source"), "detail": x})
for a in (prices.get("alerts", []) if isinstance(prices, dict) else []):
    cands.append({"type": "supplier_price_creep", "impactRm": a["projectedExtraPerMonth"], "perMonth": True, "evidence": a["evidenceInvoices"], "source": a.get("source"), "detail": {k: a.get(k) for k in ("supplier", "item", "changePct", "extraPaidSinceFirstRise", "projectedExtraPerYear", "scope", "supplierNotifiedPriceChange", "formula")}})
for x in f.get("nonSupplierCardPurchases", []):
    cands.append({"type": "mixed_receipt_ask_owner", "impactRm": x["amount"], "oneOff": True, "evidence": [x["description"], x["date"]], "source": x.get("receiptSource") or x.get("source"), "detail": x})
cands.sort(key=lambda c: -(c["impactRm"] * (12 if c.get("perMonth") else 1)))

passing = [x for x in funding if not x["screen"].startswith("fails")]
excluded = [f'{x["id"]}: {x["screen"][7:]}' + (f' ({x["notes"][0]})' if x["notes"] else "") for x in funding if x["screen"].startswith("fails")]
nd = (fin.get("normal_do_not_flag") or {}) if isinstance(fin, dict) else {}
dp = [c["payoutPct"] for c in nd.get("deliveryPayoutChecks", [])]
out = {
    "market": market,
    "elapsedSeconds": round(time.time() - t0, 2),
    "business": fin.get("business") if isinstance(fin, dict) else None,
    "sme": {k: sme.get(k) for k in ("category", "sizeCategory", "assistanceEligibility", "groupStatus", "groupBasis", "assistanceNote", "askOwner", "salesUsed", "salesSource", "salesRows", "declaredVsActual", "next", "yearsOperating", "ownerFacts", "unknownForEligibility", "einvoice", "source") if isinstance(sme, dict) and sme.get(k) is not None},
    "keyNumbers": {
        "turnover12m": fin.get("turnover12m"), "averageMonthlyRevenue": fin.get("averageMonthlyRevenue"),
        "cashToRecover": f.get("cashToRecover"), "bankReconciles": (fin.get("bank") or {}).get("balanceReconciles"),
    },
    "candidateDecisions": cands,
    "verified_ok_do_not_flag": {
        "cashOnDeliveryInvoices": len(nd.get("cashOnDeliveryInvoices", [])),
        "cashOnDeliveryInStatementPeriod": nd.get("cashOnDeliveryInStatementPeriod"),
        "cardMerchantDiscountRatePct": nd.get("cardMerchantDiscountRatePct"),
        "deliveryPayoutPctOfGross": round(sum(dp) / len(dp), 1) if dp else None,
        "ownerDrawings": nd.get("ownerDrawings_classifyAsDrawingsNotExpenses"),
        "qrSettlingAfterStatementEnd": nd.get("qrSettlingAfterStatementEnd"),
        "seasonalDips_explainNotFlag": fin.get("seasonalDips") if isinstance(fin, dict) else None,
    },
    "funding": {
        "source": os.path.relpath(db, HERE) if os.path.exists(db) else None,
        "candidates": [{k: x[k] for k in ("id", "program", "type", "amountRm", "screen", "notes", "otherCriteria", "sectors", "verify", "source", "shariah", "ladder", "checklist", "proposed") if x[k] not in (None, [])} for x in passing],
        "excluded": excluded,
    },
    "errors": {k: v["error"] for k, v in res.items() if isinstance(v, dict) and "error" in v},
}
print(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
