"""Validate AC-02 (effort) and AC-03 (schedule) calculations end-to-end."""
import sys, io, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

import urllib.request

def get(path):
    with urllib.request.urlopen(f"http://localhost:8000{path}") as r:
        return json.loads(r.read().decode("utf-8"))

print("═" * 76)
print("  AC-02 + AC-03 VALIDATION — derived calculations from upstream modules")
print("═" * 76)

for bid_ref in ("BID-2026-042", "BID-2026-043"):
    print(f"\n— {bid_ref} —")
    secs = get(f"/api/bids/{bid_ref}/sections")
    sec_by_key = {s["section_key"]: s for s in secs}

    # AC-02: effort
    eff = sec_by_key["effort"]
    if not eff.get("compiled_data"):
        print("  [AC-02] no compiled effort data"); continue
    cd = eff["compiled_data"]
    summary = cd.get("summary", {})
    expected_total = sum(t["hours"] for t in cd["tasks"])
    expected_avg   = round(sum(t["confidence"] for t in cd["tasks"]) / len(cd["tasks"]), 2)
    flags_in_data  = [t for t in cd["tasks"] if t["confidence"] < 0.65]

    print(f"  AC-02 effort:")
    print(f"    task_count = {summary['task_count']} (data has {len(cd['tasks'])} tasks)            "
          f"{'✓' if summary['task_count'] == len(cd['tasks']) else '✗'}")
    print(f"    total_hours = {summary['total_hours']}h    (recomputed: {expected_total}h)         "
          f"{'✓' if summary['total_hours'] == expected_total else '✗'}")
    print(f"    avg_confidence = {summary['avg_confidence']}    (recomputed: {expected_avg})    "
          f"{'✓' if abs(summary['avg_confidence'] - expected_avg) < 0.01 else '✗'}")
    print(f"    flagged tasks (conf<0.65) = {len(cd.get('flags', []))} (data: {len(flags_in_data)}) "
          f"{'✓' if len(cd.get('flags', [])) == len(flags_in_data) else '✗'}")
    if cd.get("flags"):
        for f in cd["flags"]:
            print(f"      • {f}")
    print(f"    sample task: {cd['tasks'][0]}")

    # AC-03: schedule
    sched = sec_by_key["schedule"]
    if not sched.get("compiled_data"):
        print("  [AC-03] no compiled schedule data"); continue
    sd = sched["compiled_data"]
    print(f"  AC-03 schedule:")
    print(f"    duration_weeks = {sd['duration_weeks']}")
    print(f"    {len(sd['milestones'])} milestones · {len(sd['conflicts'])} conflict(s)")
    print(f"    start_date = {sd.get('start_date')}")
    print(f"    timeline:")
    for m in sd["milestones"]:
        print(f"      [{m['id']}] {m['name']:<30}  {m['start_date']} → {m['end_date']}  "
              f"(role: {m['role']}, predecessor: {m['predecessor'] or '—'})")

    # Validate sequencing: each milestone's start_date is after its predecessor's end_date
    end_by_id = {m["id"]: m["end_date"] for m in sd["milestones"]}
    seq_ok = True
    for m in sd["milestones"]:
        if not m["predecessor"]:
            continue
        for p in (m["predecessor"] or "").split(", "):
            p = p.strip()
            if p in end_by_id and m["start_date"] <= end_by_id[p]:
                print(f"      ✗ {m['id']} starts {m['start_date']} but predecessor {p} ends {end_by_id[p]}")
                seq_ok = False
    print(f"    sequencing: {'✓ all milestones start after their predecessors' if seq_ok else '✗ ordering broken'}")
