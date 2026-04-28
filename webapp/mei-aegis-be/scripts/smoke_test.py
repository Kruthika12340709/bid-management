"""End-to-end validation that exercises the same path the browser uses."""
import sys, io, json, urllib.request, urllib.error
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = 'http://localhost:8000'


def req(method, path, body=None, role='director'):
    data = json.dumps(body).encode('utf-8') if body else None
    r = urllib.request.Request(BASE + path, data=data, method=method,
        headers={'Content-Type': 'application/json', 'X-User-Role': role})
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8') or 'null')
    except urllib.error.HTTPError as e:
        return e.code, None


# 1. Edit with UTF-8 ≥ character (browser-style request)
s, _ = req('POST', '/api/hil/BID-2026-041/sections/quality/edit', {
    'performed_by': 'Priya Menon', 'role': 'Director',
    'field_key':      'Q-COVERAGE',
    'original_value': '≥ 85%',
    'revised_value':  '≥ 92%',
    'note':           'Tightened coverage target',
})
print(f'[edit UTF-8] HTTP {s}')

s, secs = req('GET', '/api/bids/BID-2026-041/sections')
q = next(x for x in secs if x['section_key'] == 'quality')
print(f'[approved_data] {json.dumps(q.get("approved_data", {}), ensure_ascii=False)}')

# 2. Approve and check audit
s, app = req('POST', '/api/hil/BID-2026-041/sections/quality/approve', {
    'performed_by': 'Priya Menon', 'role': 'Director',
})
print(f'[approve] action={app["action"]} edits={app["edits_count"]}')

s, audit = req('GET', '/api/audit/?bid_ref=BID-2026-041&action_type=Edited%2BApproved&limit=1')
if audit:
    print(f'[audit] original = {audit[0]["original_value"]}')
    print(f'[audit] revised  = {audit[0]["revised_value"]}')

# 3. Schedule milestones
s, secs = req('GET', '/api/bids/BID-2026-041/sections')
sched = next(x for x in secs if x['section_key'] == 'schedule')
ms = sched['compiled_data']['milestones']
print(f'[schedule] {len(ms)} milestones, first: {ms[0]["name"]} ({ms[0]["start_date"]} → {ms[0]["end_date"]}, role: {ms[0]["role"]}, mode: {ms[0]["mode"]})')
