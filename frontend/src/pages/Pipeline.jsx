import React, { useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { useBids } from '../hooks/useApiData';
import { stages, users } from '../utils/adapt';
import { downloadCSV } from '../utils/csv';

const STAGE_COLOR = {
  validating:    '#94A3B8',  // Awaiting Inputs (grey)
  inputs_ready:  '#3B82F6',  // Inputs Ready (blue)
  compiling:     '#06B6D4',  // Compiling (animated blue)
  pending:       '#E4902E',  // Pending Approval (amber, per MVP)
  approved:      '#16A34A',  // Approved (green)
  submitted:     '#0D9488',  // Submitted (teal)
  overdue:       '#DC2626',  // Overdue (red)
};

function relTime(iso) {
  if (!iso) return '';
  const ago = (Date.now() - new Date(iso).getTime()) / 1000;
  if (ago < 60) return `${Math.round(ago)}s ago`;
  if (ago < 3600) return `${Math.round(ago / 60)}m ago`;
  if (ago < 86400) return `${Math.round(ago / 3600)}h ago`;
  return `${Math.round(ago / 86400)}d ago`;
}

export default function Pipeline({ onOpenBid }) {
  const { bids, error } = useBids();
  const [stageFilter, setStageFilter] = useState('all');

  if (error) return <div style={{ padding: 40, color: '#DC2626' }}>API error: {String(error)}</div>;
  if (!bids) return <div style={{ padding: 40, color: '#94A3B8' }}>Loading pipeline…</div>;

  const counts = stages.reduce((acc, s) => ({ ...acc, [s.key]: bids.filter(b => b.stage === s.key).length }), {});

  let visible = bids;
  if (stageFilter !== 'all') visible = visible.filter(b => b.stage === stageFilter);

  const overdue = bids.filter(b => b.daysLeft <= 2 && b.stage !== 'submitted' && !b.outcome);

  return (
    <div>
      <div className="page-banner" style={{ background: 'linear-gradient(90deg, #5929d0 0%, #8b3fb8 50%, #CF008B 100%)' }}>
        <div className="page-banner-dot" />
        <div className="page-banner-text">
          <div className="page-banner-title">Bid Pipeline</div>
          <div className="page-banner-sub">All bids across all pipeline stages — RFP reference, value, deadline, days remaining, last action</div>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn" onClick={() => downloadCSV(`pipeline-${new Date().toISOString().slice(0, 10)}.csv`, visible, [
            { key: 'id',       label: 'Bid ID' },
            { key: 'client',   label: 'Client' },
            { key: 'rfp',      label: 'RFP' },
            { key: 'stage',    label: 'Stage' },
            { key: 'value',    label: 'Value', format: v => v.toLocaleString() },
            { key: 'currency', label: 'Currency' },
            { key: 'deadline', label: 'Deadline', format: v => v ? v.slice(0, 10) : '' },
            { key: 'daysLeft', label: 'Days Left' },
            { key: 'outcome',  label: 'Outcome' },
            { key: 'lastAction', label: 'Last Action', format: v => v ? `${v.what} (${v.who})` : '' },
          ])}>Export</button>
        </div>
      </div>

      {overdue.length > 0 && (
        <div className="card" style={{ marginBottom: 14, background: '#FEF2F2', border: '1px solid #FCA5A5' }}>
          <div className="card-pad" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#DC2626', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {Icon.alert(16)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#991B1B' }}>
                {overdue.length} bid{overdue.length > 1 ? 's are' : ' is'} ≤ 2 days from deadline
              </div>
              <div style={{ fontSize: 11.5, color: '#7F1D1D', marginTop: 2 }}>
                {overdue.map(b => `${b.id} (${b.daysLeft <= 0 ? 'overdue' : `${b.daysLeft}d`})`).join(' · ')}
              </div>
            </div>
            <button className="btn btn-danger btn-sm">Escalate</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 18 }}>
        <button onClick={() => setStageFilter('all')} className={`stage-tile ${stageFilter === 'all' ? 'active' : ''}`}>
          <div style={{ fontSize: 11, color: '#64748B' }}>All stages</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0F172A' }}>{bids.length}</div>
        </button>
        {stages.map(s => (
          <button key={s.key} onClick={() => setStageFilter(s.key)} className={`stage-tile ${stageFilter === s.key ? 'active' : ''}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: STAGE_COLOR[s.key] || s.color }} />
              <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#0F172A' }}>{counts[s.key] || 0}</div>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">{visible.length} bids · {stageFilter === 'all' ? 'all stages' : stages.find(s => s.key === stageFilter)?.label}</div>
          <div style={{ fontSize: 11, color: '#64748B' }}>Sorted by deadline</div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Bid ID</th>
              <th>Client / RFP</th>
              <th>Value</th>
              <th>Stage</th>
              <th>Deadline</th>
              <th>Last Action</th>
              <th>Outcome</th>
              <th>Owner</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.sort((a, b) => a.daysLeft - b.daysLeft).map(b => {
              const stg = stages.find(s => s.key === b.stage);
              const owner = users[b.assigned];
              const isOverdue = b.daysLeft <= 2 && b.stage !== 'submitted' && !b.outcome;
              const la = b.lastAction;
              const outcome = b.outcome;
              const stageColor = STAGE_COLOR[b.stage] || stg.color;
              return (
                <tr key={b.id} onClick={() => onOpenBid(b)} style={{ cursor: 'pointer', background: isOverdue ? '#FEF2F2' : 'transparent' }}>
                  <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5, color: '#5929d0', fontWeight: 600 }}>{b.id}</td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{b.client}</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>{b.rfp}</div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{b.currency === 'GBP' ? '£' : '€'}{(b.value / 1000).toFixed(0)}k</td>
                  <td>
                    <span className="badge" style={{ background: stageColor + '22', color: stageColor, fontWeight: 600 }}>
                      {b.stage === 'compiling' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: stageColor, marginRight: 6, animation: 'pulse 1.4s infinite' }} />}
                      {stg.label}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isOverdue ? '#DC2626' : '#0F172A' }}>
                      {b.daysLeft < 0 ? `${-b.daysLeft}d ago` : `${b.daysLeft} days`}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#94A3B8' }}>{new Date(b.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                  </td>
                  <td>
                    {la ? (
                      <>
                        <div style={{ fontSize: 12, color: '#0F172A' }}>{la.what}</div>
                        <div style={{ fontSize: 10.5, color: '#94A3B8' }}>{la.who} · {relTime(la.when)}</div>
                      </>
                    ) : <span style={{ color: '#CBD5E1' }}>—</span>}
                  </td>
                  <td>
                    {outcome ? (
                      <span className={`badge ${outcome === 'Awarded' ? 'badge-success' : 'badge-error'}`} style={{ fontSize: 10.5 }}>
                        {outcome}
                      </span>
                    ) : <span style={{ color: '#CBD5E1' }}>—</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className={`user-avatar ${owner.avatarClass}`} style={{ width: 24, height: 24, fontSize: 10 }}>{owner.initials}</div>
                      <span style={{ fontSize: 11.5, color: '#475569' }}>{owner.name.split(' ')[0]}</span>
                    </div>
                  </td>
                  <td><span style={{ color: '#94A3B8' }}>›</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
