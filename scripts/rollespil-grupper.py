#!/usr/bin/env python3
import json
import math
import random
import re
import ssl
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

random.seed(42)

for line in Path(__file__).resolve().parents[1].joinpath(".env.local").read_text().splitlines():
    if line.startswith("AIRTABLE_API_KEY"):
        api = line.split("=", 1)[1].strip().strip('"').strip("'")
        break
else:
    raise SystemExit("AIRTABLE_API_KEY missing")

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

records = []
offset = None
while True:
    url = "https://api.airtable.com/v0/appWYXnvNcnZS3yPu/tblbCaeQzsAhNQyF3?pageSize=100"
    if offset:
        url += f"&offset={offset}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {api}"})
    with urllib.request.urlopen(req, context=ctx) as r:
        data = json.load(r)
    records.extend(data["records"])
    offset = data.get("offset")
    if not offset:
        break


def norm_ws(s):
    return re.sub(r"\s+", " ", str(s).strip().lower()) if s else ""


GENDER = {
    "christian gilbert møller": "M",
    "carl gilbert dons christensen": "M",
    "otto gilbert dons christensen": "M",
    "anne sofie dons christensen": "F",
    "svend gilbert dons christensen": "M",
    "aksel rugbjerg": "M",
    "christian andersen": "M",
    "rasmus gosvig": "M",
    "stefi pedersen": "F",
    "otto hardy gosvig": "M",
    "benjamin meier bayat": "M",
    "eva maria meier carlsen": "F",
    "jette meier hammerich": "F",
    "elias meier bayat": "M",
    "valdemar colding borch": "M",
    "anker": "M",
    "iris": "F",
    "karl emil": "M",
    "julie tehrani": "F",
    "mikkel fonager andersen": "M",
    "kirsten brems": "F",
    "neo aanæs": "M",
    "annesofie aanæs": "F",
    "sofus": "M",
    "lauge toftgaard alexandersen": "M",
    "lars alexandersen": "M",
    "lene sanders": "F",
    "alfred bjerre": "M",
    "alma sanders": "F",
    "jonathan sanders": "M",
    "carla sanders": "F",
    "villads": "M",
    "rasmus": "M",
    "eigil": "M",
    "rasmus jensen": "M",
    "halfdan": "M",
    "signe leerbeck mathiesen": "F",
    "christoffer scott": "M",
    "maria lya leerbeck": "F",
    "thea leerbeck mathiesen": "F",
    "mette bisgaard poulsen": "F",
    "johan prado bisgaard poulsen": "M",
    "alfred svarre": "M",
    "andreas lindbjerg nielsen": "M",
    "julian": "M",
    "eleonora lykke-brøndum": "F",
    "sarah-isabel lykke cobos": "F",
    "isabella lykke-brøndum": "F",
    "stine hinke lüth": "F",
    "bertil hinke-grønborg": "M",
    "markus c skjørringe": "M",
    "tina skjørringe": "F",
    "tine busk": "F",
    "sigurd busk stokholm": "M",
    "fenja rørholm kyrsting": "F",
    "trine rørholm kyrsting": "F",
    "thomas højbo kyrsting": "M",
    "sigurd rørholm kyrsting": "M",
    "oscar foshoug madsen": "M",
    "vilja foshaug madsen": "F",
    "bo fahlberg madsen": "M",
}

MALE_FIRST = {
    "mikkel", "jonathan", "thomas", "bo", "rasmus", "halfdan", "eigil", "sigurd",
    "julian", "neo", "alfred", "markus", "bertil", "villads", "lauge", "lars",
    "christian", "christoffer", "andreas", "benjamin", "elias", "anker", "karl",
    "oscar", "svend", "carl", "otto", "aksel", "valdemar", "johan", "sofus",
}
FEMALE_FIRST = {
    "lene", "julie", "anne", "eva", "jette", "kirsten", "annesofie", "laila",
    "line", "maria", "mette", "mikala", "ninna", "sarah-isabel", "stine", "tina",
    "tine", "trine", "emma", "stefi", "carla", "alma", "iris", "fenja", "signe",
    "thea", "eleonora", "isabella", "vilja", "ingrid",
}
ADULT_WOMAN_NO_CHILD = {"jette meier hammerich"}


def age_bucket(age):
    if age is None:
        return None
    if age <= 6:
        return "small"
    if age <= 10:
        return "medium"
    return "large"


def classify(f):
    navn = f.get("Navn", "").strip()
    key = norm_ws(navn)
    alder = f.get("Alder")
    if alder is not None:
        alder = int(alder)
    typ = (f.get("Barn/voksen") or "").strip().lower()
    is_child = typ == "barn" or (alder is not None and typ != "voksen")
    if typ == "voksen" or key in ADULT_WOMAN_NO_CHILD:
        is_child = False

    gender = GENDER.get(key)
    if not gender:
        first = key.split()[0]
        if first in FEMALE_FIRST:
            gender = "F"
        elif first in MALE_FIRST:
            gender = "M"
        else:
            gender = "M"

    bucket = age_bucket(alder) if is_child else None
    if not is_child:
        cat = "man" if gender == "M" else "woman"
    else:
        cat = f"{'boy' if gender == 'M' else 'girl'}_{bucket or 'medium'}"
    return {"navn": navn, "alder": alder, "is_child": is_child, "gender": gender, "cat": cat}


by_fam = defaultdict(list)
for rec in records:
    f = rec["fields"]
    if not any(
        f.get(k) and "rollespil" in norm_ws(f.get(k))
        for k in ["Workshop 1", "Workshop 2", "Workshop 3", "Workshop 4"]
    ):
        continue
    fam = (f.get("Familie") or f.get("Email") or "Ukendt").strip()
    by_fam[fam].append(classify(f))

CATS = [
    "man",
    "woman",
    "boy_small",
    "boy_medium",
    "boy_large",
    "girl_small",
    "girl_medium",
    "girl_large",
]


def fam_counts(members):
    c = Counter()
    for m in members:
        if m["cat"] in CATS:
            c[m["cat"]] += 1
    c["people"] = len(members)
    return c


families = []
for fam, members in by_fam.items():
    families.append({"familie": fam, "members": members, "counts": fam_counts(members)})

total = Counter()
for fam in families:
    for k in CATS:
        total[k] += fam["counts"][k]
targets = {k: total[k] / 4 for k in CATS}
target_people = sum(f["counts"]["people"] for f in families) / 4

weights = {k: 1.0 for k in CATS}
weights["man"] = 2
weights["woman"] = 2


def score_groups(assign):
    groups = [Counter() for _ in range(4)]
    sizes = [0] * 4
    for i, fam in enumerate(families):
        g = assign[i]
        sizes[g] += fam["counts"]["people"]
        for k in CATS:
            groups[g][k] += fam["counts"][k]
    s = 0
    for gi in range(4):
        for k in CATS:
            s += weights[k] * (groups[gi][k] - targets[k]) ** 2
        s += 0.5 * (sizes[gi] - target_people) ** 2
    return s, groups, sizes


n = len(families)
assign = list(range(4)) * (n // 4) + list(range(n % 4))
random.shuffle(assign)
best_assign = assign[:]
best_score = score_groups(assign)[0]

T = 10.0
for _ in range(80000):
    i, j = random.sample(range(n), 2)
    if assign[i] == assign[j]:
        continue
    ai, aj = assign[i], assign[j]
    assign[i], assign[j] = aj, ai
    sc = score_groups(assign)[0]
    if sc < best_score or random.random() < math.exp((best_score - sc) / T):
        if sc < best_score:
            best_score = sc
            best_assign = assign[:]
    else:
        assign[i], assign[j] = ai, aj
    T *= 0.99995

_, groups, sizes = score_groups(best_assign)
group_fams = [[] for _ in range(4)]
for i, fam in enumerate(families):
    group_fams[best_assign[i]].append(fam)

print("=== ROLLESPIL – 4 KLANER ===")
print(f"Deltagere: {sum(sizes)} | Familier: {n}")
print(f"Mål pr. klan: mænd {targets['man']:.1f}, kvinder {targets['woman']:.1f}, personer {target_people:.1f}")
print()

for gi in range(4):
    men = groups[gi]["man"]
    women = groups[gi]["woman"]
    boys = [groups[gi][f"boy_{b}"] for b in ("small", "medium", "large")]
    girls = [groups[gi][f"girl_{b}"] for b in ("small", "medium", "large")]
    print(f"--- KLAN {gi + 1} ({sizes[gi]} personer) ---")
    print(
        f"Mænd {men} | Kvinder {women} | "
        f"Drenge sm/mel/stor {boys[0]}/{boys[1]}/{boys[2]} | "
        f"Piger sm/mel/stor {girls[0]}/{girls[1]}/{girls[2]}"
    )
    for fam in sorted(group_fams[gi], key=lambda x: x["familie"].lower()):
        parts = []
        for m in fam["members"]:
            a = f" ({m['alder']} år)" if m["alder"] is not None else ""
            parts.append(f"{m['navn']}{a}")
        print(f"  {fam['familie']}: {', '.join(parts)}")
    print()

print("=== BALANCE ===")
print("Kategori".ljust(14) + "".join(f"K{i+1}".rjust(5) for i in range(4)) + "  Mål".rjust(6))
for k in CATS:
    print(
        k.ljust(14)
        + "".join(str(groups[i][k]).rjust(5) for i in range(4))
        + f"{targets[k]:5.1f}".rjust(6)
    )
print(
    "Personer".ljust(14)
    + "".join(str(sizes[i]).rjust(5) for i in range(4))
    + f"{target_people:5.1f}".rjust(6)
)
