# Virtual Humanoid User Flow — Bid Management Platform

**AI Execution Specification for the Centific Bid Management Web Application**

This document is written so an AI agent or virtual humanoid can read the flow, identify the target screen, locate the UI element, perform the required action, validate the result, narrate like a human, and recover if the UI does not behave as expected.

| Document Field             | Value                                                                          |
|----------------------------|--------------------------------------------------------------------------------|
| Prototype application name | Centific Bid Management Platform                                               |
| Primary user roles         | Bid Manager (Arjun Kapoor)  ·  Bid Director (Priya Menon)                      |
| Execution actor            | Virtual humanoid operating the simulated desktop in a browser                  |
| Created / regenerated on   | 2026-04-25                                                                     |
| Template status            | Live build, mapped to running application at `localhost:5173`                   |

> **Screenshot policy.** Take a screenshot at every screen transition listed in §4 and store with the `screen_id` as filename. The doc references these as `/screenshots/SCR-XXX.png`. Capture in 1440×900 viewport at 100% zoom. Suggested capture points are flagged as **📸**.

---

## 1. Prototype Scenario Used Throughout This Document

The Centific Bid Management Platform is a CentificAI Aegis-themed virtual desktop hosting a single business application: **Bid Management**. A Bid Manager and Bid Director collaborate through the platform to ingest upstream RFP inputs, compile a bid, run Human-in-the-Loop (HIL) approval, and submit. Every screen is real and connected to a live FastAPI backend backed by Aiven PostgreSQL.

| Area                       | Value                                                                          |
|----------------------------|--------------------------------------------------------------------------------|
| Web application            | Centific Bid Management Platform                                               |
| Purpose                    | Compile, HIL-approve, and submit RFP responses through a 6-stage workflow     |
| Main desktop URL           | `http://localhost:5173/`                                                       |
| Backend API                | `http://localhost:8000/api/...`                                                |
| Viewport baseline          | 1440 × 900 browser viewport, 100% zoom                                         |
| Coordinate origin          | Top-left of browser viewport (taskbar bottom edge at y=900, taskbar height 56px) |
| Primary business flow      | Manager confirms compilation → bid auto-builds → Director runs HIL → Manager submits → outcome recorded |
| Primary audience           | Bid Operations team (humanoid demos walk-through to executive observers)       |

**Two-role interaction.** All flows involve handoffs between Manager and Director. Switch roles via the avatar dropdown bottom-left of the Bid Management app window. Frontend sends `X-User-Role: director|manager` on every API call; backend rejects role-mismatched actions with HTTP 403.

---

## 2. Complete Flow Identification

| Field                  | Required | Description                              | Filled Example                                                  |
|------------------------|----------|------------------------------------------|------------------------------------------------------------------|
| `flow_id`              | Yes      | Unique ID for the complete journey       | `FLOW-BID-LIFECYCLE-001`                                         |
| `flow_name`            | Yes      | Human-readable name                      | End-to-end bid lifecycle (RFP → submission)                      |
| `flow_version`         | Yes      | Version used by AI runtime               | 1.0                                                              |
| `parent_flow_id`       | No       | If child flow                            | None                                                             |
| `business_goal`        | Yes      | Why the user wants the flow performed    | Demonstrate that an RFP can be compiled into a bid, HIL-approved, and submitted within a single session, with full audit trail |
| `persona`              | Yes      | Role being simulated                     | Senior Bid Operations Specialist                                 |
| `trigger_utterance`    | Yes      | Command that starts the flow             | "Walk me through how a new bid is created and approved end-to-end." |
| `entry_screen_id`      | Yes      | First screen                             | `SCR-002-DESKTOP`                                                |
| `expected_end_screen_id` | Yes    | Final screen                             | `SCR-007-AUDIT-LOG`                                              |
| `narration_mode`       | Yes      | Verbosity level                          | Detailed guided walkthrough                                      |
| `evidence_required`    | Yes      | Screenshots required?                    | Yes — screenshot at each major screen + final audit CSV          |

---

## 3. Required Runtime Parameters

| Parameter           | Required | Type    | Example                              | How AI Uses It                                              |
|---------------------|----------|---------|--------------------------------------|-------------------------------------------------------------|
| `session_id`        | Yes      | String  | `BID-DEMO-SESSION-7781`              | Correlates all actions, screenshots, audit entries          |
| `manager_user`      | Yes      | Object  | `{id:"manager", name:"Arjun Kapoor"}`| Role switcher target for Manager actions                    |
| `director_user`     | Yes      | Object  | `{id:"director", name:"Priya Menon"}`| Role switcher target for Director actions                   |
| `target_rfp_id`     | Yes      | String  | `RFP-001`                            | RFP whose inputs to compile                                 |
| `target_bid_ref`    | Yes      | String  | `BID-2026-041`                       | Bid to drive through HIL approval                           |
| `co_approval_threshold_gbp` | Yes | Number | `1000000`                          | When bid value > this OR ≥2 high risks → co-approval flow   |
| `viewport_width`    | Yes      | Number  | `1440`                               | Coordinate region map basis                                 |
| `viewport_height`   | Yes      | Number  | `900`                                | Coordinate region map basis                                 |
| `speaker_style`     | Yes      | Enum    | `Professional, concise, business-tone` | Narration mode                                            |
| `poll_assumptions`  | Yes      | Object  | `{useBids:10s, useBidDetail:5s, audit:8s}` | Reference for "wait" timing on dynamic data            |

---

## 4. UI/UX Screen Inventory: Where the Humanoid Goes

| Screen ID            | Screen / Page Name              | URL or Route within app                  | Purpose                                      | Primary Regions                                       | Expected Visible Evidence                                 |
|----------------------|----------------------------------|------------------------------------------|----------------------------------------------|--------------------------------------------------------|-----------------------------------------------------------|
| `SCR-002-DESKTOP`    | Virtual Desktop Home             | `/` (page load)                          | Wallpaper, app icons, widgets, taskbar       | Desktop area, widgets column, taskbar                  | "Bid Management" desktop icon, "Bid Management · Today" widget, "Notifications" widget, taskbar with file/word/ppt/excel/bid icons |
| `SCR-100-APPSHELL`   | Bid Management App Shell         | window opened from desktop               | Window with sidenav + main + commentary aside | Title bar, sidenav (left, 56px), main content, aside (right, 300px) | Sidenav icons (Dashboard, Pipeline, HIL/Co-review, etc.), Live Commentary panel on right |
| `SCR-101-DASHBOARD`  | Dashboard                        | sidenav tab `dashboard`                  | KPIs, charts, "My Queue" preview              | Page banner, KPI grid (4), charts grid, "My Queue" table | "HIL Approval Queue" or "Compilation Pipeline" title, 4 KPI cards |
| `SCR-102-INPUTS`     | Input Validation Dashboard (Mgr) | sidenav tab `inputs`                     | Per-RFP × 8 input categories status           | Page banner, per-RFP card with table                   | Status badges (Received/Missing/Malformed), "Confirm Compilation" button, "Inputs Ready" / "Awaiting Inputs" badge |
| `SCR-103-COMPILE`    | Compilation View (Mgr)           | sidenav tab `compilation`                | Live telemetry of compiling bid, 8 sections   | Page banner, telemetry card (4 metrics), 8 section cards | "Bid Compilation · BID-XXX", elapsed/sources/confidence/flags, "Route to Director" button |
| `SCR-104-PIPELINE`   | Bid Pipeline                     | sidenav tab `pipeline`                   | All bids across 6 stages                      | Page banner, overdue banner (conditional), stage tiles (6), bids table | Stage filter tiles, table with Last Action and Outcome columns, Export button |
| `SCR-105-HIL-QUEUE`  | HIL Approval Queue (Dir)         | sidenav tab `hil`                        | Pending bids awaiting Director review         | Page banner, SLA card, queue cards                     | "Interactive HIL Approval · N awaiting", per-bid card with "Review & approve" button |
| `SCR-106-BID-DETAIL` | Bid Detail (HIL Approval Interface) | clicking any bid → opens detail view  | Section-by-section approval workspace         | Detail header, approval progress strip, section tabs, section content | 8 section tabs, "Sign-off" button (Dir), "Confirm & submit" (Mgr), "View bid document" |
| `SCR-107-PRICING`    | Pricing Review Panel (Dir)       | sidenav tab `pricing`                    | Per-line pricing override workspace           | Page banner, missing-rate banner, 3 KPI cards, line table | "Edit margin" per line, "Set rate" for missing rate, totals row |
| `SCR-108-RISK`       | Risk Panel (Dir)                 | sidenav tab `risk`                       | Risk register for the focused bid             | Severity counts (3), risk register table              | High/Medium/Low cards, "Ack BR-005" button per High risk |
| `SCR-109-REPORTS`    | Reports R-01 to R-06             | sidenav tab `reports`                    | 6 analytics reports, click to expand          | 6 report cards (3×2 grid), active report detail below  | "R-01" through "R-06" cards, "Export CSV" per active report |
| `SCR-110-AUDIT`      | Audit Log                        | sidenav tab `audit`                      | Append-only event log                         | Page banner, search + filter pills, date/user filter, table | Search, filter pills with counts, From/To date pickers, User select, Download CSV |
| `SCR-200-MARGIN-MODAL` | Margin Override Modal          | overlay (Pricing tab in BidDetail or per-line in PricingPanel) | Confirm margin change | Modal centred (480px), title, body text, Cancel/Confirm buttons | "Confirm margin override from X% to Y% on [Task]" |
| `SCR-201-MISSINGRATE-MODAL` | Set Missing Rate Modal     | overlay (PricingPanel)                   | Resolve missing rate-card entry              | Modal centred, role/task labels, rate input, Cancel/Confirm | "Set missing rate" header, numeric input |
| `SCR-202-DOC-MODAL`  | Bid Document Modal              | overlay (BidDetail "View bid document")  | Render the compiled bid document via template | Full-screen modal (90% × 88%), iframe with rendered HTML, Download / Close | "Final compiled bid document — BID-XXX", iframe content |

---

## 5. Screen Layout Region Map

Coordinates assume 1440×900 browser viewport, app window centred (default opens at 130×70, size 1180×760).

| Region ID            | Applies To                  | Pixel Bounds (x1,y1,x2,y2) | Description                                | Example AI Instruction                              |
|----------------------|-----------------------------|------------------------------|--------------------------------------------|------------------------------------------------------|
| `REG-DESKTOP`        | Desktop home                | 0,0,1060,844                | Wallpaper area with desktop icons          | Look for "Bid Management" icon at left side          |
| `REG-WIDGETS`        | Desktop home (right column) | 1060,32,1408,768            | Widget column (Bid Management · Today, Notifications) | Read counts shown on widgets to pre-summarise state |
| `REG-TASKBAR`        | Desktop home                | 0,844,1440,900              | Bottom taskbar with app icons + tray clock | Use to relaunch Bid Management if window closed      |
| `REG-WINDOW-CHROME`  | Bid Management window       | 130,70,1310,108             | Title bar with grip + window controls      | Drag from grip; close via × control                   |
| `REG-SIDENAV`        | Bid Management app          | 130,108,186,830             | Left sidenav (56px wide), icon-only        | Hover to show tooltip; click to switch tab           |
| `REG-MAIN`           | Bid Management app          | 186,108,1010,830            | Main content area (824 × 722)              | Read banner + page-specific content                  |
| `REG-ASIDE`          | Bid Management app          | 1010,108,1310,830           | Live Commentary aside (300 × 722)          | Read live audit events here                          |
| `REG-PAGE-BANNER`    | Most pages in `REG-MAIN`    | 186,108,1010,170            | Gradient banner with title, subtitle, actions | Confirm correct page from banner title             |
| `REG-MODAL-CENTER`   | Any modal                   | 480,260,960,640             | Standard 480px-wide modal                  | Read title, body, click Cancel or Confirm            |
| `REG-DOC-MODAL`      | Bid document overlay        | 70,80,1370,820              | Full-screen iframe overlay                 | Read rendered HTML; click Download HTML              |
| `REG-AVATAR-MENU`    | Sidenav bottom              | 130,720,420,820             | User switcher dropdown                     | Click avatar → role list                             |
| `REG-COMMENTARY-FEED`| `REG-ASIDE`                 | 1010,170,1310,790           | Scrolling feed of audit events             | Read event list; auto-scrolls on new entry           |

---

## 6. Element Target Registry

The agent **must prefer text-based and class-based selectors** since `data-testid` and `aria-label` are not used. Coordinates are fallbacks. Always validate visibility (element in viewport, not covered by modal) before action.

| Element ID | Screen ID            | Element Name                | Type        | Selector / Locator                                              | Fallback Location                | Required Action               |
|------------|----------------------|------------------------------|-------------|-------------------------------------------------------------------|------------------------------------|--------------------------------|
| `EL-001`   | `SCR-002-DESKTOP`    | Bid Management desktop icon  | Icon        | `.desktop-icon` containing `.desktop-icon-label:text("Bid Management")` | x=80 y=180 (region `REG-DESKTOP`) | Click to open the window |
| `EL-002`   | `SCR-002-DESKTOP`    | Bid Management taskbar icon  | Button      | `.taskbar-app.bid-app`                                          | x=985 y=872 (region `REG-TASKBAR`) | Click (focuses if open, else launches) |
| `EL-003`   | `SCR-002-DESKTOP`    | "Open Bid Management" widget button | Button | `.widget button:has-text("Open Bid Management")`                | x=1130 y=290 (region `REG-WIDGETS`) | Click to open via widget |
| `EL-004`   | `SCR-100-APPSHELL`   | Window close                 | Button      | `.window-control.close`                                         | x=1295 y=84 (region `REG-WINDOW-CHROME`) | Click to close window |
| `EL-005`   | `SCR-100-APPSHELL`   | Window maximize              | Button      | `.window-control` with title containing "Maximize"              | x=1265 y=84                       | Click |
| `EL-006`   | `SCR-100-APPSHELL`   | Sidenav: Dashboard tab       | Button      | `.app-sidenav-btn[title="Dashboard"]`                           | x=158 y=140                       | Click |
| `EL-007`   | `SCR-100-APPSHELL`   | Sidenav: Pipeline tab        | Button      | `.app-sidenav-btn[title="Pipeline"]`                            | x=158 y=184                       | Click |
| `EL-008-D` | `SCR-100-APPSHELL`   | Sidenav: HIL Approval (Dir)  | Button      | `.app-sidenav-btn[title="HIL Approval"]`                        | x=158 y=228                       | Click. Director-only label. |
| `EL-008-M` | `SCR-100-APPSHELL`   | Sidenav: Co-review (Mgr)     | Button      | `.app-sidenav-btn[title="Co-review"]`                           | x=158 y=316                       | Click. Manager-only label. |
| `EL-009-D` | `SCR-100-APPSHELL`   | Sidenav: Pricing Panel       | Button      | `.app-sidenav-btn[title="Pricing Panel"]`                       | x=158 y=272                       | Click. Director-only. |
| `EL-010-D` | `SCR-100-APPSHELL`   | Sidenav: Risk Panel          | Button      | `.app-sidenav-btn[title="Risk Panel"]`                          | x=158 y=316                       | Click. Director-only. |
| `EL-011-M` | `SCR-100-APPSHELL`   | Sidenav: Input Validation    | Button      | `.app-sidenav-btn[title="Input Validation"]`                    | x=158 y=184                       | Click. Manager-only. |
| `EL-012-M` | `SCR-100-APPSHELL`   | Sidenav: Compilation         | Button      | `.app-sidenav-btn[title="Compilation"]`                         | x=158 y=228                       | Click. Manager-only. |
| `EL-013`   | `SCR-100-APPSHELL`   | Sidenav: Reports             | Button      | `.app-sidenav-btn[title="Reports"]`                             | x=158 y=360                       | Click |
| `EL-014`   | `SCR-100-APPSHELL`   | Sidenav: Audit Log           | Button      | `.app-sidenav-btn[title="Audit Log"]`                           | x=158 y=404                       | Click |
| `EL-015`   | `SCR-100-APPSHELL`   | Avatar / User switcher       | Button      | bottom of `.app-sidenav` — last `.app-sidenav-btn` containing `.user-avatar` | x=158 y=790 | Click to open menu |
| `EL-016`   | `SCR-100-APPSHELL`   | Switch to Bid Manager        | List item   | `.user-option:has-text("Arjun Kapoor")`                         | x=300 y=750                       | Click after avatar opens menu |
| `EL-017`   | `SCR-100-APPSHELL`   | Switch to Bid Director       | List item   | `.user-option:has-text("Priya Menon")`                          | x=300 y=720                       | Click after avatar opens menu |
| `EL-101`   | `SCR-101-DASHBOARD`  | Banner "View pipeline"       | Button      | `.page-banner button:has-text("View pipeline")`                 | x=830 y=128                       | Click |
| `EL-102`   | `SCR-101-DASHBOARD`  | Banner "Open HIL queue" / "New compilation" | Button | `.page-banner-btn.primary` (text varies by role)                | x=945 y=128                       | Click |
| `EL-103`   | `SCR-101-DASHBOARD`  | "View all bids" link         | Button      | `button:has-text("View all bids")` in My Queue card             | x=930 y=540                       | Click |
| `EL-201`   | `SCR-102-INPUTS`     | "Confirm Compilation" button | Button      | per-RFP card, `button:has-text("Confirm Compilation")`          | per-RFP, right of card header     | Click. Manager-only. |
| `EL-202`   | `SCR-102-INPUTS`     | "Request Missing Data" button| Button      | per-row Action column, `button:has-text("Request Missing Data")`| right of each Missing/Malformed row | Click |
| `EL-301`   | `SCR-103-COMPILE`    | "Open bid" button            | Button      | `.page-banner button:has-text("Open bid")`                      | x=830 y=128                       | Click |
| `EL-302`   | `SCR-103-COMPILE`    | "Route to Director" button   | Button      | `.page-banner-btn.primary:has-text("Route to Director")`        | x=945 y=128                       | Click. Manager-only. Disabled until 8/8 sections present. |
| `EL-401`   | `SCR-104-PIPELINE`   | Stage tile                   | Button      | `.stage-tile:has-text("Pending Approval")` etc                  | x=200..950 y=200                  | Click to filter |
| `EL-402`   | `SCR-104-PIPELINE`   | Bid row                      | Row         | `.data-table tbody tr` containing target bid ID                 | tabular position                   | Click row to open BidDetail |
| `EL-403`   | `SCR-104-PIPELINE`   | Banner "Export"              | Button      | `.page-banner button:has-text("Export")`                        | x=945 y=128                       | Click → CSV download |
| `EL-501`   | `SCR-105-HIL-QUEUE`  | Per-bid card                 | Card        | `.card[onclick]` containing target bid ID                       | tabular                            | Click anywhere on card |
| `EL-601`   | `SCR-106-BID-DETAIL` | Section tab                  | Button      | `.section-tab:has-text("Pricing")` etc.                          | x=200..960 y=300                  | Click to switch section |
| `EL-602`   | `SCR-106-BID-DETAIL` | "Approve section" button     | Button      | `.btn.btn-success:has-text("Approve section")`                   | section card header right          | Click. Director-only. |
| `EL-603`   | `SCR-106-BID-DETAIL` | "Reject & return" button     | Button      | `.btn.btn-outline:has-text("Reject & return")`                  | section card header right          | Click. Director-only. |
| `EL-604`   | `SCR-106-BID-DETAIL` | Margin slider                | Range input | `input[type="range"]` in Pricing tab                            | x=540 y=480                       | Drag. Director-only. |
| `EL-605`   | `SCR-106-BID-DETAIL` | "Apply override" button      | Button      | `.btn.btn-primary.btn-sm:has-text("Apply override")`            | x=920 y=480                       | Click → opens `SCR-200-MARGIN-MODAL` |
| `EL-606`   | `SCR-106-BID-DETAIL` | Per-risk "ack" button (High) | Button      | `tr` containing risk_ref → `.btn:has-text("ack")`                | last cell                          | Click. Director-only. |
| `EL-607`   | `SCR-106-BID-DETAIL` | "Sign-off" button            | Button      | `.btn.btn-success:has-text("Sign-off & route to Manager")`      | x=820 y=185                       | Click. Director-only, requires 8/8 approvals + co-approval if triggered |
| `EL-608`   | `SCR-106-BID-DETAIL` | "Manager co-approve" button  | Button      | `.btn.btn-primary:has-text("Manager co-approve")`               | inside co-approval banner          | Click. Manager-only. |
| `EL-609`   | `SCR-106-BID-DETAIL` | "Confirm & submit" button    | Button      | `.btn.btn-success:has-text("Confirm & submit")`                 | x=820 y=185                       | Click. Manager-only, only when stage = approved |
| `EL-610`   | `SCR-106-BID-DETAIL` | "View bid document" button   | Button      | `.btn.btn-outline:has-text("View bid document")`                | x=620 y=185                       | Click → opens `SCR-202-DOC-MODAL` |
| `EL-611`   | `SCR-106-BID-DETAIL` | EditableField "edit" link    | Button      | within section content, `button:has-text("edit")` next to value | inline                             | Click → input + save/cancel buttons appear |
| `EL-612`   | `SCR-106-BID-DETAIL` | Save edit                    | Button      | `button.btn-success.btn-sm:has-text("save")` (lowercase)        | next to inline input               | Click after typing new value |
| `EL-701`   | `SCR-107-PRICING`    | Per-line "Edit margin"       | Button      | `.data-table tbody tr` → `button:has-text("Edit margin")`       | last cell of pricing line          | Click. Director-only. |
| `EL-702`   | `SCR-107-PRICING`    | Inline margin input          | Number input| `input[type="number"]` after Edit margin clicked                | last cell                          | Type new value |
| `EL-703`   | `SCR-107-PRICING`    | "Confirm" button per line    | Button      | `.btn.btn-success:has-text("Confirm")`                          | next to inline input               | Click → opens `SCR-200-MARGIN-MODAL` |
| `EL-704`   | `SCR-107-PRICING`    | "Set rate" (missing rate)    | Button      | `button:has-text("Set rate")`                                   | row with red Missing Rate badge    | Click → opens `SCR-201-MISSINGRATE-MODAL` |
| `EL-801`   | `SCR-108-RISK`       | "Ack BR-005" button          | Button      | `tr` containing risk_ref → `button:has-text("Ack BR-005")`      | last cell                          | Click. Director-only. |
| `EL-901`   | `SCR-109-REPORTS`    | Report card                  | Card        | `.card` containing report id e.g. "R-02"                        | grid position                      | Click to make active and render below |
| `EL-902`   | `SCR-109-REPORTS`    | Active report "Export CSV"   | Button      | `.btn-outline:has-text("Export CSV")` in active report shell    | top-right of detail card           | Click → CSV download |
| `EL-A01`   | `SCR-110-AUDIT`      | Search input                 | Text input  | `.toolbar-search input`                                         | x=240 y=180                       | Type filter text |
| `EL-A02`   | `SCR-110-AUDIT`      | Filter pill                  | Button      | `.filter-pill:has-text("Approved")` (or "Edited", "Rejected", etc.) | toolbar                          | Click to filter |
| `EL-A03`   | `SCR-110-AUDIT`      | From-date picker             | Date input  | `input[type="date"]` first occurrence in toolbar card           | x=300 y=240                       | Type or pick date |
| `EL-A04`   | `SCR-110-AUDIT`      | User filter                  | Select      | `select` in toolbar card                                        | x=620 y=240                       | Choose option |
| `EL-A05`   | `SCR-110-AUDIT`      | "Download CSV"               | Button      | `.page-banner button:has-text("Download CSV")`                  | x=920 y=130                       | Click → CSV download |
| `EL-A06`   | `SCR-110-AUDIT`      | "Clear filters"              | Button      | `button:has-text("Clear filters")`                              | toolbar card right                 | Click |
| `EL-M01`   | `SCR-200-MARGIN-MODAL` | Modal "Confirm override"   | Button      | `.btn.btn-primary:has-text("Confirm override")`                 | modal bottom-right                 | Click |
| `EL-M02`   | `SCR-200-MARGIN-MODAL` | Modal "Cancel"             | Button      | `.btn.btn-outline:has-text("Cancel")`                           | modal bottom-right                 | Click |
| `EL-M03`   | `SCR-201-MISSINGRATE-MODAL` | Rate input            | Number      | modal `input[type="number"]`                                    | modal centre                        | Type rate |
| `EL-M04`   | `SCR-202-DOC-MODAL`  | "Download HTML"              | Button      | `.btn.btn-outline.btn-sm:has-text("Download HTML")`             | modal header right                  | Click → HTML file download |
| `EL-M05`   | `SCR-202-DOC-MODAL`  | Close ×                      | Button      | `.btn.btn-ghost.btn-sm:has-text("✕")`                            | modal header far-right              | Click |

---

## 7. Standard AI Action Record Template

```json
{
  "action_id": "ACT-###",
  "screen_id": "SCR-###",
  "action_type": "click | type | select | hover | scroll | switch_role | open_artifact | wait_for_state | explain_screen | validate | recover",
  "target": {
    "element_id": "EL-###",
    "selector": "preferred stable locator",
    "fallback_region": "REG-...",
    "fallback_coordinates": {"x": 0, "y": 0}
  },
  "input_parameters": {},
  "preconditions": [],
  "execution_steps": [],
  "expected_response": {},
  "validation_rules": [],
  "humanoid_speaker_notes": {
    "before_action": "",
    "during_action": "",
    "after_action": ""
  },
  "failure_recovery": []
}
```

---

## 8. Detailed Examples for All Action Types

| Action ID | Action Type             | Category         | Screen                | Exact Example                                                    | Parameters                  | Validation                                       | Humanoid Speaker Note |
|-----------|--------------------------|------------------|-----------------------|-------------------------------------------------------------------|-----------------------------|---------------------------------------------------|------------------------|
| ACT-001   | Open URL / launch        | Browser nav      | `SCR-002-DESKTOP`     | Navigate to `http://localhost:5173/`                              | `application_url`           | Wallpaper visible, "Bid Management" icon detected | "I will open the Centific Bid Management desktop." |
| ACT-002   | Click desktop icon        | Mouse click      | `SCR-002-DESKTOP`     | Click `EL-001` (Bid Management icon)                              | none                        | Window appears with title "Bid Management"        | "I will launch the Bid Management application." |
| ACT-003   | Switch role              | Custom           | `SCR-100-APPSHELL`    | Click `EL-015` then `EL-016` (Manager) or `EL-017` (Director)    | `target_role`               | Avatar initials change (PM ↔ AK), sidenav tabs swap | "I will switch to the [Bid Manager/Bid Director] role to perform the next action." |
| ACT-004   | Click sidenav tab        | Mouse click      | `SCR-100-APPSHELL`    | Click `EL-006` Dashboard / `EL-007` Pipeline / etc.              | `target_tab`                | Page banner title matches expected page           | "I am navigating to the [page] tab." |
| ACT-005   | Confirm Compilation       | Mouse click      | `SCR-102-INPUTS`      | Click `EL-201` for the target RFP                                | `rfp_id`                    | Toast appears: "Compilation triggered → BID-XXX created (stage: compiling)"; new bid appears in Pipeline within 10s | "All eight inputs are received for this RFP. I will confirm compilation now to start the bid build." |
| ACT-006   | Wait for compilation       | Wait state       | `SCR-103-COMPILE`     | Stay on Compilation tab; wait for telemetry sources_merged = 8/8 | `bid_ref`, `timeout_s=30`   | Telemetry shows 8/8 within 30 seconds              | "The system is compiling the eight sections. I will wait until all sources are merged." |
| ACT-007   | Route to Director        | Mouse click      | `SCR-103-COMPILE`     | Click `EL-302`                                                    | `bid_ref`                   | Toast: "BID-XXX routed to Director"; bid stage transitions `compiling → pending` | "Compilation is complete. I will route this bid to the Director for HIL approval." |
| ACT-008   | Open bid from queue       | Mouse click      | `SCR-105-HIL-QUEUE`   | Click `EL-501` for target bid card                                | `bid_ref`                   | URL changes to BidDetail; 8 section pills visible | "I will open the bid in the HIL queue to begin the section review." |
| ACT-009   | Click section tab        | Mouse click      | `SCR-106-BID-DETAIL`  | Click `EL-601` for `pricing` section                              | `section_key`               | Tab becomes active; section content rendered     | "I will start with the Pricing section." |
| ACT-010   | Adjust margin slider      | Drag             | `SCR-106-BID-DETAIL`  | Drag `EL-604` from current to new value                          | `new_margin_pct`            | Slider value changes; "Apply override" enables   | "I am adjusting the margin to test the override workflow." |
| ACT-011   | Apply margin override    | Mouse click      | `SCR-106-BID-DETAIL`  | Click `EL-605`                                                   | none                        | Modal `SCR-200` appears                           | "The margin needs explicit confirmation per BR-003. I will apply the override." |
| ACT-012   | Confirm modal            | Modal decision   | `SCR-200-MARGIN-MODAL`| Read modal text; click `EL-M01`                                  | `from_pct`, `to_pct`        | Modal closes; toast: "Margin override applied"; audit log gets Edited entry | "I have read the override summary and will confirm." |
| ACT-013   | Approve section          | Mouse click      | `SCR-106-BID-DETAIL`  | Click `EL-602`                                                   | `section_key`               | Section pill turns green ✓; sections_complete +1 | "Pricing review is complete. I will approve this section." |
| ACT-014   | Acknowledge High risk     | Mouse click      | `SCR-106-BID-DETAIL`  | On Risks tab, click `EL-606` for each High risk                  | `risk_ref`                  | Row badge becomes "✓ ack"; Risk Register Approve enables only when all High acked | "BR-005 requires explicit acknowledgement for high-severity risks before this section can be approved." |
| ACT-015   | Edit and approve (atomic) | Click + type     | `SCR-106-BID-DETAIL`  | Click `EL-611` "edit" → type new value → click `EL-612` "save" → click `EL-602` Approve | `field_key`, `new_value` | Audit log records `Edited+Approved` with original/revised values | "I will correct this field, then approve the section. Both actions are captured in the audit log." |
| ACT-016   | Director sign-off         | Mouse click      | `SCR-106-BID-DETAIL`  | Click `EL-607`                                                   | `bid_ref`                   | Stage `pending → approved`; Manager-side sees Confirm & submit | "All eight sections are approved. I will sign off and route the bid back to the Manager for submission." |
| ACT-017   | Manager co-approve        | Mouse click      | `SCR-106-BID-DETAIL`  | Click `EL-608` (banner appears when value > £1M OR ≥2 high risks)| `bid_ref`                   | Banner turns green; Director's Sign-off enables   | "Co-approval is required because the bid value exceeds the threshold or two High risks are present." |
| ACT-018   | Submit bid                | Mouse click      | `SCR-106-BID-DETAIL`  | Click `EL-609`                                                   | `bid_ref`                   | Stage `approved → submitted`; "Submitted" badge appears | "I will submit the approved bid to the client portal now." |
| ACT-019   | View bid document         | Mouse click      | `SCR-106-BID-DETAIL`  | Click `EL-610`                                                   | `bid_ref`                   | `SCR-202-DOC-MODAL` opens with rendered HTML iframe | "I will render the final compiled bid document using the standard template." |
| ACT-020   | Per-line margin override  | Multi-step       | `SCR-107-PRICING`     | Click `EL-701` → type into `EL-702` → click `EL-703` → confirm `EL-M01` | `line_no`, `new_margin_pct` | Audit gets Edited entry; line total recalculates | "I will override the margin on this single line and confirm." |
| ACT-021   | Resolve missing rate       | Multi-step       | `SCR-107-PRICING`     | Click `EL-704` → type into `EL-M03` → click `EL-M01`             | `line_no`, `rate`           | Red "Missing Rate" badge replaced with rate value; audit Edited | "The rate card is missing this entry. I will resolve it before approving Pricing." |
| ACT-022   | Filter audit log          | Type + click     | `SCR-110-AUDIT`       | Type bid_ref into `EL-A01` and/or click `EL-A02` action pill     | `search_text`, `action_type`| Table rows filter accordingly                     | "I am narrowing the audit log to the relevant entries." |
| ACT-023   | Download audit CSV        | Mouse click      | `SCR-110-AUDIT`       | Click `EL-A05`                                                   | none                        | File download starts                              | "I will export the filtered audit log as a CSV." |
| ACT-024   | Capture evidence          | Observability    | Any                   | Take screenshot `screen_id_<seq>.png`                            | `evidence_policy`           | File saved to evidence store                      | "I will capture this screen as evidence." |
| ACT-025   | Recover from missing      | Error handling   | Any                   | If selector fails, fall back to coordinate; if still fails, navigate via sidenav and retry | `element_id`              | Recovered or fail recorded                        | "I cannot find the expected control. I will use the alternate path." |
| ACT-026   | Wait for poll             | Wait state       | Any                   | Wait up to N seconds for polled data refresh                    | `data_source`, `timeout_s`  | Expected value appears in DOM                      | "Data refreshes every 5–10 seconds. I will wait for the latest state." |
| ACT-027   | Final spoken summary      | Narration        | `SCR-110-AUDIT`       | Summarise screens visited, actions taken, bid state              | `summary_style`             | Narration transcript captured                     | "We took the bid through compilation, HIL approval, and submission. The audit log records every action." |

---

## 9. Complete Example Flow: End-to-end Bid Lifecycle

**Trigger utterance:** *"Walk me through how a new bid is created and approved end-to-end."*

| Seq | Action ID | Screen From → To                              | Humanoid Does This                                | UI Target / Location                              | Expected Response                                          | Speaker Notes While Performing |
|-----|-----------|-----------------------------------------------|---------------------------------------------------|----------------------------------------------------|------------------------------------------------------------|---------------------------------|
| 1   | ACT-001   | Browser → `SCR-002-DESKTOP`                  | Open `http://localhost:5173/`                     | Address bar                                        | Desktop with wallpaper + Bid Management icon visible       | I will open the Centific Bid Management workspace. |
| 2   | ACT-002   | `SCR-002-DESKTOP` → `SCR-100-APPSHELL`       | Click Bid Management desktop icon                 | `EL-001`                                           | Window opens with sidenav, main, aside                    | I will launch the application. |
| 3   | ACT-003   | `SCR-100-APPSHELL`                            | Switch to Bid Manager                              | Avatar `EL-015` → `EL-016`                         | Avatar shows "AK"; sidenav tabs include Input Validation + Compilation | I am switching to the Bid Manager role to start the workflow. |
| 4   | ACT-004   | → `SCR-102-INPUTS`                           | Click sidenav "Input Validation"                  | `EL-011-M`                                         | Input Validation Dashboard renders with one or more RFPs   | I will check the upstream input status before starting compilation. |
| 5   | ACT-024   | `SCR-102-INPUTS`                             | Capture screenshot                                 | —                                                  | Evidence stored                                            | I will capture the input status as evidence. |
| 6   | ACT-005   | `SCR-102-INPUTS`                             | Click Confirm Compilation for the target RFP      | `EL-201`                                           | Toast appears, new bid created with stage = compiling      | All eight inputs are received. I will confirm compilation. |
| 7   | ACT-004   | → `SCR-103-COMPILE`                          | Click sidenav "Compilation"                       | `EL-012-M`                                         | Compilation View shows live telemetry + 8 sections building | I will watch the compilation pipeline. |
| 8   | ACT-006   | `SCR-103-COMPILE`                            | Wait until 8/8 sections present                    | Telemetry "Sources merged" cell                    | "8 / 8" within ~24s                                        | Each section is being assembled from upstream module data. |
| 9   | ACT-007   | `SCR-103-COMPILE` → Pipeline (background)    | Click Route to Director                            | `EL-302`                                           | Toast confirms; bid stage now `pending`                    | Compilation is complete. I will route to the Director. |
| 10  | ACT-003   | `SCR-100-APPSHELL`                            | Switch to Bid Director                             | Avatar `EL-015` → `EL-017`                         | Avatar shows "PM"; sidenav swaps to Director-only tabs    | Now I will switch to the Director to perform HIL approval. |
| 11  | ACT-004   | → `SCR-105-HIL-QUEUE`                        | Click sidenav "HIL Approval"                      | `EL-008-D`                                         | HIL Queue card list with the routed bid at top            | I will open the HIL queue. |
| 12  | ACT-008   | `SCR-105-HIL-QUEUE` → `SCR-106-BID-DETAIL`  | Click target bid card                              | `EL-501`                                           | Bid Detail with 8 section pills (mostly Pending)          | I will open the bid for section-by-section review. |
| 13  | ACT-009   | `SCR-106-BID-DETAIL`                         | Click Pricing section tab                          | `EL-601` Pricing                                   | Pricing content + margin slider rendered                  | I will start with Pricing. |
| 14  | ACT-010   | `SCR-106-BID-DETAIL`                         | Adjust margin slider                               | `EL-604` to e.g. 26                                 | Pending value displays in slider                          | I will increase the margin to better reflect risk. |
| 15  | ACT-011   | `SCR-106-BID-DETAIL` → `SCR-200-MARGIN-MODAL`| Click Apply override                               | `EL-605`                                           | Modal opens                                                | A second confirmation is required per BR-003. |
| 16  | ACT-012   | `SCR-200-MARGIN-MODAL` → `SCR-106-BID-DETAIL`| Click Confirm override                             | `EL-M01`                                           | Modal closes; toast; audit gets Edited entry              | I will confirm. |
| 17  | ACT-013   | `SCR-106-BID-DETAIL`                         | Click Approve section                              | `EL-602`                                           | Pricing pill turns green ✓                                 | Pricing is approved. |
| 18  | ACT-009   | `SCR-106-BID-DETAIL`                         | Switch to Risks section tab                        | `EL-601` Risks                                     | Risk Register table renders                                | I will move to the Risk Register. |
| 19  | ACT-014   | `SCR-106-BID-DETAIL`                         | Click ack on each High risk                         | `EL-606` for each row                              | Row badge becomes "✓ ack"; Approve enables when all High acked | BR-005 requires acknowledgement of every High-severity risk. |
| 20  | ACT-013   | `SCR-106-BID-DETAIL`                         | Approve Risks section                              | `EL-602`                                           | Risks pill turns green                                     | Risks are approved. |
| 21  | ACT-009 + ACT-013 (×6) | `SCR-106-BID-DETAIL`           | Iterate remaining 6 sections (Effort, Schedule, Quality, Deliverables, Dependencies, Acceptance), Approve each | `EL-601` per section + `EL-602` | Each pill turns green; sections_complete reaches 8/8 | Each section requires an explicit Approve action — no batch approve. |
| 22  | ACT-017   | `SCR-106-BID-DETAIL`                         | If banner shows: switch to Manager, click Manager co-approve | `EL-015→EL-016`, `EL-608` | Banner turns green; switch back to Director               | The bid value or risk count triggers co-approval. |
| 23  | ACT-016   | `SCR-106-BID-DETAIL`                         | Click Sign-off                                     | `EL-607`                                           | Stage `pending → approved`                                 | All sections signed off. Routing back to Manager. |
| 24  | ACT-019   | `SCR-106-BID-DETAIL` → `SCR-202-DOC-MODAL`   | Click View bid document                            | `EL-610`                                           | Iframe loads rendered HTML document                       | I will render the final compiled document using the template. |
| 25  | ACT-024   | `SCR-202-DOC-MODAL`                          | Capture screenshot                                 | —                                                  | Evidence stored                                            | I will capture the rendered document. |
| 26  | ACT-003   | `SCR-100-APPSHELL`                            | Switch to Bid Manager                              | `EL-015` → `EL-016`                                | Avatar shows "AK"                                          | Switching back to Manager for submission. |
| 27  | ACT-018   | `SCR-106-BID-DETAIL`                         | Click Confirm & submit                              | `EL-609`                                           | Stage `approved → submitted`; "Submitted" badge            | I will confirm submission. |
| 28  | ACT-004   | → `SCR-110-AUDIT`                            | Click sidenav "Audit Log"                          | `EL-014`                                           | Audit log table with all our actions in chronological order| I will open the audit trail. |
| 29  | ACT-022   | `SCR-110-AUDIT`                              | Filter to current bid_ref                          | `EL-A01`                                           | Table filters to bid-specific events                       | Filtering to this bid's events. |
| 30  | ACT-023   | `SCR-110-AUDIT`                              | Click Download CSV                                 | `EL-A05`                                           | CSV file downloads                                         | I will export the audit trail. |
| 31  | ACT-027   | `SCR-110-AUDIT`                              | Final summary                                      | —                                                  | Spoken transcript                                          | We compiled a fresh bid from upstream inputs, ran HIL approval, applied a margin override and high-risk acknowledgements, and submitted it. The audit log captures every action. |

---

## 10. Detailed Page Example: Virtual Desktop Home (`SCR-002-DESKTOP`)

| Item                       | Detail                                                                 |
|----------------------------|------------------------------------------------------------------------|
| `screen_id`                | `SCR-002-DESKTOP`                                                      |
| `purpose`                  | Entry point. Wallpaper, "Bid Management" desktop icon, two widgets, taskbar at bottom. |
| `layout`                   | Top: browser. Main left: wallpaper + single icon. Main right: widget column. Bottom: taskbar. |
| `primary targets`          | Bid Management desktop icon (`EL-001`), Bid Management taskbar icon (`EL-002`), "Open Bid Management" widget button (`EL-003`) |
| `widget content (live)`    | "Bid Management · Today" widget shows: total active bids count, HIL pending, Compiling, < 5 days. Polls `/api/bids/` every 10s. "Notifications" widget shows: 4 most recent audit entries, polls `/api/audit/?limit=4` every 15s. |
| `AI observation instruction` | Detect Bid Management icon and the live widget counts to confirm the desktop has loaded. |
| `narration before action`  | "The Centific Bid Management desktop is loaded. I can see the Bid Management application icon and the live status widgets." |
| `narration while acting`   | "I am opening the Bid Management application." |
| `success validation`       | Window with title containing "Bid Management" appears within 5 seconds. |
| `fallback`                 | If desktop icon click does not respond, click taskbar icon `EL-002` or the "Open Bid Management" widget button `EL-003`. |

📸 **Screenshot here.** Save as `/screenshots/SCR-002-DESKTOP.png`.

---

## 11. Detailed Page Example: HIL Approval Interface (`SCR-106-BID-DETAIL`)

| UI Area                      | Location                                  | Purpose                                  | Humanoid Instruction                                                | Validation                                       |
|-------------------------------|-------------------------------------------|------------------------------------------|----------------------------------------------------------------------|--------------------------------------------------|
| Detail header (breadcrumb + title) | Top of `REG-MAIN` (y=108..240)        | Confirms which bid is open + key meta    | Read bid title and stage badge                                      | Title contains target bid ID                      |
| Action button row            | Top-right of detail header               | Stage-specific primary action            | Identify which button is enabled — `Sign-off`, `Confirm & submit`, or "Awaiting" | Button text matches bid.stage + role             |
| Co-approval banner (conditional) | Just below action row                | Shown only when value > £1M OR ≥2 High risks AND not yet co-approved AND user is Manager (or green for both when approved) | Read pink/green banner text                | Banner colour indicates state                     |
| HIL Approval Progress strip   | Below detail header (y=240..280)         | 8 pill segments: green=Approved, amber=Pending, red=Returned | Read `<approved>/8 sections approved` counter        | Segment colours match section.status              |
| Section tabs                 | y=280..320                                | 8 tab buttons + status badge              | Click each tab; observe tab badges (✓ approved, ↺ returned, ! flagged) | Active tab visually distinct                      |
| Section content area         | y=320..830                                | Section-specific rendering with editable fields | Render varies: tables (effort, deliverables, acceptance, dependencies), gantt + milestones (schedule), pricing line table (pricing), risk register (risks), standards/metrics (quality) | Content present before action |
| Approve / Reject buttons     | Right side of every section card header  | Director-only; for Manager shows "Awaiting Director" badge | If you are Director, click Approve only after reviewing content; click Reject & return to send back upstream | Click changes section.status |
| Inline edit field            | Within tables that support editing       | BR-08 field-level correction logging      | Click "edit" link, type new value, click "save". Edit stored in `bid_sections.approved_data`. When section is later Approved, audit logs `Edited+Approved` with original/revised values. | After save, value shows strikethrough original + green highlighted revised |

📸 **Screenshot here** when bid is in HIL approval. Save as `/screenshots/SCR-106-BID-DETAIL.png`.

---

## 12. Pop-up and Modal Examples

| Popup Type                     | Trigger                                               | What AI Must Read                                | Correct Action                                  | Example Narration                                                   | Validation                       |
|---------------------------------|--------------------------------------------------------|---------------------------------------------------|--------------------------------------------------|----------------------------------------------------------------------|----------------------------------|
| Margin override (per-bid)       | Director clicks "Apply override" on Pricing tab        | Title "Confirm margin override", "from X% to Y% on [target]" | Click `EL-M01` Confirm override if intentional; else `EL-M02` Cancel | "BR-003 requires explicit confirmation. I will confirm the margin change from X% to Y% on [target]." | Modal closes; toast "Override logged"; audit gets Edited entry |
| Margin override (per-line)      | Director clicks "Confirm" on a line in Pricing Panel  | Same shape, scoped to single task              | Same                                            | Same, scoped to one task                                            | Same                             |
| Set missing rate                | Director clicks "Set rate" on a missing-rate line     | Modal title "Set missing rate", role + task labels, numeric input | Type rate → Confirm                            | "The rate card is missing this entry. I will set it to [rate] per hour." | Red "Missing Rate" badge replaced; audit Edited |
| Bid document overlay            | Director or Manager clicks "View bid document"        | Iframe with rendered HTML; modal header has Download HTML / Close | Click Download HTML if evidence required; otherwise Close | "This is the final compiled bid document. I will download a copy for evidence." | Iframe contains expected sections |
| Toast (non-blocking)            | Most successful actions                                | Bottom-right black toast with action confirmation | No action; just read for evidence              | "I can see the action was logged."                                  | Toast text matches action       |

---

## 13. Artifact Handling Examples

| Artifact Type                | Open From                                        | How Humanoid Reviews It                                                  | Required Notes                                                  | Completion Criteria                                  |
|-------------------------------|---------------------------------------------------|--------------------------------------------------------------------------|------------------------------------------------------------------|------------------------------------------------------|
| Compiled Bid Document (HTML) | BidDetail → "View bid document" `EL-610`         | Iframe shows multi-section HTML rendered from `bid_templates` via Jinja2. Read sections sequentially: Header, Executive Summary, 1. Effort, 2. Schedule, 3. Pricing, 4. Quality, 5. Deliverables, 6. Risks, 7. Dependencies, 8. Acceptance, Approval & Audit, Footer. Click "Download HTML" if evidence policy requires. | Mention bid reference, total value, currency, key flagged items per section. | Document opened; if evidence required, file downloaded. |
| Audit Log CSV                 | Audit Log → "Download CSV" `EL-A05`              | After applying any filters, click Download CSV. Open in Excel/text editor. CSV columns: Timestamp (UTC), Bid Ref, Section, Action, Original, Revised, User, Role, Details. | Mention the active filter set + row count + date range.        | File downloaded; size > 0 bytes.                    |
| Per-report CSV (R-01..R-06)   | Reports → click report card → "Export CSV"       | Each report card opens its detail panel. Detail panel has its own "Export CSV" button that exports the underlying data (R-02 sections, R-03 variance bids, R-04 cycle times, R-05 outcome bands, R-06 high-unacked risks). | Mention report id and the dataset exported.                    | File downloaded.                                    |
| Bid List CSV                  | Pipeline → "Export" / Bids List → "Export"       | Click the page-banner Export button. CSV columns: Bid ID, Client, RFP, Stage, Value, Currency, Deadline, Days Left, Sections, Outcome (and Last Action on Pipeline). | Mention current filters applied.                                | File downloaded.                                    |
| Web app page (any internal)   | Sidenav click                                    | Verify page banner title matches expected page; confirm primary regions are visible. | Mention page banner title before acting on the page.            | Banner title contains expected page name.           |

---

## 14. Decision Logic and Branching

| Decision ID | Condition                                                          | AI Decision                                          | Action                                                  | Narration                                                                 |
|-------------|---------------------------------------------------------------------|------------------------------------------------------|----------------------------------------------------------|----------------------------------------------------------------------------|
| `DEC-001`   | Confirm Compilation button is disabled (tooltip lists blockers)     | Cannot proceed; demonstrate Request Missing Data flow instead | Click `EL-202` for blocking row(s)                        | "Inputs are not all received. I will request the missing data from the upstream module." |
| `DEC-002`   | Compilation is in progress (sources_merged < 8/8)                   | Wait up to 30s for materialisation                   | Loop: re-read telemetry every 3s                          | "Sections are still compiling. I will wait until all eight are materialised." |
| `DEC-003`   | Section status is `flagged` (e.g. Effort low confidence, Schedule conflict, Risks missing owner) | Inspect the flag content, decide: Approve / Edit / Reject | If acceptable: Approve; else Edit-and-approve or Reject  | "This section has a flag. I will review the cause before approving." |
| `DEC-004`   | Risk Register Approve is disabled                                   | Identify unacknowledged High risks, ack them first   | Loop ack on each High risk row                            | "I cannot approve the Risk Register until every High-severity risk is acknowledged per BR-005." |
| `DEC-005`   | Co-approval banner shows pink (Manager view)                        | Switch role to Manager and click "Manager co-approve" | Avatar → Manager → click `EL-608`                         | "Co-approval is required because the bid value exceeds the threshold or two High risks are present." |
| `DEC-006`   | Co-approval banner is green                                         | Director can now sign off                             | Click `EL-607` Sign-off                                   | "Co-approval is confirmed. I will sign off." |
| `DEC-007`   | Manager opens BidDetail in `pending` stage                          | Cannot act; observe only                              | Read section pill counts only                              | "The bid is currently with the Director. I will return to the pipeline." |
| `DEC-008`   | Sign-off button shows "X/8 sections approved" disabled              | Identify remaining non-approved sections              | Click each non-green pill and approve                      | "There are still N sections requiring approval before sign-off is allowed." |
| `DEC-009`   | Director attempts Manager-only action via API directly              | Backend returns 403                                   | Capture error; switch role                                 | "This action is restricted to the Bid Manager role per server-side enforcement." |
| `DEC-010`   | Pipeline shows ≤2-day-overdue red banner                            | Highlight overdue bid count                           | Read banner contents into narration                        | "There are bids within 2 days of deadline. The dashboard flags them as overdue." |
| `DEC-011`   | "Missing Rate" badge appears on Pricing Panel                       | Resolve before approving Pricing                      | Click `EL-704`, set rate, confirm                          | "The Pricing section cannot be approved until the missing rate is resolved." |
| `DEC-012`   | View bid document modal fails to render (iframe blank)              | Retry once; otherwise download HTML directly         | Refresh modal; if still blank, click Download HTML         | "The preview did not render. I will download the document directly." |

---

## 15. Validation Rules and Evidence Capture

| Validation Type    | Rule                                                                       | Example                                                          | Evidence to Capture                                  |
|--------------------|-----------------------------------------------------------------------------|------------------------------------------------------------------|------------------------------------------------------|
| Page validation    | Page banner title must match expected screen                                | `SCR-101-DASHBOARD` banner contains "HIL Approval Queue" or "Compilation Pipeline" | Screenshot + detected banner text                |
| Element validation | Target element must be visible (no `opacity: 0.55`), enabled, not covered  | Sign-off button must not be disabled before clicking            | Element bounding box + screenshot                    |
| Action validation  | Expected state change after action                                          | After Approve section: pill turns green, sections_complete +1   | Before/after screenshots + audit log entry           |
| Role validation    | Action allowed for current role                                             | Manager attempting Approve → backend returns 403; UI shows "Awaiting Director" | HTTP status; narration of refusal                |
| Polling validation | Wait for poll-driven UI refresh                                             | After Director Approve, wait up to 5s before checking section state | Timestamp + final state                            |
| Audit validation   | Every approve / edit / reject / submit produces audit log entry             | After ACT-013 Approve section, GET `/api/audit/?bid_ref=...&action_type=Approved` returns entry | Audit row JSON                          |
| Document validation| Bid document iframe contains expected sections                              | `<h2>1. Effort Estimation</h2>` … `<h2>8. Acceptance Criteria</h2>` | Inner-text excerpt                                   |
| CSV validation     | Downloaded CSV first row matches expected header                            | "Timestamp (UTC),Bid Ref,Section,Action,Original Value,..."     | First two lines of file                              |
| Recovery validation| Original failure + recovery path logged                                     | Selector miss → coordinate fallback succeeded                    | Error log + recovery action                          |

---

## 16. Error Handling Matrix

| Error ID  | Scenario                                          | Detection                                              | Recovery                                                       | Final AI Response if Unresolved                       |
|-----------|---------------------------------------------------|---------------------------------------------------------|----------------------------------------------------------------|--------------------------------------------------------|
| `ERR-001` | Page timeout                                      | No page banner detected after 15s                      | Refresh page; if fails, re-launch app from desktop icon       | "The application did not load. Please retry the session." |
| `ERR-002` | Sidenav target not found                          | Selector `.app-sidenav-btn[title="X"]` not visible      | Hover the sidenav region and read all tooltips; switch role if tab is role-gated | "The expected tab is not visible. I will switch role and retry." |
| `ERR-003` | Approve/Reject button disabled                    | Button has `disabled` attribute or opacity < 1         | Inspect tooltip; resolve precondition (ack High risks, fix Missing Rate, switch role) | "I cannot approve this section until [precondition] is resolved." |
| `ERR-004` | Modal blocks action                                | Overlay element with `inset:0` detected                | Read modal text; click correct primary action; if uncertain, Cancel and abort | "A modal is blocking the next step." |
| `ERR-005` | Backend 403 (role enforcement)                    | API response status 403                                | Switch to required role and retry                              | "The action is restricted by role." |
| `ERR-006` | Backend 400 (state machine violation)             | E.g. trying to submit a non-approved bid               | Stop; report stage mismatch                                    | "The action is not allowed in the current bid stage." |
| `ERR-007` | Compilation never completes                        | Telemetry sources_merged stuck < 8/8 after 60s         | Trigger a refresh; if still stuck, abort and re-run Confirm Compilation on a different RFP | "The compilation pipeline appears stalled." |
| `ERR-008` | Audit log row missing for an action                | After action, audit query returns no matching row     | Wait 5s and re-query; if still missing, escalate              | "The expected audit entry was not recorded." |
| `ERR-009` | Iframe blank in bid document modal                 | Iframe `srcDoc` empty / loading                       | Refresh; click Download HTML to inspect the source            | "The preview could not be rendered." |
| `ERR-010` | CSV download blocked by browser                    | No file in download tray after click                  | Use the developer tools network tab; verify the GET response  | "The file download was blocked by the browser." |

---

## 17. Humanoid Narration Script Patterns

| Situation                  | Template                                                                                                     | Example                                                                                          |
|----------------------------|---------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| Before a new screen        | "I am going to open [page] so we can [reason]."                                                              | "I am going to open the Compilation tab so we can watch the bid being assembled."                |
| While loading              | "[Page] is loading. Once it opens, I will look for [items]."                                                 | "Compilation is loading. Once it opens, I will look for the live telemetry and the eight sections." |
| After page opens           | "The [page] is visible. I can see [regions/items]."                                                           | "Bid Detail is visible. I can see the eight section tabs and the approval progress strip."       |
| Before a stage transition  | "I will [action] to move the bid from [stage A] to [stage B]."                                               | "I will route to Director to move the bid from Compiling to Pending Approval."                   |
| When approving             | "I have reviewed [section]. I will approve it."                                                              | "I have reviewed the Pricing section. I will approve it."                                        |
| When editing first         | "Before approving, I will correct [field] from [original] to [revised]."                                     | "Before approving, I will correct the Schedule milestone end date from 14 Jun to 21 Jun."        |
| Before margin override     | "I will adjust the margin to [Y%]. BR-003 requires a confirmation modal before this takes effect."           | Same                                                                                              |
| Before risk acknowledgement| "BR-005 requires acknowledging every High-severity risk individually. I will acknowledge [risk_ref] now."     | Same                                                                                              |
| Before sign-off            | "All eight sections are approved. I will sign off the bid and route it back to the Bid Manager for submission." | Same                                                                                              |
| When co-approval needed    | "Co-approval is required. I will switch to the Bid Manager and co-approve."                                  | Same                                                                                              |
| Before submission          | "The bid is approved. I will submit it to the client portal."                                                | Same                                                                                              |
| When uncertain             | "I can see [known], but [unknown] is not clearly visible. I will [safe next step]."                           | "I can see the section pill is amber, but the flag detail is small. I will hover over it before deciding." |
| When recovering            | "The expected [item] is not visible. I will try [fallback]."                                                  | "The Approve button is disabled. I will inspect the tooltip and resolve the precondition first." |
| Final summary              | "We reviewed [screens] and [actions]. The bid moved from [start state] to [end state]. The audit log captures [count] events." | "We compiled, approved, and submitted BID-XXX. The audit log captures every override and acknowledgement." |

---

## 18. Copy-and-Fill Blank Action Matrix

| Seq | Action ID | Screen ID | Action Type | Target Element ID | Location / Selector | Required Input | Expected Response | Validation | Speaker Notes | Fallback |
|-----|-----------|-----------|-------------|--------------------|----------------------|-----------------|--------------------|-------------|---------------|----------|
|     |           |           |             |                    |                      |                 |                    |             |               |          |

---

## 19. Copy-and-Fill Blank Page Definition

| Field                | Value to Fill |
|----------------------|---------------|
| `screen_id`          |               |
| `screen_name`        |               |
| `route_or_tab`       |               |
| `business_purpose`   |               |
| `entry_condition`    |               |
| `exit_condition`     |               |
| `layout_regions`     |               |
| `primary_elements`   |               |
| `secondary_elements` |               |
| `popups_expected`    |               |
| `artifacts_available`|               |
| `validation_rules`   |               |
| `speaker_notes_before`|              |
| `speaker_notes_after`|               |
| `fallback_navigation`|               |

---

## 20. Master JSON Example for AI Runtime

```json
{
  "flow_id": "FLOW-BID-LIFECYCLE-001",
  "prototype": "Centific Bid Management Platform",
  "entry_screen_id": "SCR-002-DESKTOP",
  "parameters": {
    "manager_user":   {"id": "manager",  "name": "Arjun Kapoor"},
    "director_user":  {"id": "director", "name": "Priya Menon"},
    "target_rfp_id":  "RFP-001",
    "target_bid_ref": "BID-2026-041",
    "co_approval_threshold_gbp": 1000000
  },
  "runtime_rules": {
    "preferred_locator_order": ["title attribute", "button text", "css class", "fallback coordinates"],
    "wait_timeout_seconds": 20,
    "compilation_max_wait_seconds": 30,
    "screenshot_policy": "capture_on_major_screen_change_and_after_each_state_transition",
    "narration_policy": "speak_before_and_after_each_major_action",
    "do_not_infer_unreadable_content": true,
    "polling_assumptions": {
      "useBids_seconds": 10,
      "useBidDetail_seconds": 5,
      "useDashboardMetrics_seconds": 15,
      "useAuditLog_commentary_seconds": 8
    },
    "role_header": "X-User-Role"
  },
  "completion_criteria": [
    "Confirm Compilation triggered for target RFP",
    "Compilation telemetry reached 8/8 sources merged",
    "Bid routed from Compiling → Pending Approval",
    "All 8 sections approved by Director (or returned)",
    "Co-approval clicked by Manager if banner appeared",
    "Director Sign-off moved bid to Approved",
    "Bid document rendered via template and screenshot captured",
    "Manager Confirm & submit moved bid to Submitted",
    "Audit log filtered to bid_ref and CSV downloaded",
    "Final spoken summary delivered"
  ]
}
```

---

## 21. Final Response Object Example

```json
{
  "flow_id": "FLOW-BID-LIFECYCLE-001",
  "status": "completed",
  "bid_reference": "BID-2026-NEW",
  "stages_traversed": [
    "validating", "inputs_ready", "compiling", "pending", "approved", "submitted"
  ],
  "screens_visited": [
    "SCR-002-DESKTOP",
    "SCR-100-APPSHELL",
    "SCR-102-INPUTS",
    "SCR-103-COMPILE",
    "SCR-104-PIPELINE",
    "SCR-105-HIL-QUEUE",
    "SCR-106-BID-DETAIL",
    "SCR-200-MARGIN-MODAL",
    "SCR-202-DOC-MODAL",
    "SCR-110-AUDIT"
  ],
  "actions_executed": 31,
  "audit_entries_generated": 14,
  "artifacts_reviewed": [
    {"type": "Compiled Bid Document (HTML)", "result": "rendered_and_downloaded"},
    {"type": "Audit Log CSV",                "result": "downloaded"}
  ],
  "screenshots_captured": [
    "/screenshots/SCR-002-DESKTOP.png",
    "/screenshots/SCR-102-INPUTS.png",
    "/screenshots/SCR-103-COMPILE.png",
    "/screenshots/SCR-106-BID-DETAIL_pricing.png",
    "/screenshots/SCR-106-BID-DETAIL_risks.png",
    "/screenshots/SCR-202-DOC-MODAL.png",
    "/screenshots/SCR-110-AUDIT.png"
  ],
  "humanoid_final_spoken_summary": "We took a fresh RFP through the full bid lifecycle. The Bid Manager confirmed compilation, the system materialised eight sections from upstream module data, and the Bid Manager routed the bid to the Director. The Director approved each section individually, applied a margin override that triggered the BR-003 confirmation modal, and acknowledged every High-severity risk per BR-005. Because the bid value exceeded one million pounds, a co-approval was required and the Manager confirmed before the Director's final sign-off. The Manager then submitted the bid. The full audit trail is exported as evidence.",
  "recommended_next_action": "Open the Reports page R-04 (Approval & Correction) to review the cycle time and override count for this bid."
}
```

---

## 22. Application Map at a Glance

```
http://localhost:5173/                   ┌── BACKEND ──────────────────────────────┐
                                         │  http://localhost:8000/api/             │
SCR-002-DESKTOP (wallpaper)              │                                         │
  │                                      │  /health                                │
  ├─ EL-001 [Bid Mgmt icon] ─────────►   │  /bids/, /bids/{ref}, /sections, /risks │
  └─ EL-003 [widget button] ──────────►  │  /bids/{ref}/route-to-director  (Mgr)   │
                                         │  /bids/{ref}/submit             (Mgr)   │
SCR-100-APPSHELL (windowed app)          │  /bids/{ref}/pricing-lines              │
  │                                      │  /bids/{ref}/.../margin         (Dir)   │
  ├─ Sidenav (role-aware tabs)            │  /bids/{ref}/.../resolve-rate   (Dir)   │
  │   Both roles:                         │  /bids/{ref}/compilation-telemetry      │
  │     Dashboard, Pipeline,              │                                         │
  │     Reports, Audit Log                │  /hil/queue                             │
  │   Director only:                      │  /hil/{ref}/sections/{key}/approve  (Dir)│
  │     HIL Approval, Pricing, Risk      │  /hil/{ref}/sections/{key}/edit     (Dir)│
  │   Manager only:                       │  /hil/{ref}/sections/{key}/reject   (Dir)│
  │     Input Validation, Compilation,    │  /hil/{ref}/margin-override         (Dir)│
  │     Co-review                         │  /hil/{ref}/risks/{rref}/acknowledge(Dir)│
  │                                      │  /hil/{ref}/sign-off               (Dir)│
  ├─ Main content                         │  /hil/{ref}/manager-co-approve     (Mgr)│
  │     SCR-101..SCR-110 pages            │                                         │
  │                                      │  /audit/?bid_ref=&action_type=&...      │
  └─ Aside (Live Commentary)              │  /inputs/                               │
        Polls /api/audit/ every 8s        │  /inputs/{rfp}/request-missing/{cat}(Mgr)│
                                         │  /inputs/{rfp}/confirm-compilation  (Mgr)│
                                         │                                         │
                                         │  /reports/dashboard                     │
                                         │  /reports/compilation-quality           │
                                         │  /reports/pricing-variance              │
                                         │  /reports/approval-correction           │
                                         │  /reports/outcomes                      │
                                         │  /reports/risk-profile                  │
                                         │                                         │
                                         │  /documents/templates                   │
                                         │  /documents/bids/{ref}/document         │
                                         └─────────────────────────────────────────┘
```

**Stage state machine.** Backend rejects illegal transitions with HTTP 400.

```
  validating → inputs_ready → compiling → pending → approved → submitted
                                              ↓
                                          rejected/returned
                                          (per-section only)
```

**Role enforcement.** Frontend sets `X-User-Role` from the active avatar selection. Backend `auth.require_director(role)` and `auth.require_manager(role)` enforce per-endpoint. Mismatched calls return HTTP 403.

---

## 23. Screenshot Capture Checklist

When running this flow, the agent must capture and save each of these screenshots into `/screenshots/`:

1. `SCR-002-DESKTOP.png` — initial desktop with widgets
2. `SCR-100-APPSHELL.png` — first window open, Director role
3. `SCR-102-INPUTS.png` — Input Validation as Manager, before Confirm Compilation
4. `SCR-102-INPUTS-confirmed.png` — Input Validation after compilation triggered, "Compiled →" badge visible
5. `SCR-103-COMPILE-progress.png` — Compilation halfway (sources_merged < 8/8)
6. `SCR-103-COMPILE-done.png` — Compilation 8/8 with "Route to Director" enabled
7. `SCR-104-PIPELINE.png` — Pipeline with the new bid in `pending`
8. `SCR-105-HIL-QUEUE.png` — HIL queue from Director's view
9. `SCR-106-BID-DETAIL_pricing.png` — Pricing tab with margin slider
10. `SCR-200-MARGIN-MODAL.png` — Confirm margin modal open
11. `SCR-106-BID-DETAIL_risks.png` — Risks tab with High risks pre-ack
12. `SCR-106-BID-DETAIL_risks_acked.png` — Risks tab with all High acked
13. `SCR-106-BID-DETAIL_coapproval_pink.png` — Co-approval banner Manager-side
14. `SCR-106-BID-DETAIL_coapproval_green.png` — Co-approval confirmed, Director can sign off
15. `SCR-106-BID-DETAIL_signedoff.png` — All 8 approved + signed off
16. `SCR-202-DOC-MODAL.png` — Rendered bid document
17. `SCR-106-BID-DETAIL_submitted.png` — "Submitted" badge showing
18. `SCR-110-AUDIT_filtered.png` — Audit log filtered to the bid
19. `final.png` — final summary state

The agent stores the file paths in the response object's `screenshots_captured` array.

---

*End of document. v1.0. Generated 2026-04-25 against running build at `localhost:5173` / `localhost:8000`.*
