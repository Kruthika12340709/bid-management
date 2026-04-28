import React, { useState, useEffect } from 'react';
import { reportsApi } from '../api/client';
import { useBids } from '../hooks/useApiData';
import { stages } from '../utils/adapt';
import { downloadCSV } from '../utils/csv';

const REPORTS = [
  { id: 'R-01', name: 'Bid Pipeline Status Report',    desc: 'All active bids across pipeline stages, with submission deadlines and days remaining.', cadence: 'Live',    color: '#5929d0' },
  { id: 'R-02', name: 'Compilation Quality Report',    desc: 'Sections flagged during compilation, flag types by section, HIL override rate by section.',cadence: 'Weekly',  color: '#CF008B' },
  { id: 'R-03', name: 'Pricing Variance Report',       desc: 'Compiled vs approved price per bid, margin override frequency, pricing variance trends.',  cadence: 'Monthly', color: '#16A34A' },
  { id: 'R-04', name: 'Approval & Correction Report',  desc: 'Approval cycle time per bid, sections most frequently corrected, correction volume by reviewer.',cadence: 'Monthly', color: '#E4902E' },
  { id: 'R-05', name: 'Outcome & Conversion Report',   desc: 'Win/loss analysis: awarded, not awarded, pending. Winning price bands and outcome patterns.', cadence: 'Monthly', color: '#06B6D4' },
  { id: 'R-06', name: 'Risk Profile Report',           desc: 'Aggregated risk view: count by category and severity, mitigation coverage, High-rated risk %.',cadence: 'Monthly', color: '#DC2626' },
];

export default function Reports() {
  const [active, setActive] = useState('R-01');

  return (
    <div>
      <div className="page-banner" style={{ background: 'linear-gradient(90deg, #5929d0 0%, #CF008B 100%)' }}>
        <div className="page-banner-dot" />
        <div className="page-banner-text">
          <div className="page-banner-title">Reports & Analytics — R-01 through R-06</div>
          <div className="page-banner-sub">Live business intelligence — every number computed against the live Aiven database</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 18 }}>
        {REPORTS.map(r => (
          <div key={r.id} className="card" style={{ cursor: 'pointer', borderColor: active === r.id ? r.color : undefined, borderWidth: active === r.id ? 2 : 1 }}
            onClick={() => setActive(r.id)}>
            <div className="card-pad">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: r.color + '22', color: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11 }}>{r.id}</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', flex: 1 }}>{r.name}</div>
              </div>
              <div style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.55, minHeight: 50 }}>{r.desc}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTop: '1px solid #F1F5F9' }}>
                <span className="badge" style={{ background: r.color + '22', color: r.color, fontWeight: 600 }}>{r.cadence}</span>
                <span style={{ fontSize: 10.5, color: active === r.id ? r.color : '#94A3B8', fontWeight: active === r.id ? 700 : 400 }}>
                  {active === r.id ? 'Showing below ↓' : 'Click to view →'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {active === 'R-01' && <ReportR01 />}
      {active === 'R-02' && <ReportR02 />}
      {active === 'R-03' && <ReportR03 />}
      {active === 'R-04' && <ReportR04 />}
      {active === 'R-05' && <ReportR05 />}
      {active === 'R-06' && <ReportR06 />}
    </div>
  );
}

function useReport(fetcher, deps = []) {
  const [data, setData]   = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let alive = true;
    fetcher().then(d => { if (alive) setData(d); }).catch(e => { if (alive) setError(e); });
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error };
}

function ReportShell({ title, sub, children, error, data, csv }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">{title}</div>
          <div style={{ fontSize: 11, color: '#64748B' }}>{sub}</div>
        </div>
        <button className="btn btn-outline btn-sm" disabled={!csv} onClick={csv}>Export CSV</button>
      </div>
      <div className="card-pad">
        {error ? <div style={{ color: '#DC2626' }}>API error: {String(error)}</div>
          : !data ? <div style={{ color: '#94A3B8' }}>Loading…</div>
          : children}
      </div>
    </div>
  );
}

// ───── R-01 ────────────────────────────────────────────────────────────────
function ReportR01() {
  const { bids, error } = useBids();
  if (error) return <div className="card"><div className="card-pad" style={{ color: '#DC2626' }}>API error</div></div>;
  if (!bids) return <div className="card"><div className="card-pad" style={{ color: '#94A3B8' }}>Loading…</div></div>;
  return (
    <ReportShell title="R-01 · Bid Pipeline Status — Live"
      sub={`${bids.length} bids · grouped by stage`} data={bids}
      csv={() => downloadCSV(`R-01-pipeline-${new Date().toISOString().slice(0, 10)}.csv`, bids, [
        { key: 'id', label: 'Bid' }, { key: 'client', label: 'Client' }, { key: 'stage', label: 'Stage' },
        { key: 'value', label: 'Value' }, { key: 'currency', label: 'Currency' },
        { key: 'deadline', label: 'Deadline', format: v => v?.slice(0, 10) || '' },
        { key: 'daysLeft', label: 'Days Left' }, { key: 'outcome', label: 'Outcome' },
      ])}>
      {stages.map(s => {
        const list = bids.filter(b => b.stage === s.key);
        if (!list.length) return null;
        return (
          <div key={s.key} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{s.label}</span>
              <span style={{ fontSize: 11, color: '#64748B' }}>· {list.length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {list.map(b => (
                <div key={b.id} style={{ padding: '8px 12px', background: '#FAFBFD', border: '1px solid #E2E8F0', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: '#0F172A' }}>{b.client}</div>
                    <div style={{ fontSize: 10.5, color: '#64748B', fontFamily: 'ui-monospace, monospace' }}>{b.id}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: b.daysLeft <= 5 && b.stage !== 'submitted' ? '#DC2626' : '#0F172A' }}>{b.daysLeft < 0 ? `${-b.daysLeft}d ago` : `${b.daysLeft}d`}</div>
                    <div style={{ fontSize: 10.5, color: '#94A3B8' }}>{b.currency === 'GBP' ? '£' : '€'}{(b.value / 1000).toFixed(0)}k</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </ReportShell>
  );
}

// ───── R-02 ────────────────────────────────────────────────────────────────
function ReportR02() {
  const { data, error } = useReport(reportsApi.compilationQuality);
  return (
    <ReportShell title="R-02 · Compilation Quality"
      sub={data ? `${data.by_section.length} sections analysed across all bids` : ''} error={error} data={data}
      csv={data ? () => downloadCSV(`R-02-quality.csv`, data.by_section, [
        { key: 'section', label: 'Section' }, { key: 'total', label: 'Total' },
        { key: 'approved', label: 'Approved' }, { key: 'flagged', label: 'Flagged' },
        { key: 'returned', label: 'Returned' }, { key: 'avg_confidence', label: 'Avg Confidence' },
        { key: 'edits', label: 'Edits' }, { key: 'override_rate', label: 'Override Rate %' },
      ]) : null}>
      {data && (
        <table className="data-table">
          <thead><tr><th>Section</th><th>Total</th><th>Approved</th><th>Flagged</th><th>Returned</th><th>Avg Confidence</th><th>Edits</th><th>Override Rate</th></tr></thead>
          <tbody>
            {data.by_section.map(r => (
              <tr key={r.section}>
                <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>{r.section}</td>
                <td>{r.total}</td>
                <td>{r.approved}</td>
                <td>{r.flagged > 0 ? <span className="badge badge-warning" style={{ fontSize: 10 }}>{r.flagged}</span> : '0'}</td>
                <td>{r.returned > 0 ? <span className="badge badge-error" style={{ fontSize: 10 }}>{r.returned}</span> : '0'}</td>
                <td>{r.avg_confidence}</td>
                <td>{r.edits}</td>
                <td><strong style={{ color: r.override_rate > 30 ? '#DC2626' : r.override_rate > 10 ? '#E4902E' : '#16A34A' }}>{r.override_rate}%</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ReportShell>
  );
}

// ───── R-03 ────────────────────────────────────────────────────────────────
function ReportR03() {
  const { data, error } = useReport(reportsApi.pricingVariance);
  return (
    <ReportShell title="R-03 · Pricing Variance"
      sub={data ? `${data.bids.length} bids with both compiled & approved values` : ''} error={error} data={data}
      csv={data ? () => downloadCSV(`R-03-pricing-variance.csv`, data.bids, [
        { key: 'bid_reference', label: 'Bid' }, { key: 'client', label: 'Client' }, { key: 'currency', label: 'Currency' },
        { key: 'compiled_value', label: 'Compiled Value' }, { key: 'approved_value', label: 'Approved Value' },
        { key: 'variance_value', label: 'Variance' }, { key: 'variance_pct', label: 'Variance %' },
        { key: 'compiled_margin', label: 'Compiled Margin %' }, { key: 'approved_margin', label: 'Approved Margin %' },
        { key: 'outcome', label: 'Outcome' },
      ]) : null}>
      {data && (
        <table className="data-table">
          <thead><tr><th>Bid</th><th>Client</th><th>Compiled</th><th>Approved</th><th>Variance</th><th>Compiled Margin</th><th>Approved Margin</th><th>Outcome</th></tr></thead>
          <tbody>
            {data.bids.map(b => {
              const sym = b.currency === 'GBP' ? '£' : '€';
              return (
                <tr key={b.bid_reference}>
                  <td style={{ fontFamily: 'ui-monospace, monospace', color: '#5929d0', fontWeight: 600 }}>{b.bid_reference}</td>
                  <td>{b.client}</td>
                  <td>{sym}{(b.compiled_value / 1000).toFixed(0)}k</td>
                  <td>{sym}{(b.approved_value / 1000).toFixed(0)}k</td>
                  <td><strong style={{ color: b.variance_pct >= 0 ? '#16A34A' : '#DC2626' }}>{b.variance_pct >= 0 ? '+' : ''}{b.variance_pct}%</strong></td>
                  <td>{b.compiled_margin}%</td>
                  <td>{b.approved_margin}%</td>
                  <td>{b.outcome ? <span className={`badge ${b.outcome === 'Awarded' ? 'badge-success' : 'badge-error'}`} style={{ fontSize: 10 }}>{b.outcome}</span> : <span style={{ color: '#CBD5E1' }}>—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </ReportShell>
  );
}

// ───── R-04 ────────────────────────────────────────────────────────────────
function ReportR04() {
  const { data, error } = useReport(reportsApi.approvalCorrection);
  return (
    <ReportShell title="R-04 · Approval & Correction"
      sub={data ? `${data.bids.length} bids with approval cycles` : ''} error={error} data={data}
      csv={data ? () => downloadCSV(`R-04-approval.csv`, data.bids, [
        { key: 'bid_reference', label: 'Bid' }, { key: 'client', label: 'Client' }, { key: 'stage', label: 'Stage' },
        { key: 'cycle_minutes', label: 'Cycle (min)' }, { key: 'edits', label: 'Edits' },
        { key: 'approvals', label: 'Approvals' }, { key: 'rejections', label: 'Rejections' },
      ]) : null}>
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Approval cycle time per bid</div>
            <table className="data-table">
              <thead><tr><th>Bid</th><th>Client</th><th>Stage</th><th>Cycle</th><th>Edits</th><th>Approvals</th></tr></thead>
              <tbody>
                {data.bids.slice(0, 12).map(b => (
                  <tr key={b.bid_reference}>
                    <td style={{ fontFamily: 'ui-monospace, monospace', color: '#5929d0', fontWeight: 600, fontSize: 11 }}>{b.bid_reference}</td>
                    <td style={{ fontSize: 11 }}>{b.client}</td>
                    <td><span className="badge badge-neutral" style={{ fontSize: 9 }}>{b.stage}</span></td>
                    <td>{b.cycle_minutes ? `${Math.floor(b.cycle_minutes / 60)}h ${Math.round(b.cycle_minutes % 60)}m` : '—'}</td>
                    <td>{b.edits}</td>
                    <td>{b.approvals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Most-corrected sections</div>
            <table className="data-table">
              <thead><tr><th>Section</th><th>Edits</th><th>Rejections</th></tr></thead>
              <tbody>
                {data.section_corrections.map(s => (
                  <tr key={s.section}>
                    <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>{s.section}</td>
                    <td>{s.edits > 0 ? <span className="badge badge-pink" style={{ fontSize: 10 }}>{s.edits}</span> : '0'}</td>
                    <td>{s.rejections > 0 ? <span className="badge badge-error" style={{ fontSize: 10 }}>{s.rejections}</span> : '0'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', margin: '20px 0 8px' }}>Reviewer activity</div>
            <table className="data-table">
              <thead><tr><th>Reviewer</th><th>Role</th><th>Actions</th></tr></thead>
              <tbody>
                {data.reviewer_volume.map((r, i) => (
                  <tr key={i}>
                    <td>{r.reviewer}</td>
                    <td><span className={`badge ${r.role === 'Director' ? 'badge-pink' : 'badge-primary'}`} style={{ fontSize: 10 }}>{r.role}</span></td>
                    <td><strong>{r.actions}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ReportShell>
  );
}

// ───── R-05 ────────────────────────────────────────────────────────────────
function ReportR05() {
  const { data, error } = useReport(reportsApi.outcomes);
  return (
    <ReportShell title="R-05 · Outcome & Conversion"
      sub={data ? `${data.by_outcome.reduce((s, o) => s + o.count, 0)} bids with recorded outcomes` : ''} error={error} data={data}
      csv={data ? () => downloadCSV(`R-05-outcomes.csv`, data.by_value_band, [
        { key: 'band', label: 'Value Band' }, { key: 'won', label: 'Won' },
        { key: 'lost', label: 'Lost' }, { key: 'total', label: 'Total' },
      ]) : null}>
      {data && (
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            {data.by_outcome.map(o => (
              <div key={o.outcome} className="card" style={{ background: o.outcome === 'Awarded' ? '#F0FDF4' : '#FEF2F2' }}>
                <div className="card-pad">
                  <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>{o.outcome}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: o.outcome === 'Awarded' ? '#16A34A' : '#DC2626' }}>{o.count}</div>
                  <div style={{ fontSize: 11.5, color: '#475569' }}>Total value: £{Math.round(o.total_value / 1000)}k · Avg: £{Math.round(o.avg_value / 1000)}k</div>
                </div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Win rate by value band</div>
            <table className="data-table">
              <thead><tr><th>Band</th><th>Won</th><th>Lost</th><th>Total</th><th>Win Rate</th></tr></thead>
              <tbody>
                {data.by_value_band.map(b => (
                  <tr key={b.band}>
                    <td><strong>{b.band}</strong></td>
                    <td>{b.won}</td>
                    <td>{b.lost}</td>
                    <td>{b.total}</td>
                    <td><strong style={{ color: '#16A34A' }}>{(b.won / b.total * 100).toFixed(1)}%</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Top clients by outcome</div>
            <table className="data-table">
              <thead><tr><th>Client</th><th>Won</th><th>Lost</th></tr></thead>
              <tbody>
                {data.by_client.map((c, i) => (
                  <tr key={i}><td>{c.client}</td><td>{c.won > 0 ? <span style={{ color: '#16A34A', fontWeight: 700 }}>{c.won}</span> : '0'}</td><td>{c.lost > 0 ? <span style={{ color: '#DC2626' }}>{c.lost}</span> : '0'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ReportShell>
  );
}

// ───── R-06 ────────────────────────────────────────────────────────────────
function ReportR06() {
  const { data, error } = useReport(reportsApi.riskProfile);
  return (
    <ReportShell title="R-06 · Risk Profile"
      sub={data ? `${data.by_severity.reduce((s, x) => s + x.total, 0)} risks across the active book` : ''} error={error} data={data}
      csv={data ? () => downloadCSV(`R-06-risks.csv`, data.high_unacked, [
        { key: 'bid_reference', label: 'Bid' }, { key: 'risk_ref', label: 'Risk ID' },
        { key: 'description', label: 'Description' }, { key: 'owner', label: 'Owner' },
      ]) : null}>
      {data && (
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {data.by_severity.map(s => {
              const c = s.severity === 'High' ? '#DC2626' : s.severity === 'Medium' ? '#E4902E' : '#16A34A';
              return (
                <div key={s.severity} className="card">
                  <div className="card-pad">
                    <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.severity} severity</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: c }}>{s.total}</div>
                    <div style={{ fontSize: 11.5, color: '#475569' }}>{s.acked} ack'd · {s.has_owner} with owner · {s.ack_rate}% ack rate</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>By category</div>
            <table className="data-table">
              <thead><tr><th>Category</th><th>Total</th><th>High-rated</th></tr></thead>
              <tbody>
                {data.by_category.map(c => (
                  <tr key={c.category}>
                    <td>{c.category}</td>
                    <td>{c.total}</td>
                    <td>{c.high > 0 ? <span className="badge badge-error" style={{ fontSize: 10 }}>{c.high}</span> : '0'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.high_unacked.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', marginBottom: 8 }}>High-severity risks awaiting acknowledgement (BR-005)</div>
              <table className="data-table">
                <thead><tr><th>Bid</th><th>Risk</th><th>Description</th><th>Owner</th></tr></thead>
                <tbody>
                  {data.high_unacked.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'ui-monospace, monospace', color: '#5929d0', fontWeight: 600 }}>{r.bid_reference}</td>
                      <td>{r.risk_ref}</td>
                      <td>{r.description}</td>
                      <td>{r.owner || <span className="badge badge-error" style={{ fontSize: 10 }}>missing</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </ReportShell>
  );
}
