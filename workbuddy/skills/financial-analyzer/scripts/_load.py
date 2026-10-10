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
