#!/usr/bin/env python3
"""Genera data/, content/ y static/data/ a partir de sources/.

Uso:  python3 scripts/build_data.py
Después: zola serve   (o zola build)
"""
import glob
import json
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "sources")
DATA = os.path.join(ROOT, "data")
CONTENT = os.path.join(ROOT, "content")
STATIC_DATA = os.path.join(ROOT, "static", "data")

BLOQUE = {1: "Introducción", 9: "Entrenamiento de LLMs"}
# Decks in the course repo that are not listed in the course calendar (shown as complementary).
EXTRA_DECKS = {"claude-desktop-chat", "claude-cowork"}
TAB_LABEL = {
    "introduccion": "Bienvenida e introducción",
    "claude-desktop-chat": "Claude Desktop: chat",
    "cowork-intro": "Agentes de código y la misión Corta",
    "claude-cowork": "Claude Cowork",
    "rag-mcp-rapida": "MCP y herramientas",
    "palabra-al-transformer": "De la palabra al transformer",
}


def load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def dump(obj, p):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)


def write(p, text):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(text)


def toml_str(s):
    return json.dumps(s, ensure_ascii=False)


# ---------- load sources ----------
clases = sorted((load(p) for p in glob.glob(f"{SRC}/clases/clase-*.json")), key=lambda c: c["num"])
tps = sorted((load(p) for p in glob.glob(f"{SRC}/tps/tp-*.json")), key=lambda t: t["num"])
tp_by = {t["num"]: t for t in tps}

deck_class, deck_slides, deck_notes, deck_meta = {}, {}, {}, {}
for c in clases:
    for slug in c.get("talks", []):
        if not os.path.exists(f"{SRC}/slides/{slug}.input.json"):
            continue
        deck_class.setdefault(slug, c["num"])
        deck_slides[slug] = load(f"{SRC}/slides/{slug}.input.json")
        npath = f"{SRC}/notes/{slug}.notes.json"
        notes = load(npath) if os.path.exists(npath) else []
        by_i = {n.get("i"): n for n in notes}
        deck_notes[slug] = [by_i.get(i, {}) for i in range(len(deck_slides[slug]))]
        deck_meta[slug] = load(f"{SRC}/slides/{slug}.deck.json")

concepts = {}
for c in clases:
    for k in c.get("conceptos", []):
        concepts.setdefault(k["id"], dict(k, clase=c["num"], refs=[]))


# ---------- code catalogs (sources/code/tp-N.json) ----------
SNIPPETS = {}   # key "tp3-id" -> snippet dict (+ tp, usos)
CODE_REF = {}   # (tp, slug, i) -> ([keys in reading order], nota)
for t in tps:
    pth = f"{SRC}/code/tp-{t['num']}.json"
    if not os.path.exists(pth):
        continue
    cat = load(pth)
    for sn in cat.get("snippets", []):
        k = f"tp{t['num']}-{sn['id']}"
        SNIPPETS[k] = dict(sn, key=k, tp=t["num"], tp_titulo=t["titulo"], usos=[])
    for r in cat.get("refs", []):
        # "snippets": the chain for this slide (definition → where it is wired → where it is used).
        # "snippet" (a single id) is the older form and still accepted.
        ids = r.get("snippets") or ([r["snippet"]] if r.get("snippet") else [])
        ks = [f"tp{t['num']}-{x}" for x in ids if f"tp{t['num']}-{x}" in SNIPPETS]
        if ks:
            CODE_REF[(t["num"], r["slug"], int(r["i"]))] = (ks, r.get("nota", ""))


def title_of(slug, i):
    s = deck_slides.get(slug, [])
    return s[i]["title"] if 0 <= i < len(s) else ""


MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]


def fecha_txt(f):
    if not f:
        return ""
    y, m, d = (int(x) for x in f.split("-"))
    return f"{d} {MESES[m - 1]}"


def nn(n):
    return f"{int(n):02d}"


def slide_url(slug, i):
    return f"/clases/{deck_class[slug]:02d}/#d={slug}&s={i}"


# ---------- per-class data ----------
tp_refs = {t["num"]: [] for t in tps}
class_payloads = []
index_rows = []
search = []
for c in clases:
    n = c["num"]
    decks = []
    tot = key = tpn = 0
    for slug in c.get("talks", []):
        if slug not in deck_slides:
            continue
        slides = []
        ex = slug in EXTRA_DECKS   # every reference to these slides carries the flag, so the UI can tag it
        for i, s in enumerate(deck_slides[slug]):
            nt = deck_notes[slug][i]
            claves = []
            for k in nt.get("claves", []) or []:
                if k in concepts:
                    claves.append({"id": k, "label": concepts[k]["termino"], "glos": True})
                    concepts[k]["refs"].append({"slug": slug, "i": i, "clase": n, "title": s["title"], "extra": ex})
                else:
                    claves.append({"id": k, "label": k.replace("-", " "), "glos": False})
            tpl = []
            for t in nt.get("tp", []) or []:
                tn = int(t.get("tp", 0))
                if tn in tp_by:
                    cks, cnota = CODE_REF.get((tn, slug, i), ([], ""))
                    tpl.append({"tp": tn, "texto": t.get("texto", ""), "tp_titulo": tp_by[tn]["titulo"],
                                "code": ",".join(cks), "ncode": len(cks), "nota": cnota})
                    for ck in cks:
                        SNIPPETS[ck]["usos"].append({"clase": n, "cnn": nn(n), "slug": slug, "i": i, "title": s["title"], "extra": ex})
                    tp_refs[tn].append({"clase": n, "slug": slug, "i": i, "title": s["title"], "texto": t.get("texto", ""), "extra": ex})
            ver = []
            for v in nt.get("ver", []) or []:
                ref = str(v.get("ref", ""))
                if "#" not in ref:
                    continue
                vs, vi = ref.split("#", 1)
                try:
                    vi = int(vi)
                except ValueError:
                    continue
                if vs in deck_class:
                    ver.append({"url": slide_url(vs, vi), "clase": deck_class[vs], "cnn": nn(deck_class[vs]), "i": vi,
                                "title": title_of(vs, vi), "por": v.get("por", ""), "extra": vs in EXTRA_DECKS})
            slides.append({"i": i, "title": s["title"] or ("Portada" if i == 0 else f"Diapositiva {i}"),
                           "section": s["section"], "resumen": nt.get("resumen", ""), "claves": claves,
                           "tp": tpl, "ver": ver, "key": bool(nt.get("clave_examen"))})
            tot += 1
            key += bool(nt.get("clave_examen"))
            tpn += bool(tpl)
            search.append(dict({"t": s["title"], "c": n, "d": slug, "i": i,
                           "x": (nt.get("resumen", "") + " " + " ".join(nt.get("claves", []) or []) + " " + s.get("visible_text", "")[:240]).strip()},
                          **({"e": 1} if ex else {})))
        groups = []
        for sl in slides:
            lab = sl["section"] or "Portada"
            if not groups or groups[-1]["label"] != lab:
                groups.append({"label": lab, "slides": []})
            groups[-1]["slides"].append({"i": sl["i"], "title": sl["title"], "key": sl["key"], "tp": bool(sl["tp"])})
            sl["section_label"] = lab
            sl["last"] = len(slides) - 1
        for g in groups:
            g["first"], g["last"] = g["slides"][0]["i"], g["slides"][-1]["i"]
            g["ntp"] = sum(1 for x in g["slides"] if x["tp"])
            g["nkey"] = sum(1 for x in g["slides"] if x["key"])
        decks.append({"slug": slug, "titulo": deck_meta[slug].get("class") or slug, "slides": slides, "groups": groups,
                      "tab": TAB_LABEL.get(slug, deck_meta[slug].get("class") or slug), "extra": slug in EXTRA_DECKS,
                      "total": len(slides)})
    bloque = BLOQUE.get(n, c.get("bloque", ""))
    class_payloads.append({"num": n, "nn": nn(n), "fecha": fecha_txt(c.get("fecha")), "titulo": c["titulo"], "bloque": bloque, "decks": decks,
          "multi": len(decks) > 1, "prev": nn(n - 1) if n > 1 else "", "next": nn(n + 1) if n < len(clases) else ""})
    index_rows.append({"num": n, "nn": nn(n), "fecha": fecha_txt(c.get("fecha")), "titulo": c["titulo"], "bloque": bloque,
                       "slides": tot, "key": key, "tp": tpn,
                       "decks": [{"tab": d["tab"], "extra": d["extra"]} for d in decks],
                       "tps": sorted({r["tp"] for d in decks for s in d["slides"] for r in s["tp"]})})
    write(f"{CONTENT}/clases/{n:02d}.md",
          f'+++\ntitle = {toml_str(c["titulo"])}\nweight = {n}\ntemplate = "clase.html"\n[extra]\nnum = {n}\ndata = "data/clase-{n:02d}.json"\n+++\n')

# ---------- attach code snippets, then write class files ----------
for sn in SNIPPETS.values():
    for u in sn["usos"]:
        u["url"] = slide_url(u["slug"], u["i"])
    sn["nusos"] = len(sn["usos"])
for cp in class_payloads:
    keys = []
    for d in cp["decks"]:
        for sl in d["slides"]:
            for t in sl["tp"]:
                for k in filter(None, t["code"].split(",")):
                    if k not in keys:
                        keys.append(k)
    cp["snippets"] = [SNIPPETS[k] for k in keys]
    dump(cp, f"{DATA}/clase-{cp['num']:02d}.json")

# ---------- TPs ----------
tp_rows = []
for t in tps:
    n = t["num"]
    refs = sorted(tp_refs[n], key=lambda r: (r["clase"], r["slug"], r["i"]))
    groups = []
    for r in refs:
        if not groups or groups[-1]["clase"] != r["clase"]:
            groups.append({"clase": r["clase"], "cnn": nn(r["clase"]), "titulo": next(c["titulo"] for c in clases if c["num"] == r["clase"]), "items": []})
        groups[-1]["items"].append(dict(r, url=slide_url(r["slug"], r["i"])))
    dump({"num": n, "titulo": t["titulo"], "repo": t.get("repo", ""), "consigna": t.get("consigna", ""),
          "que_hicimos": t.get("que_hicimos", ""), "resultados": t.get("resultados", ""),
          "decisiones": [{"decision": d.get("decision", ""), "por_que": d.get("por_que", "")} for d in t.get("decisiones", [])],
          "nrefs": len(refs), "groups": groups,
          "snippets": sorted([sn for sn in SNIPPETS.values() if sn["tp"] == n], key=lambda x: (x["archivo"], x.get("desde") or 0))},
         f"{DATA}/tp-{n}.json")
    tp_rows.append({"num": n, "titulo": t["titulo"], "repo": t.get("repo", ""), "nrefs": len(refs),
                    "clases": [nn(x) for x in sorted({r["clase"] for r in refs})]})
    write(f"{CONTENT}/tp/{n}.md",
          f'+++\ntitle = {toml_str(t["titulo"])}\nweight = {n}\ntemplate = "tp.html"\n[extra]\nnum = {n}\ndata = "data/tp-{n}.json"\n+++\n')

# ---------- glossary ----------
glos = []
for k in sorted(concepts.values(), key=lambda x: x["termino"].lower()):
    seen, refs = set(), []
    for r in k["refs"]:
        key_ = (r["slug"], r["i"])
        if key_ not in seen:
            seen.add(key_)
            refs.append(dict(r, url=slide_url(r["slug"], r["i"]), cnn=nn(r["clase"])))
    glos.append({"id": k["id"], "termino": k["termino"], "definicion": k.get("definicion", ""),
                 "trampa": k.get("trampa", ""), "clase": k["clase"], "cnn": nn(k["clase"]), "refs": refs[:10],
                 "nrefs": len(refs), "more": max(0, len(refs) - 10)})
    search.append({"t": k["termino"], "g": k["id"], "c": k["clase"], "x": k.get("definicion", "")[:200]})
dump(glos, f"{DATA}/glosario.json")
bloques = []
for r in index_rows:
    if not bloques or bloques[-1]["bloque"] != r["bloque"]:
        bloques.append({"bloque": r["bloque"], "clases": []})
    bloques[-1]["clases"].append(r)
dump({"clases": index_rows, "bloques": bloques, "tps": tp_rows,
      "total_slides": sum(r["slides"] for r in index_rows), "total_key": sum(r["key"] for r in index_rows)}, f"{DATA}/index.json")

# ---------- practice + search (client side) ----------
practice = {
    "clases": [{"num": c["num"], "titulo": c["titulo"], "flashcards": c.get("flashcards", []),
                "quiz": c.get("quiz", []), "desarrollo": c.get("desarrollo", [])} for c in clases],
    "tps": [{"num": t["num"], "titulo": t["titulo"], "flashcards": t.get("preguntas_defensa", []),
             "quiz": t.get("quiz", [])} for t in tps],
}
os.makedirs(STATIC_DATA, exist_ok=True)
with open(f"{STATIC_DATA}/practice.json", "w", encoding="utf-8") as f:
    json.dump(practice, f, ensure_ascii=False, separators=(",", ":"))
with open(f"{STATIC_DATA}/search.json", "w", encoding="utf-8") as f:
    json.dump(search, f, ensure_ascii=False, separators=(",", ":"))

# ---------- section/index pages ----------
write(f"{CONTENT}/_index.md", '+++\ntitle = "IA Generativa"\ntemplate = "index.html"\n+++\n')
write(f"{CONTENT}/clases/_index.md", '+++\ntitle = "Clases"\ntemplate = "index.html"\nsort_by = "weight"\n+++\n')
write(f"{CONTENT}/tp/_index.md", '+++\ntitle = "Trabajos prácticos"\ntemplate = "index.html"\nsort_by = "weight"\n+++\n')
write(f"{CONTENT}/glosario.md", '+++\ntitle = "Glosario"\ntemplate = "glosario.html"\n+++\n')
write(f"{CONTENT}/practica.md", '+++\ntitle = "Práctica"\ntemplate = "practica.html"\n+++\n')
write(f"{CONTENT}/marcadas.md", '+++\ntitle = "Marcadas"\ntemplate = "marcadas.html"\n+++\n')

print(f"clases={len(clases)} tps={len(tps)} slides={sum(r['slides'] for r in index_rows)} "
      f"tp_refs={sum(len(v) for v in tp_refs.values())} glosario={len(glos)} search={len(search)}")
