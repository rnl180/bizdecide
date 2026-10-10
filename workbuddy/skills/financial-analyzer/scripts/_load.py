# Shared loader (copied into each skill so every skill stays self-contained).
import json, sys, urllib.request

def load(src):
    """src: an https link from the bizdecide get_data_link tool, or a local JSON file path."""
    if src.startswith("http://") or src.startswith("https://"):
        with urllib.request.urlopen(src, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))
    with open(src, encoding="utf-8") as f:
        return json.load(f)

def arg_data():
    a = sys.argv[1:]
    if "--data" in a:
        return a[a.index("--data") + 1]
    if a:
        return a[0]
    sys.exit("usage: python3 <script> --data <link-or-file>")

def out(obj):
    print(json.dumps(obj, indent=1, ensure_ascii=False, default=lambda x: round(x, 2) if isinstance(x, float) else str(x)))

def r2(x):
    return round(float(x) + 0.0, 2)


def annual_sales(rows):
    """Only use a complete, consecutive 12-month window as annual turnover.

    A monthly total covers its month; daily exports must include each calendar day
    (zero-sales days included). Missing periods remain unknown, never annualised.
    """
    from calendar import monthrange
    months = sorted({r["period"][:7] for r in rows})[-12:]
    periods = {r["period"] for r in rows}
    def serial(month):
        y, m = map(int, month.split("-"))
        return y * 12 + m - 1
    consecutive = len(months) == 12 and serial(months[-1]) - serial(months[0]) == 11
    def covered(month):
        y, m = map(int, month.split("-"))
        return month in periods or all(f"{month}-{day:02}" in periods for day in range(1, monthrange(y, m)[1] + 1))
    total = sum(r["amountRm"] for r in rows if r["period"][:7] in months)
    complete = consecutive and all(covered(m) for m in months)
    return {"months": months, "observedTotal": r2(total), "complete": complete, "annualTotal": r2(total) if complete else None}
