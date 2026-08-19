#!/usr/bin/env python3
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "profiles.json"

with DATA.open(encoding="utf-8") as f:
    catalogue = json.load(f)

profiles = catalogue["profiles"]
ids = [p["id"] for p in profiles]
allowed = re.compile(r"^[A-Z]+(?:[A-Z]*\d+(?:\.\d+)?(?:x\d+(?:\.\d+)?)*)?$")

errors = []

duplicates = [key for key, count in Counter(ids).items() if count > 1]
if duplicates:
    errors.append(f"duplicate IDs: {duplicates[:20]}")

bad_ids = [value for value in ids if not allowed.fullmatch(value)]
if bad_ids:
    errors.append(f"invalid canonical IDs: {bad_ids[:20]}")

family_counts = Counter(p["family"] for p in profiles)
for code, definition in catalogue["families"].items():
    if family_counts[code] != definition["count"]:
        errors.append(f"family count mismatch {code}: {family_counts[code]} != {definition['count']}")

if catalogue["stats"]["records"] != len(profiles):
    errors.append("stats.records does not match profile count")

review_count = sum(p.get("record_status") == "needs_review" for p in profiles)
if catalogue["stats"]["review_records"] != review_count:
    errors.append("stats.review_records does not match profile records")

for p in profiles:
    if "source" not in p or not p["source"].get("page"):
        errors.append(f"missing source page: {p['id']}")
    if p["family"] not in catalogue["families"]:
        errors.append(f"unknown family: {p['id']} -> {p['family']}")

if errors:
    print("INVALID")
    for error in errors:
        print("-", error)
    raise SystemExit(1)

print("VALID")
print(f"records: {len(profiles)}")
print(f"families: {len(family_counts)}")
print(f"review records: {review_count}")


