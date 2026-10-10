#!/usr/bin/env python3
"""BizDecide financial-analyzer: P&L + three-way reconciliation, computed in code.

Usage: python3 analyze.py --data <link-or-file>
Prints a compact JSON summary. All money in RM. Python standard library only.
"""
import re
from collections import defaultdict
from datetime import date, timedelta
from _load import load, arg_data, out, r2

d = load(arg_data())
sales = d.get("sales", [])
purchases = d.get("purchases", [])
suppliers = d.get("suppliers", [])
bank = d.get("bank", [])
payables = d.get("payables", [])

def D(s):
    y, m, dd = s[:10].split("-")
    return date(int(y), int(m), int(dd))

def norm(s):
    return re.sub(r"[^A-Z0-9]", "", (s or "").upper())

# ---------------- P&L ----------------
by_month = defaultdict(lambda: {"revenue": 0.0, "cash": 0.0, "qr": 0.0, "card": 0.0, "delivery": 0.0, "openDays": 0})
notes = {}
for s in sales:
    m = s["period"][:7]
    b = by_month[m]
    b["revenue"] += s.get("amountRm") or 0
    b["cash"] += s.get("cashRm") or 0
    b["qr"] += s.get("duitnowQrRm") or 0
    b["card"] += s.get("cardRm") or 0
    b["delivery"] += s.get("deliveryGrossRm") or 0
    b["openDays"] += 1
    if s.get("note"):
        notes.setdefault(m, set()).add(s["note"])

cost_by_month = defaultdict(float)
for p in purchases:
    cost_by_month[p["date"][:7]] += p.get("totalRm") or 0

months = sorted(by_month)
turnover = sum(by_month[m]["revenue"] for m in months)
avg_month = turnover / len(months) if months else 0
monthly = []
for m in months:
    b = by_month[m]
    monthly.append({
        "month": m,
        "revenue": r2(b["revenue"]),
        "openDays": b["openDays"],
        "supplierPurchases": r2(cost_by_month.get(m, 0)) if m in cost_by_month else None,
        "vsAverage": f"{(b['revenue'] / avg_month - 1) * 100:+.0f}%" if avg_month else None,
        "note": "; ".join(sorted(notes[m]))[:120] if m in notes else None,
    })
dips = [x for x in monthly if avg_month and x["revenue"] < 0.8 * avg_month]

channel_totals = {k: r2(sum(by_month[m][k] for m in months)) for k in ("cash", "qr", "card", "delivery")}

# ---------------- bank ----------------
credits = sum((t.get("creditRm") or 0) for t in bank)
debits = sum((t.get("debitRm") or 0) for t in bank)
opening = next((t.get("balanceRm") for t in bank if "OPENING" in (t.get("description") or "").upper()), None)
closing = bank[-1].get("balanceRm") if bank else None
period_start = min((D(t["date"]) for t in bank), default=None)
period_end = max((D(t["date"]) for t in bank), default=None)
bank_ok = None
if opening is not None and closing is not None:
    bank_ok = abs(opening + credits - debits - closing) < 0.05

# ---------------- payables vs bank: duplicates / unpaid ----------------
sup_terms = {norm(s.get("name")): (s.get("paymentTerms") or "") for s in suppliers}
debit_lines = [t for t in bank if (t.get("debitRm") or 0) > 0]
duplicates, matched_payables, cash_paid, unmatched_payables = [], [], [], []
for p in payables:
    inv = norm(p["invoiceNo"])
    hits = [t for t in debit_lines if inv and inv in norm(t.get("description")) + norm(t.get("reference"))]
    method = (p.get("method") or "").lower()
    if len(hits) > 1:
        duplicates.append({
            "invoiceNo": p["invoiceNo"], "supplier": p["supplier"], "invoiceAmount": p["amountRm"],
            "timesPaid": len(hits), "overpaid": r2(sum(h["debitRm"] for h in hits) - p["amountRm"]),
            "bankLines": [{"date": h["date"], "reference": h.get("reference"), "amount": h["debitRm"]} for h in hits],
        })
    elif hits:
        matched_payables.append(p["invoiceNo"])
    elif any(abs(t["debitRm"] - p["amountRm"]) < 0.01 and p.get("paidDate") and abs((D(t["date"]) - D(p["paidDate"])).days) <= 3 for t in debit_lines):
        matched_payables.append(p["invoiceNo"])  # paid by card/other ref: matched on amount + date
    elif "cash" in method or "cod" in method:
        cash_paid.append(p["invoiceNo"])
    elif period_start and p.get("paidDate") and period_start <= D(p["paidDate"]) <= period_end:
        unmatched_payables.append({"invoiceNo": p["invoiceNo"], "supplier": p["supplier"], "amount": p["amountRm"], "ledgerPaidDate": p["paidDate"]})

# ---------------- sales vs bank: QR / card / delivery settlements ----------------
def settlement_lines(word):
    lines = {}
    for t in bank:
        desc = (t.get("description") or "").upper()
        if word in desc and (t.get("creditRm") or 0) > 0:
            m = re.search(r"(\d{6})", desc)
            if m:
                lines[m.group(1)] = t
    return lines

qr_lines = settlement_lines("QR")
card_lines = settlement_lines("CARD")
missing_qr, missing_card, qr_after_period = [], [], []
card_gross = card_net = 0.0
for s in sales:
    day = D(s["period"])
    if not period_start or not (period_start - timedelta(days=1) <= day <= period_end):
        continue
    code = day.strftime("%d%m%y")
    settle_day = day + timedelta(days=1)
    qr = s.get("duitnowQrRm") or 0
    if qr > 0:
        if code in qr_lines:
            pass
        elif settle_day > period_end:
            qr_after_period.append({"saleDate": s["period"], "amount": r2(qr)})
        else:
            missing_qr.append({"saleDate": s["period"], "expectedAmount": r2(qr), "expectedOn": settle_day.isoformat(), "expectedDescription": f"DUITNOW QR MERCHANT SETTLEMENT {code}"})
    card = s.get("cardRm") or 0
    if card > 0:
        if code in card_lines:
            card_gross += card
            card_net += card_lines[code]["creditRm"]
        elif settle_day <= period_end:
            missing_card.append({"saleDate": s["period"], "expectedGross": r2(card)})

mdr = (1 - card_net / card_gross) * 100 if card_gross else None

delivery_payouts = [t for t in bank if "DELIVERY" in (t.get("description") or "").upper() and (t.get("creditRm") or 0) > 0]
delivery_checks = []
for t in delivery_payouts:
    m = re.search(r"W/E (\d{2})(\d{2})", t["description"].upper())
    if not m or not period_end:
        continue
    we = date(period_end.year, int(m.group(2)), int(m.group(1)))
    gross = sum((s.get("deliveryGrossRm") or 0) for s in sales if we - timedelta(days=6) <= D(s["period"]) <= we)
    if gross:
        delivery_checks.append({"weekEnding": we.isoformat(), "gross": r2(gross), "payout": t["creditRm"], "payoutPct": round(t["creditRm"] / gross * 100, 1)})

# ---------------- other debits worth a look ----------------
drawings = [{"date": t["date"], "amount": t["debitRm"], "description": t["description"]} for t in debit_lines if "DRAWING" in t["description"].upper()]
known_suppliers = [norm(s.get("name"))[:10] for s in suppliers]
non_supplier_card = []
for t in debit_lines:
    desc = t["description"].upper()
    if desc.startswith("POS DEBIT") and not any(k and k in norm(desc) for k in known_suppliers):
        lines = [p for p in purchases if p["date"] == t["date"] and abs((p.get("invoiceTotalRm") or 0) - t["debitRm"]) < 0.01]
        non_supplier_card.append({
            "date": t["date"], "amount": t["debitRm"], "description": t["description"],
            "receiptLines": [{"item": p["item"], "qty": p.get("qty"), "totalRm": p["totalRm"]} for p in lines],
            "why": "Paid from the business account at a shop that is not a registered supplier; may mix business and personal items. Split line by line and ask the owner only about unclear lines.",
        })

out({
    "business": (d.get("profile") or {}).get("name"),
    "turnover12m": r2(turnover),
    "months": len(months),
    "averageMonthlyRevenue": r2(avg_month),
    "channelTotals12m": channel_totals,
    "seasonalDips": [{"month": x["month"], "revenue": x["revenue"], "vsAverage": x["vsAverage"], "note": x["note"]} for x in dips],
    "monthly": monthly,
    "bank": {
        "period": [period_start.isoformat() if period_start else None, period_end.isoformat() if period_end else None],
        "opening": opening, "closing": closing, "totalCredits": r2(credits), "totalDebits": r2(debits),
        "balanceReconciles": bank_ok,
    },
    "findings": {
        "duplicatePayments": duplicates,
        "missingQrSettlements": missing_qr,
        "missingCardSettlements": missing_card,
        "ledgerPaymentsNotInBank": unmatched_payables,
        "nonSupplierCardPurchases": non_supplier_card,
        "cashToRecover": r2(sum(x["overpaid"] for x in duplicates) + sum(x["expectedAmount"] for x in missing_qr)),
    },
    "normal_do_not_flag": {
        "cashOnDeliveryInvoices": cash_paid,
        "qrSettlingAfterStatementEnd": qr_after_period,
        "cardMerchantDiscountRatePct": round(mdr, 2) if mdr is not None else None,
        "deliveryPayoutChecks": delivery_checks,
        "ownerDrawings_classifyAsDrawingsNotExpenses": drawings,
    },
    "matchedPayables": len(matched_payables),
})
