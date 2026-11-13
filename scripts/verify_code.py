#!/usr/bin/env python3
"""Check that every snippet in sources/code/tp-N.json is real text from the student's repo."""
import json, os, sys
REPOS = {1: "../corta", 2: "../house-prices", 3: "../rag-mcp-transfomers", 4: "../tp_final_ia_gen"}
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for n in [int(a) for a in sys.argv[1:]] or REPOS:
    p = f"{root}/sources/code/tp-{n}.json"
    if not os.path.exists(p):
        continue
    d = json.load(open(p))
    bad = 0
    for s in d["snippets"]:
        f = os.path.normpath(os.path.join(root, REPOS[n], s["archivo"]))
        if f.endswith(".ipynb") or not os.path.exists(f):
            status = "skip (notebook)" if f.endswith(".ipynb") else "MISSING FILE"
            if status.startswith("MISSING"):
                bad += 1; print(f"TP{n} {s['id']}: {status} {s['archivo']}")
            continue
        text = open(f, encoding="utf-8", errors="replace").read()
        lines = [l for l in s["codigo"].split("\n") if l.strip() and not l.strip().startswith(("# …", "// …", "…"))]
        miss = [l for l in lines if l.strip() not in text]
        if len(miss) > max(1, len(lines) // 10):
            bad += 1; print(f"TP{n} {s['id']}: {len(miss)}/{len(lines)} lines not found in {s['archivo']}")
    print(f"TP{n}: {len(d['snippets'])} snippets, {bad} with problems")
