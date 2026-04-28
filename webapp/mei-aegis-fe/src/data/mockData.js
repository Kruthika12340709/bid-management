const users = {
  director: {
    id: 'director',
    name: 'Priya Menon',
    role: 'Bid Director',
    initials: 'PM',
    title: 'Solid-line approver — primary HIL gate',
    avatarClass: 'director',
  },
  manager: {
    id: 'manager',
    name: 'Arjun Kapoor',
    role: 'Bid Manager',
    initials: 'AK',
    title: 'Dotted-line — input validation & submission',
    avatarClass: 'manager',
  },
};

const stages = [
  { key: 'validating',   label: 'Awaiting Inputs',  color: '#94A3B8' },
  { key: 'inputs_ready', label: 'Inputs Ready',     color: '#3B82F6' },
  { key: 'compiling',    label: 'Compiling',        color: '#06B6D4' },
  { key: 'pending',      label: 'Pending Approval', color: '#E4902E' },  // amber per MVP
  { key: 'approved',     label: 'Approved',         color: '#16A34A' },
  { key: 'submitted',    label: 'Submitted',        color: '#0D9488' },
];

const stageProgress = {
  validating: 12, compiling: 35, pending: 65, approved: 85, submitted: 100, outcome: 100,
};

const bids = [
  {
    id: 'BID-2026-041', title: 'NHS Digital — Clinical Data Platform',
    client: 'NHS Digital', rfp: 'RFP-NHS-2026-018',
    stage: 'pending', value: 1240000, currency: 'GBP',
    deadline: '2026-04-30T17:00:00Z', daysLeft: 5, assigned: 'director',
    sectionsComplete: 7, sectionsTotal: 8,
    flags: { lowConf: 2, conflicts: 1, missingRate: 0, highRisk: 2 },
    margin: 22, currentMargin: 24, compileTime: '14m 22s', winProb: 0.62, urgency: 'high',
    tags: ['Healthcare', 'High Value', 'EU-jurisdiction'],
  },
  {
    id: 'BID-2026-040', title: 'BNP Paribas — KYC Automation Engine',
    client: 'BNP Paribas', rfp: 'RFP-BNP-2026-009',
    stage: 'compiling', value: 890000, currency: 'EUR',
    deadline: '2026-05-04T17:00:00Z', daysLeft: 9, assigned: 'manager',
    sectionsComplete: 4, sectionsTotal: 8,
    flags: { lowConf: 4, conflicts: 0, missingRate: 1, highRisk: 1 },
    margin: 25, currentMargin: 25, compileTime: 'in progress', winProb: 0.48, urgency: 'medium',
    tags: ['Financial Services', 'Compliance'],
  },
  {
    id: 'BID-2026-039', title: 'Centrica — Smart Meter Field Ops',
    client: 'Centrica plc', rfp: 'RFP-CEN-2026-031',
    stage: 'validating', value: 2150000, currency: 'GBP',
    deadline: '2026-05-12T17:00:00Z', daysLeft: 17, assigned: 'manager',
    sectionsComplete: 0, sectionsTotal: 8,
    flags: { lowConf: 0, conflicts: 0, missingRate: 0, highRisk: 0 },
    margin: 20, currentMargin: 20, compileTime: '—', winProb: 0.55, urgency: 'low',
    tags: ['Utilities', 'High Value', 'Field Services'],
  },
  {
    id: 'BID-2026-038', title: 'DHL Supply Chain — Predictive Routing',
    client: 'DHL Supply Chain', rfp: 'RFP-DHL-2026-002',
    stage: 'approved', value: 740000, currency: 'EUR',
    deadline: '2026-04-26T17:00:00Z', daysLeft: 1, assigned: 'director',
    sectionsComplete: 8, sectionsTotal: 8,
    flags: { lowConf: 0, conflicts: 0, missingRate: 0, highRisk: 0 },
    margin: 22, currentMargin: 23, compileTime: '11m 04s', winProb: 0.71, urgency: 'high',
    tags: ['Logistics', 'AI/ML'],
  },
  {
    id: 'BID-2026-037', title: 'TfL — Passenger Flow Analytics',
    client: 'Transport for London', rfp: 'RFP-TFL-2026-014',
    stage: 'submitted', value: 615000, currency: 'GBP',
    deadline: '2026-04-15T17:00:00Z', daysLeft: -10, assigned: 'director',
    sectionsComplete: 8, sectionsTotal: 8,
    flags: { lowConf: 0, conflicts: 0, missingRate: 0, highRisk: 0 },
    margin: 24, currentMargin: 24, compileTime: '9m 47s', winProb: 0.66, urgency: 'low',
    tags: ['Public Sector', 'Submitted'],
  },
  {
    id: 'BID-2026-036', title: 'Allianz — Claims Triage AI',
    client: 'Allianz Group', rfp: 'RFP-ALZ-2026-021',
    stage: 'pending', value: 1860000, currency: 'EUR',
    deadline: '2026-05-02T17:00:00Z', daysLeft: 7, assigned: 'director',
    sectionsComplete: 8, sectionsTotal: 8,
    flags: { lowConf: 1, conflicts: 0, missingRate: 0, highRisk: 3 },
    margin: 22, currentMargin: 22, compileTime: '16m 11s', winProb: 0.58, urgency: 'medium',
    tags: ['Insurance', 'High Value'],
  },
  {
    id: 'BID-2026-035', title: 'Lloyds — Fraud Signal Aggregator',
    client: 'Lloyds Banking Group', rfp: 'RFP-LLD-2026-007',
    stage: 'compiling', value: 425000, currency: 'GBP',
    deadline: '2026-05-08T17:00:00Z', daysLeft: 13, assigned: 'manager',
    sectionsComplete: 5, sectionsTotal: 8,
    flags: { lowConf: 2, conflicts: 1, missingRate: 0, highRisk: 0 },
    margin: 23, currentMargin: 23, compileTime: 'in progress', winProb: 0.52, urgency: 'medium',
    tags: ['Financial Services'],
  },
];

const sections = [
  { id: 'effort',       name: 'Effort Estimation',   sub: '12 tasks · 480h aggregated · 2 low-confidence flags', status: 'flagged' },
  { id: 'schedule',     name: 'Delivery Schedule',   sub: '3 phases · 14 milestones · 1 resource conflict (week 6)', status: 'flagged' },
  { id: 'pricing',      name: 'Task-wise Pricing',   sub: '18 lines · GBP 87,500 cost → GBP 105,000 bid (20% margin)', status: 'approved' },
  { id: 'quality',      name: 'Quality Framework',   sub: '6 domain standards applied — data services engagement', status: 'approved' },
  { id: 'deliverables', name: 'Deliverable Register',sub: '5 contracted outputs · all formats specified', status: 'approved' },
  { id: 'risks',        name: 'Risk Register',       sub: '8 risks · 2 High-rated · 1 missing mitigation owner', status: 'flagged' },
  { id: 'dependencies', name: 'Dependency Map',      sub: '3 external · 4 internal · all owners assigned', status: 'approved' },
  { id: 'acceptance',   name: 'Acceptance Criteria', sub: '9 RFP conditions mapped · validated against scope', status: 'pending' },
];

const pricingLines = [
  { task: 'Discovery & Requirements Workshop',    role: 'Solution Architect',  rate: 950, hours: 40, margin: 20 },
  { task: 'Discovery & Requirements Workshop',    role: 'Business Analyst',    rate: 650, hours: 60, margin: 20 },
  { task: 'Data Source Mapping',                  role: 'Data Engineer',       rate: 750, hours: 80, margin: 20 },
  { task: 'Data Source Mapping',                  role: 'Solution Architect',  rate: 950, hours: 24, margin: 20 },
  { task: 'Reference Architecture',               role: 'Solution Architect',  rate: 950, hours: 48, margin: 20 },
  { task: 'Pipeline Build — Ingestion',           role: 'Data Engineer',       rate: 750, hours: 96, margin: 20 },
  { task: 'Pipeline Build — Transformation',      role: 'Data Engineer',       rate: 750, hours: 80, margin: 22 },
  { task: 'ML Feature Engineering',               role: 'ML Engineer',         rate: 850, hours: 56, margin: 22 },
  { task: 'Model Training & Validation',          role: 'ML Engineer',         rate: 850, hours: 72, margin: 22 },
  { task: 'API Layer & Integration',              role: 'Backend Engineer',    rate: 700, hours: 64, margin: 20 },
  { task: 'Compliance & Audit Hardening',         role: 'Compliance Engineer', rate: 800, hours: 32, margin: 20 },
  { task: 'UAT Support & Handover',               role: 'Solution Architect',  rate: 950, hours: 24, margin: 20 },
];

const risks = [
  { id: 'R-01', desc: 'Source data quality varies across legacy NHS Trust feeds',                cat: 'Data',       prob: 'High',   impact: 'High',   sev: 'High',   mit: 'Two-stage validation pipeline + Trust-specific transforms',     owner: 'Data Lead',         ack: false },
  { id: 'R-02', desc: 'Information governance approval timing on patient data flows',            cat: 'Compliance', prob: 'Medium', impact: 'High',   sev: 'High',   mit: 'Pre-engagement IG steering with NHS Digital DPO',              owner: 'Compliance Lead',   ack: false },
  { id: 'R-03', desc: 'Concurrent rollout to 6 ICBs strains Field Engineering capacity',         cat: 'Resource',   prob: 'Medium', impact: 'Medium', sev: 'Medium', mit: 'Phased ICB onboarding aligned to FE bench',                    owner: 'Delivery Lead',     ack: true },
  { id: 'R-04', desc: 'Model drift over 24-month operating window',                              cat: 'AI/ML',      prob: 'Medium', impact: 'Medium', sev: 'Medium', mit: 'Quarterly retraining contract + drift dashboard',              owner: 'ML Lead',           ack: true },
  { id: 'R-05', desc: 'Scheduling overlap with EHR integration milestone',                       cat: 'Schedule',   prob: 'Medium', impact: 'Low',    sev: 'Low',    mit: 'Buffer week + dependency-driven re-sequencing',                owner: '—',                 ack: false },
  { id: 'R-06', desc: 'Currency exposure on contracted GBP price during 18-month delivery',      cat: 'Financial',  prob: 'Low',    impact: 'Medium', sev: 'Low',    mit: 'Forward-contract via Treasury per quarter',                    owner: 'Finance Lead',      ack: true },
  { id: 'R-07', desc: 'Sub-contractor security clearance lead time',                             cat: 'Resource',   prob: 'Low',    impact: 'Medium', sev: 'Low',    mit: 'Pre-cleared bench + SC sponsorship pipeline',                  owner: 'People Ops',        ack: true },
  { id: 'R-08', desc: 'Acceptance criteria interpretation on "near real-time"',                  cat: 'Scope',      prob: 'Low',    impact: 'Low',    sev: 'Low',    mit: 'Glossary appendix in SoW + signed-off SLAs',                   owner: 'Solution Architect',ack: true },
];

const commentary = [
  { time: '09:14', author: 'Bid Engine',    authorClass: 'system',    text: 'Effort estimation flagged 2 low-confidence entries (T-04, T-09). Threshold = 0.65.', tags: ['Compilation', 'Flag'] },
  { time: '09:14', author: 'Bid Engine',    authorClass: 'system',    text: 'Resource conflict detected — Solution Architect double-booked, week 6.', tags: ['Schedule', 'Flag'] },
  { time: '09:18', author: 'Arjun Kapoor', authorClass: 'manager',   text: 'Reviewed input validation — all 8 sections received. Routing to Bid Director.' },
  { time: '09:22', author: 'Priya Menon',  authorClass: 'director',  text: 'Picked up HIL queue. Starting with Pricing — 20% margin looks light for healthcare risk profile.' },
  { time: '09:31', author: 'Priya Menon',  authorClass: 'director',  text: 'Adjusted margin on pipeline tasks from 20% → 22%. Override logged.', highlight: 'margin: 20% → 22%' },
  { time: '09:31', author: 'Bid Engine',    authorClass: 'system',    text: 'Pricing override secondary confirmation requested.', tags: ['Override', 'BR-003'] },
  { time: '09:34', author: 'Arjun Kapoor', authorClass: 'manager',   text: 'Confirmed override — bid total moves to GBP 107,140.', highlight: 'GBP 107,140' },
  { time: '09:41', author: 'Priya Menon',  authorClass: 'director',  text: 'Risk register — R-01, R-02 are High and need explicit ack per BR-005.' },
  { time: '09:48', author: 'Priya Menon',  authorClass: 'director',  text: 'Acknowledged R-01 and R-02. R-05 still missing mitigation owner — back to upstream.' },
  { time: '09:49', author: 'Bid Engine',    authorClass: 'system',    text: 'Feedback loop entry created → RFP Solution module (R-05 owner gap).', tags: ['Feedback Loop'] },
];

const timeseries = {
  weeks:     ['W12','W13','W14','W15','W16','W17','W18'],
  submitted: [3, 4, 5, 4, 6, 5, 7],
  won:       [1, 3, 2, 2, 4, 3, 5],
  value:     [820, 1240, 1480, 1190, 1860, 1620, 2210],
};

const notifications = [
  { type: 'approval',  title: 'NHS Digital bid awaits HIL approval',       sub: '5 days to deadline · 2 sections flagged', time: '2m ago', urgent: true },
  { type: 'override',  title: 'Pricing override pending confirmation',     sub: 'BNP Paribas · margin 25% → 27%',          time: '14m ago' },
  { type: 'submitted', title: 'TfL Passenger Flow bid submitted',          sub: 'Confirmation received from procurement portal', time: '1h ago' },
  { type: 'outcome',   title: 'AWARD — Sodexo Workplace Insights',         sub: 'Win · GBP 720k · pricing data stored',    time: '3h ago' },
];

const BID_DATA = { users, stages, stageProgress, bids, sections, pricingLines, risks, commentary, timeseries, notifications };

export default BID_DATA;
