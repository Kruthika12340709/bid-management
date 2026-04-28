// Adapts API shape (snake_case, API field names) → mock-shape (camelCase, what
// the existing page components were written against). Lets us swap data sources
// without touching every page.

import BID_DATA from '../data/mockData';

const TODAY = new Date('2026-04-25T17:00:00Z');

function daysLeft(deadlineISO) {
  if (!deadlineISO) return 0;
  const d = new Date(deadlineISO);
  return Math.ceil((d - TODAY) / 86400000);
}

export function adaptBid(b) {
  // Primary owner is determined by stage: pre-HIL stages are owned by the Manager,
  // HIL+ stages by the Director. Both names are populated on every row in DB
  // (assigned_director + assigned_manager), so we derive who's actively driving.
  const managerStages = ['validating', 'compiling'];
  const userId = managerStages.includes(b.stage) ? 'manager' : 'director';
  return {
    id:        b.bid_reference,
    title:     b.title,
    client:    b.client_name,
    rfp:       b.rfp_id || b.bid_reference.replace('BID-', 'RFP-'),
    stage:     b.stage,
    value:     Number(b.compiled_value || 0),
    currency:  b.currency || 'GBP',
    deadline:  b.submission_deadline ? `${b.submission_deadline}T17:00:00Z` : null,
    daysLeft:  daysLeft(b.submission_deadline),
    assigned:  userId,
    sectionsComplete: b.sections_complete,
    sectionsTotal:    b.sections_total,
    flagCount: b.section_flag_count ?? (b.flag_low_conf || 0) + (b.flag_conflicts || 0) + (b.flag_missing_rate || 0) + (b.flag_high_risk || 0),
    flags: {
      lowConf:     b.flag_low_conf,
      conflicts:   b.flag_conflicts,
      missingRate: b.flag_missing_rate,
      highRisk:    b.flag_high_risk,
    },
    margin:        Number(b.compiled_margin_pct || 0),
    currentMargin: Number(b.approved_margin_pct ?? b.compiled_margin_pct ?? 0),
    winProb:       Number(b.win_probability || 0),
    tags:          b.tags || [],
    outcome:       b.outcome || null,
    lastAction: b.last_action_text ? {
      what: b.last_action_text,
      who:  b.last_action_by,
      when: b.last_action_at,
    } : null,
    compileTime:           '—',
    urgency:               b.flag_high_risk > 1 ? 'high' : b.flag_high_risk > 0 ? 'medium' : 'low',
    hilApprovedAt:         b.hil_approved_at,
    hilApprovedBy:         b.hil_approved_by,
    managerCoApprovedAt:   b.manager_co_approved_at,
    managerCoApprovedBy:   b.manager_co_approved_by,
    submittedAt:           b.submitted_at,
  };
}

export function adaptAuditEntry(e) {
  const userMap = { Director: 'director', Manager: 'manager', System: 'system' };
  const ts = new Date(e.created_at);
  return {
    ts:       ts.toISOString().replace('T', ' ').slice(0, 19),
    bid:      e.bid_reference || '—',
    section:  e.section_key || '—',
    action:   e.action_type,
    original: e.original_value || '—',
    revised:  e.revised_value  || '—',
    user:     userMap[e.role] || 'system',
    role:     e.role || 'System',
    detail:   e.detail || '',
  };
}

// Re-export stages, users, sections, pricingLines, risks, etc. from mock for now.
// The DB doesn't yet have a bid_pricing_lines table, so pricing/risk panels still
// use mock data. Stages/users metadata is hardcoded UI-side anyway.
export const stages         = BID_DATA.stages;
export const users          = BID_DATA.users;
export const sections       = BID_DATA.sections;
export const pricingLines   = BID_DATA.pricingLines;
export const risksMock      = BID_DATA.risks;
export const commentaryMock = BID_DATA.commentary;
export const timeseries     = BID_DATA.timeseries;
export const notifications  = BID_DATA.notifications;
