#!/usr/bin/env python3
"""Merge research/combined.json with scoring/copy results (workflow journals) into js/data.js.

usage: build_data.py <scoring-journal.jsonl> [...]
"""
import json, re, sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CASE_KEYS = ["id", "name", "category", "country", "known_as", "relatives", "what_they_got", "the_leg_up", "hook",
             "big_number", "key_facts", "years", "status_2026", "tropes", "nuance", "quote", "surprise", "notability"]
DIMS = {"legup": 40, "stakes": 30, "brazen": 20, "irony": 10}


def clean_sources(srcs):
    seen, out = set(), []
    for s in srcs or []:
        u = (s.get("url") or "").strip()
        if not re.match(r"^https?://", u) or u in seen:
            continue
        seen.add(u)
        out.append({"url": u, "title": (s.get("title") or "").strip()[:140]})
    return out


def main(journals):
    data = json.loads((ROOT / "research/combined.json").read_text())
    labels, scores, copy, review, statmeta, calib, fixes = {}, defaultdict(list), {}, {}, {}, {}, defaultdict(list)
    for j in journals:
        for line in open(j):
            ev = json.loads(line)
            if ev.get("type") == "started":
                labels[ev["key"]] = ev.get("label", "")
                continue
            if ev.get("type") != "result" or not ev.get("result"):
                continue
            lab, r = labels.get(ev["key"], ""), ev["result"]
            if lab.startswith("score:"):
                for s in r.get("scores", []):
                    scores[s["id"]].append(s)
            elif lab.startswith("copy:"):
                for c in r.get("copy", []):
                    copy[c["id"]] = c
            elif lab.startswith("review:"):
                for c in r.get("copy", []):
                    review[c["id"]] = c
            elif lab.startswith("audit:"):
                for f in r.get("fixes", []):
                    fixes[f["id"]].append(f)
            elif lab.startswith("calibrate"):
                for a in r.get("adjust", []):
                    calib[a["id"]] = a
            elif lab.startswith("statmeta"):
                for s in r.get("stats", []):
                    statmeta[s["index"]] = s

    # audit fixes that were false positives (the auditor wasn't shown the sourced pull-quote)
    rejects = {tuple(x) for x in json.loads((ROOT / "research/audit-rejects.json").read_text())}
    overrides = json.loads((ROOT / "research/copy-overrides.json").read_text())
    cases = []
    for c in data["cases"]:
        o = {k: c[k] for k in CASE_KEYS if c.get(k) not in (None, "", [])}
        for f in o.get("key_facts", []):
            f["sources"] = clean_sources(f.get("sources"))
        o["key_facts"] = [f for f in o.get("key_facts", []) if f["sources"]]
        if o.get("quote") and not re.match(r"^https?://", o["quote"].get("url") or ""):
            o.pop("quote")
        ss = scores.get(c["id"], [])
        if ss and c["category"] != "history":
            sc = {d: round(min(mx, max(0, sum(float(s.get(d, 0)) for s in ss) / len(ss)))) for d, mx in DIMS.items()}
            if c["id"] in calib:  # cross-batch calibration pass overrides per-batch averages
                sc = {d: round(min(mx, max(0, float(calib[c["id"]].get(d, sc[d]))))) for d, mx in DIMS.items()}
            sc["total"] = min(100, sum(sc.values()))
            o["score"] = sc
        cp = dict(copy.get(c["id"], {}))
        cp.update({k: v for k, v in review.get(c["id"], {}).items() if v})
        for k in ("headline", "quip", "ticker", "ticker_symbol", "year_label"):
            if cp.get(k):
                o[k] = cp[k]
        if cp.get("sort_year") is not None:
            o["sort_year"] = cp["sort_year"]
        for f in fixes.get(c["id"], []):  # pre-publication audit wins over copy/review
            if (c["id"], f["field"]) in rejects:
                continue
            if o.get(f["field"]) != f["old"]:
                print(f"audit: {c['id']}.{f['field']} text drifted; applying anyway")
            o[f["field"]] = f["new"]
        o.update(overrides.get(c["id"], {}))
        cases.append(o)

    stats = []
    for i, s in enumerate(data.get("stats", [])):
        m = statmeta.get(i, {})
        s = {k: v for k, v in s.items() if k not in ("verdict", "verifier_notes", "risk_flags")}
        s["sources"] = clean_sources(s.get("sources"))
        if m.get("chart_label"):
            s["chart_label"] = m["chart_label"]
        if m.get("hero"):
            s["hero"] = True
        if m.get("drop"):
            continue
        stats.append(s)

    def strip(items):
        out = []
        for x in items:
            x = {k: v for k, v in x.items() if k not in ("verdict", "verifier_notes", "risk_flags")}
            x["sources"] = clean_sources(x.get("sources"))
            out.append(x)
        return out

    payload = {
        "updated": "Nov 2026",
        "cases": cases,
        "stats": stats,
        "quiz": strip(data.get("quiz", [])),
        "trees": strip(data.get("trees", [])),
        "quotes": strip(data.get("quotes", [])),
        "words": strip(data.get("words", [])),
    }
    js = "// Generated by scripts/build_data.py from fact-checked research. Do not edit by hand.\nwindow.NEPO = " + \
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n"
    (ROOT / "js/data.js").write_text(js)
    unscored = [c["name"] for c in cases if c["category"] != "history" and "score" not in c]
    print(f"cases={len(cases)} scored={sum('score' in c for c in cases)} unscored={unscored[:20]} "
          f"stats={len(stats)} quiz={len(payload['quiz'])} trees={len(payload['trees'])} "
          f"quotes={len(payload['quotes'])} words={len(payload['words'])} bytes={len(js)}")


if __name__ == "__main__":
    main(sys.argv[1:])
