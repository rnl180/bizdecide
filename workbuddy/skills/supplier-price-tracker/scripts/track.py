#!/usr/bin/env python3
"""BizDecide supplier-price-tracker: unit-price creep per supplier + item, computed in code.

Usage: python3 track.py --data <link-or-file> [--threshold 5]
Prints a compact JSON summary. Python standard library only.
"""
import sys
from collections import defaultdict
from datetime import date
from _load import load, arg_data, out, r2

d = load(arg_data())
threshold = float(sys.argv[sys.argv.index("--threshold") + 1]) if "--threshold" in sys.argv else 5.0
purchases = d.get("purchases", [])
suppliers = {(s.get("name") or "").lower(): s for s in d.get("suppliers", [])}

def D(s):
    y, m, dd = s[:10].split("-")
    return date(int(y), int(m), int(dd))

series = defaultdict(list)
for p in purchases:
    if p.get("unitPriceRm") is None or not p.get("qty"):
        continue
    series[(p["supplier"], p["item"])].append(p)

alerts, stable = [], []
by_supplier = defaultdict(lambda: {"rose": [], "flat": []})
for (sup, item), rows in series.items():
    rows.sort(key=lambda r: r["date"])
    if len(rows) < 2:
        continue
    base = rows[0]["unitPriceRm"]
    last = rows[-1]["unitPriceRm"]
    change = (last / base - 1) * 100 if base else 0
    key = by_supplier[sup]
    if change > threshold:
        steps, prev = [], base
        for r in rows:
            if r["unitPriceRm"] != prev:
                steps.append({"date": r["date"], "invoice": r.get("invoiceNo"), "from": prev, "to": r["unitPriceRm"], "pct": round((r["unitPriceRm"] / base - 1) * 100, 1)})
                prev = r["unitPriceRm"]
        first_rise = steps[0]["date"]
        extra_paid = sum((r["unitPriceRm"] - base) * r["qty"] for r in rows if r["date"] >= first_rise)
        # orders per year from the average gap between invoices; volume = average qty per order
        span_days = max((D(rows[-1]["date"]) - D(rows[0]["date"])).days, 1)
        orders_per_year = 365 / (span_days / (len(rows) - 1))
        avg_qty = sum(r["qty"] for r in rows) / len(rows)
        annual_extra = (last - base) * avg_qty * orders_per_year
        s = suppliers.get(sup.lower(), {})
        alerts.append({
            "supplier": sup, "item": item,
            "baseline": {"price": base, "date": rows[0]["date"], "invoice": rows[0].get("invoiceNo")},
            "latest": {"price": last, "date": rows[-1]["date"], "invoice": rows[-1].get("invoiceNo")},
            "changePct": round(change, 1), "steps": steps,
            "extraPaidSinceFirstRise": r2(extra_paid),
            "projectedExtraPerYear": r2(annual_extra), "projectedExtraPerMonth": r2(annual_extra / 12),
            "supplierNotifiedPriceChange": s.get("notifiedPriceChange"),
            "evidenceInvoices": [rows[0].get("invoiceNo"), rows[-1].get("invoiceNo")],
        })
        key["rose"].append(item)
    else:
        key["flat"].append(item)
        stable.append({"supplier": sup, "item": item, "price": last, "changePct": round(change, 1)})

for a in alerts:
    other = by_supplier[a["supplier"]]["flat"]
    a["scope"] = "item-specific (other items from this supplier unchanged: " + ", ".join(other) + ")" if other else "all items from this supplier rose (supplier-wide)"

alerts.sort(key=lambda a: -a["projectedExtraPerYear"])
out({"thresholdPct": threshold, "itemsTracked": len(series), "alerts": alerts, "stableItems": stable})
