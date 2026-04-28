import React from 'react';

// FX rates → GBP (base currency for portfolio totals).
// Static for MVP; would be sourced from FX feed in production.
export const FX_TO_GBP = { GBP: 1.0, EUR: 0.85, USD: 0.79 };

const STAGES = {
  validating:   { label: 'Awaiting Inputs',  color: '#94A3B8' },
  inputs_ready: { label: 'Inputs Ready',     color: '#3B82F6' },
  compiling:    { label: 'Compiling',        color: '#06B6D4' },
  pending:      { label: 'Pending Approval', color: '#E4902E' },  // amber per MVP
  approved:     { label: 'Approved',         color: '#16A34A' },
  submitted:    { label: 'Submitted',        color: '#0D9488' },
  outcome:      { label: 'Outcome Received', color: '#5929d0' },
};

export function fmtMoney(v, c = 'GBP') {
  const sym = c === 'GBP' ? '£' : c === 'EUR' ? '€' : c === 'USD' ? '$' : c;
  if (v >= 1000000) return sym + (v / 1000000).toFixed(2) + 'M';
  if (v >= 1000)    return sym + (v / 1000).toFixed(0) + 'k';
  return sym + v;
}

export function toGBP(value, currency) {
  return value * (FX_TO_GBP[currency] || 1.0);
}

export function stageBadge(k) {
  const s = STAGES[k] || { label: k, color: '#94A3B8' };
  const cls =
    k === 'approved'     ? 'badge-success' :
    k === 'submitted'    ? 'badge-pink'    :
    k === 'pending'      ? 'badge-warning' :  // amber for Pending Approval
    k === 'inputs_ready' ? 'badge-cyan'    :
    k === 'compiling'    ? 'badge-cyan'    : 'badge-neutral';
  return <span className={`badge ${cls}`}>{s.label}</span>;
}
