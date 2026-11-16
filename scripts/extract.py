#!/usr/bin/env python3
"""Pull verified research out of a workflow journal into research/combined.json + scoring batches.

usage: extract.py [--us] <journal.jsonl> [<journal.jsonl> ...]

--us: second research round; writes research/combined-us.json + research/batches-us/ and skips
anyone already in research/combined.json.
"""
import json, re, sys, unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RANK = {"verified": 0, "corrected": 1, "unverified": 2, "rejected": 9}
SPECIAL = {"stats", "quiz", "trees", "quotes", "words"}
# Same person under two spellings -> one canonical normalized name.
ALIAS = {
    "marta ortega perez": "marta ortega",
    "howard g buffett": "howard buffett",
    "sheikh tahnoun bin zayed al nahyan": "sheikh tahnoon bin zayed al nahyan",
    "jose filomeno zenu dos santos": "jose filomeno dos santos",
    "miriam a ma ferguson": "miriam ma ferguson",
}
# Covered by another entry (family entry or the stats section).
DROP = {"delphine arnault", "frederic arnault", "donald trump jr eric trump",
        "the legacy ban wave", "the ivy plus 1"}


def norm(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\(.*?\)", " ", s)
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s)).strip()


def slug(s):
    return re.sub(r"-+", "-", norm(s).replace(" ", "-")).strip("-")[:60]


def load(journals):
    labels, results = {}, []
    for j in journals:
        for line in open(j):
            ev = json.loads(line)
            if ev.get("type") == "started":
                labels[ev["key"]] = ev.get("label", "")
            elif ev.get("type") == "result":
                results.append((ev["key"], ev.get("result")))
    return [(labels.get(k, ""), r) for k, r in results if r]


def main(argv):
    us = argv[:1] == ["--us"]
    journals = argv[1:] if us else argv
    rows = load(journals)
    prior_names, prior_ids = set(), set()
    if us:
        prior = json.loads((ROOT / "research/combined.json").read_text())["cases"]
        prior_names = {ALIAS.get(norm(c["name"]), norm(c["name"])) for c in prior}
        prior_ids = {c["id"] for c in prior}
    cases, special = [], defaultdict(list)
    for label, r in rows:
        m = re.match(r"^(gap-)?verify:([^#]+)#", label)
        if not m:
            continue
        lane = m.group(2)
        if lane in SPECIAL:
            special[lane].extend(r.get("items", []))
        else:
            for c in r.get("cases", []):
                c["lane"] = ("gap-" if m.group(1) else "") + lane
                cases.append(c)

    verdicts = Counter(c.get("verdict") for c in cases)
    best = {}
    for c in cases:
        if c.get("verdict") == "rejected":
            continue
        k = norm(c["name"])
        k = ALIAS.get(k, k)
        if k in DROP or k in prior_names:
            continue
        cur = best.get(k)
        key = (RANK.get(c.get("verdict"), 5), -len(c.get("key_facts", [])))
        if cur is None or key < (RANK.get(cur.get("verdict"), 5), -len(cur.get("key_facts", []))):
            if cur:
                c.setdefault("also_in", []).extend([cur["lane"]] + cur.get("also_in", []))
            best[k] = c
        else:
            cur.setdefault("also_in", []).append(c["lane"])

    used, kept = set(prior_ids), []
    for c in best.values():
        s = slug(c["name"]) or "entry"
        base, i = s, 2
        while s in used:
            s, i = f"{base}-{i}", i + 1
        used.add(s)
        c["id"] = s
        kept.append(c)

    out = {"cases": kept}
    for k in SPECIAL:
        items = [x for x in special.get(k, []) if x.get("verdict") != "rejected"]
        out[k] = items
    (ROOT / "research").mkdir(exist_ok=True)
    (ROOT / ("research/combined-us.json" if us else "research/combined.json")).write_text(json.dumps(out, indent=1, ensure_ascii=False))

    slim_keys = ["id", "name", "category", "country", "known_as", "relatives", "what_they_got", "the_leg_up", "hook",
                 "big_number", "years", "status_2026", "tropes", "nuance", "surprise", "notability"]
    bdir = ROOT / ("research/batches-us" if us else "research/batches")
    bdir.mkdir(exist_ok=True)
    for f in bdir.glob("batch-*.json"):
        f.unlink()
    order = sorted(kept, key=lambda c: (c["category"], c["name"]))
    n = 0
    for i in range(0, len(order), 20):
        n += 1
        batch = []
        for c in order[i:i + 20]:
            s = {k: c.get(k) for k in slim_keys if c.get(k) is not None}
            s["facts"] = [f["fact"] for f in c.get("key_facts", [])]
            if c.get("quote"):
                s["quote"] = c["quote"].get("text")
            if c.get("risk_flags"):
                s["cautions"] = c["risk_flags"]
            batch.append(s)
        (bdir / f"batch-{n:02d}.json").write_text(json.dumps(batch, indent=1, ensure_ascii=False))

    print(json.dumps({
        "case_verdicts": verdicts, "kept_unique": len(kept), "batches": n,
        "by_category": Counter(c["category"] for c in kept),
        "special": {k: f"{len(out[k])} kept of {len(special.get(k, []))}" for k in SPECIAL},
    }, indent=1, default=dict))


if __name__ == "__main__":
    main(sys.argv[1:])
