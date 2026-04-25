"""
Bid compilation engine — computes effort and schedule sections from upstream
module data (solution_module + resource_module).

Implements MVP acceptance criteria:
  - AC-02: Effort aggregates tasks, applies confidence scores, calculates totals,
           flags entries below the confidence threshold.
  - AC-03: Schedule sequences tasks from the dependency map, calculates milestone
           dates from a given start date, flags scheduling conflicts.
"""
from collections import defaultdict, deque
from datetime import date, timedelta
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


# Tunables (would be configurable in production)
WEEKLY_HOURS = 40
CONFIDENCE_THRESHOLD = 0.65


# ─── AC-02: Effort estimation ───────────────────────────────────────────────
async def compute_effort(db: AsyncSession, rfp_id: str) -> Optional[dict]:
    """
    Aggregate every task in solution_module.tasks for this RFP.
      • Cross-reference resource_module.task_allocation to assign roles
      • Sum hours, average confidence
      • Flag any task with confidence < CONFIDENCE_THRESHOLD
    """
    sol = (await db.execute(text("""
        SELECT tasks FROM solution_module
        WHERE rfp_id = :rfp_id ORDER BY created_at DESC LIMIT 1
    """), {"rfp_id": rfp_id})).first()
    res = (await db.execute(text("""
        SELECT task_allocation FROM resource_module
        WHERE rfp_id = :rfp_id ORDER BY created_at DESC LIMIT 1
    """), {"rfp_id": rfp_id})).first()

    if not sol or not sol[0]:
        return None
    tasks_in = sol[0]  # [{id, name, estimated_hours, confidence}, ...]

    # Build task → role map from resource_module.task_allocation
    role_by_task = {}
    if res and res[0]:
        for entry in res[0]:
            role = entry.get("role")
            for t in entry.get("tasks", []):
                role_by_task[t] = role

    out_tasks = []
    total_hours = 0
    confidences = []
    flags = []

    for t in tasks_in:
        tid   = t.get("id", "?")
        name  = t.get("name", "")
        hours = int(t.get("estimated_hours", 0) or 0)
        conf  = float(t.get("confidence", 0.8) or 0.8)
        role  = role_by_task.get(tid, "Unassigned")

        total_hours += hours
        confidences.append(conf)

        if conf < CONFIDENCE_THRESHOLD:
            flags.append(
                f"Task {tid} ({name}) confidence {conf:.2f} is below {CONFIDENCE_THRESHOLD} threshold"
            )

        out_tasks.append({
            "id":         tid,
            "name":       name,
            "role":       role,
            "hours":      hours,
            "confidence": round(conf, 2),
            "source_ref": f"solution_module.tasks#{tid}",
        })

    avg_conf = round(sum(confidences) / len(confidences), 2) if confidences else 0.0

    return {
        "summary": {
            "total_hours":    total_hours,
            "avg_confidence": avg_conf,
            "task_count":     len(out_tasks),
        },
        "tasks": out_tasks,
        "flags": flags,
    }


# ─── AC-03: Delivery schedule ───────────────────────────────────────────────
async def compute_schedule(db: AsyncSession, rfp_id: str, start_date: date) -> Optional[dict]:
    """
    Sequence tasks from solution_module.task_dependencies and calculate
    milestone start/end dates rolling forward from start_date.
    Flags resource conflicts when the same role is double-booked.
    """
    sol = (await db.execute(text("""
        SELECT tasks, task_dependencies FROM solution_module
        WHERE rfp_id = :rfp_id ORDER BY created_at DESC LIMIT 1
    """), {"rfp_id": rfp_id})).first()
    res = (await db.execute(text("""
        SELECT task_allocation FROM resource_module
        WHERE rfp_id = :rfp_id ORDER BY created_at DESC LIMIT 1
    """), {"rfp_id": rfp_id})).first()

    if not sol or not sol[0]:
        return None
    tasks_in = sol[0]
    deps_in  = sol[1] or []  # [{task, depends_on}, ...]

    # Build predecessor index
    predecessors = defaultdict(list)
    for d in deps_in:
        if d.get("task") and d.get("depends_on"):
            predecessors[d["task"]].append(d["depends_on"])

    task_by_id = {t["id"]: t for t in tasks_in}

    # Topological sort (Kahn's)
    in_degree = {tid: len(predecessors[tid]) for tid in task_by_id}
    queue = deque([tid for tid, deg in in_degree.items() if deg == 0])
    order = []
    while queue:
        tid = queue.popleft()
        order.append(tid)
        for other_tid, preds in predecessors.items():
            if tid in preds:
                in_degree[other_tid] -= 1
                if in_degree[other_tid] == 0:
                    queue.append(other_tid)

    # If we couldn't sort everything, append leftovers (cycle / orphan detection is out of scope)
    for tid in task_by_id:
        if tid not in order:
            order.append(tid)

    # Role lookup
    role_by_task = {}
    if res and res[0]:
        for entry in res[0]:
            for t in entry.get("tasks", []):
                role_by_task[t] = entry.get("role")

    # Walk in topological order, assign dates
    end_by_task = {}
    milestones  = []
    conflicts   = []
    role_busy   = defaultdict(list)  # role -> [(start, end), ...]

    for tid in order:
        t = task_by_id.get(tid)
        if not t:
            continue
        hours = int(t.get("estimated_hours", 40) or 40)
        weeks = max(1, (hours + WEEKLY_HOURS - 1) // WEEKLY_HOURS)  # ceiling division

        # Start = day after the latest predecessor end, or start_date if none
        preds = predecessors[tid]
        if preds:
            pred_ends = [end_by_task[p] for p in preds if p in end_by_task]
            t_start = (max(pred_ends) + timedelta(days=1)) if pred_ends else start_date
        else:
            t_start = start_date

        t_end = t_start + timedelta(weeks=int(weeks)) - timedelta(days=1)
        end_by_task[tid] = t_end

        role = role_by_task.get(tid, "Unassigned")
        for (other_start, other_end, other_tid) in role_busy[role]:
            # Overlap check
            if not (t_end < other_start or t_start > other_end):
                week_no = ((t_start - start_date).days // 7) + 1
                conflicts.append(
                    f"{role} double-booked between {other_tid} and {tid} (week {week_no})"
                )
                break
        role_busy[role].append((t_start, t_end, tid))

        milestones.append({
            "id":          tid,
            "name":        t.get("name", tid),
            "start_date":  t_start.isoformat(),
            "end_date":    t_end.isoformat(),
            "predecessor": ", ".join(preds) if preds else None,
            "role":        role,
            "mode":        "remote",
            "duration_weeks": int(weeks),
        })

    # Total duration
    if end_by_task:
        last_day = max(end_by_task.values())
        total_days = (last_day - start_date).days + 1
        total_weeks = (total_days + 6) // 7
    else:
        total_weeks = 1

    # Derive phases (3 buckets: Discovery / Build / UAT) for the gantt visual
    n = len(milestones)
    if n >= 3:
        s1, s2 = max(1, n // 3), max(2, (2 * n) // 3)
        phases = [
            {"name": "Discovery",       "weeks": _weeks_for(milestones[:s1], start_date)},
            {"name": "Build",           "weeks": _weeks_for(milestones[s1:s2], start_date)},
            {"name": "UAT & Handover",  "weeks": _weeks_for(milestones[s2:],  start_date)},
        ]
    elif n > 0:
        phases = [{"name": "Delivery", "weeks": _weeks_for(milestones, start_date)}]
    else:
        phases = []

    return {
        "duration_weeks": total_weeks,
        "phases":         phases,
        "milestones":     milestones,
        "conflicts":      conflicts,
        "start_date":     start_date.isoformat(),
    }


def _weeks_for(milestones, start_date):
    """Map a list of milestones to the set of week numbers they cover."""
    weeks = set()
    for m in milestones:
        ms = date.fromisoformat(m["start_date"])
        me = date.fromisoformat(m["end_date"])
        w_start = ((ms - start_date).days // 7) + 1
        w_end   = ((me - start_date).days // 7) + 1
        for w in range(w_start, w_end + 1):
            weeks.add(w)
    return sorted(weeks)
