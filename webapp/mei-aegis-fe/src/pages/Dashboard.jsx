import React from 'react';
import { Icon } from '../components/ui/Icon';
import { MiniArea, BarPair, Donut, StackedBar, Sparkline } from '../components/charts';
import { fmtMoney, stageBadge } from '../utils/format';
import { useBids, useDashboardMetrics } from '../hooks/useApiData';
import { users } from '../utils/adapt';

function fmtMinutes(m) {
  if (!m) return '—';
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return h ? `${h}h ${min}m` : `${min}m`;
}

const SECTION_COLORS = {
  effort: '#5929d0', schedule: '#22D3EE', pricing: '#16A34A', quality: '#CF008B',
  deliverables: '#5929d0', risks: '#E4902E', dependencies: '#06B6D4', acceptance: '#94A3B8',
};

export function BidRow({ bid, onClick }) {
  const totalFlags = bid.flags.lowConf + bid.flags.conflicts + bid.flags.missingRate + bid.flags.highRisk;
  const urgent = bid.daysLeft <= 3 && bid.stage !== 'submitted';
  const owner  = users[bid.assigned];
  return (
    <tr onClick={onClick} style={{ cursor: 'pointer' }}>
      <td>
        <div style={{ fontWeight: 600, color: '#0F172A', fontSize: 13 }}>{bid.title}</div>
        <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'ui-monospace, monospace' }}>{bid.id}</div>
      </td>
      <td style={{ fontSize: 12, color: '#475569' }}>{bid.client}</td>
      <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#5929d0', whiteSpace: 'nowrap' }}>{bid.rfp}</td>
      <td>{stageBadge(bid.stage)}</td>
      <td>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{fmtMoney(bid.value, bid.currency)}</div>
        <div style={{ fontSize: 10, color: '#94A3B8' }}>{bid.currency}</div>
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 52, height: 4, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${(bid.sectionsComplete / bid.sectionsTotal) * 100}%`, height: '100%', background: '#5929d0' }} />
          </div>
          <span style={{ fontSize: 11, color: '#64748B' }}>{bid.sectionsComplete}/{bid.sectionsTotal}</span>
        </div>
      </td>
      <td>
        <div style={{ fontSize: 12, fontWeight: 700, color: urgent ? '#DC2626' : '#0F172A' }}>
          {bid.daysLeft < 0 ? `${-bid.daysLeft}d ago` : `${bid.daysLeft}d`}
        </div>
        <div style={{ fontSize: 10.5, color: '#94A3B8' }}>{new Date(bid.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
      </td>
      <td>
        {totalFlags === 0
          ? <span className="badge badge-success" style={{ fontSize: 10 }}>clean</span>
          : <span className="badge badge-warning" style={{ fontSize: 10 }}>{totalFlags} flag{totalFlags > 1 ? 's' : ''}</span>}
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className={`user-avatar ${owner.avatarClass}`} style={{ width: 22, height: 22, fontSize: 9 }}>{owner.initials}</div>
          <span style={{ fontSize: 11.5, color: '#475569' }}>{owner.name.split(' ')[0]}</span>
        </div>
      </td>
      <td style={{ color: '#94A3B8', fontSize: 14 }}>›</td>
    </tr>
  );
}

export default function Dashboard({ user, onOpenBid, onTabChange }) {
  const { bids, error: bidsErr }    = useBids();
  const { data: metrics, error: mErr } = useDashboardMetrics();
  const isDirector = user.id === 'director';

  if (bidsErr) return <div style={{ padding: 40, color: '#DC2626' }}>API error: {String(bidsErr)}</div>;
  if (!bids || !metrics) return <div style={{ padding: 40, color: '#94A3B8' }}>Loading dashboard…</div>;

  const myBids = bids.filter(b => b.assigned === user.id);

  const headline    = isDirector ? 'HIL Approval Queue' : 'Compilation Pipeline';
  const headlineSub = isDirector
    ? `${metrics.pending_approvals} bids awaiting your sign-off · ${bids.filter(b => b.daysLeft <= 5 && b.stage !== 'submitted').length} within 5 days of deadline`
    : `${metrics.active_compilations} bids in compilation · ${metrics.flag_mix.low_conf} low-confidence flags pending`;

  return (
    <div>
      <div className="page-banner">
        <div className="page-banner-dot" />
        <div className="page-banner-text">
          <div className="page-banner-title">{headline}</div>
          <div className="page-banner-sub">{headlineSub}</div>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn" onClick={() => onTabChange?.('pipeline')}>View pipeline</button>
          <button className="page-banner-btn primary" onClick={() => onTabChange?.(isDirector ? 'hil' : 'inputs')}>
            {isDirector ? 'Open HIL queue' : 'New compilation'}
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <KPI label="Active Pipeline Value"
          value={fmtMoney(metrics.active_pipeline_value)}
          tone="primary"
          sub={`${metrics.total_bids} total bids in book`}
          sparkData={metrics.weekly_series.value} />
        <KPI label={isDirector ? 'Pending Approvals' : 'Active Compilations'}
          value={isDirector ? metrics.pending_approvals : metrics.active_compilations}
          tone="pink"
          sub={`Avg cycle ${fmtMinutes(metrics.approval_cycle_minutes)}`} />
        <KPI label="Win Rate (8 weeks)"
          value={metrics.decided_count ? `${metrics.win_rate_pct}%` : '—'}
          tone="success"
          sub={`${metrics.win_count} of ${metrics.decided_count} decided`}
          sparkData={metrics.weekly_series.won} />
        <KPI label="HIL Override Rate"
          value={`${metrics.hil_override_rate_pct}%`}
          tone="warning"
          sub="Edited / (Edited + Approved)" />
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">{Icon.briefcase(14)} Submissions vs Wins</div>
              <div className="card-sub">Weekly · last 7 weeks · pipeline learning input</div>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#64748B' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="dot dot-primary" />Submitted</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="dot" style={{ background: '#CF008B' }} />Won</span>
            </div>
          </div>
          <div className="card-pad">
            <BarPair labels={metrics.weekly_series.weeks} a={metrics.weekly_series.submitted} b={metrics.weekly_series.won} />
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">{Icon.shield(14)} Compilation Accuracy</div>
              <div className="card-sub">Sections passing automated validation</div>
            </div>
          </div>
          <div className="card-pad" style={{ display: 'flex', alignItems: 'center', gap: 24, justifyContent: 'center' }}>
            <Donut value={Math.round(metrics.compilation_accuracy_pct)} total={100} color="#5929d0" label={`${Math.round(metrics.compilation_accuracy_pct)}%`} sub="all sections" />
            <div style={{ flex: 1 }}>
              {metrics.accuracy_per_section.map((row, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3, color: '#475569', fontWeight: 600 }}>
                    <span style={{ textTransform: 'capitalize' }}>{row.section}</span><span>{row.pct}%</span>
                  </div>
                  <div style={{ height: 5, background: '#F1F5F9', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${row.pct}%`, height: '100%', background: SECTION_COLORS[row.section] || '#5929d0', borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="dash-grid-3 mb-16">
        <div className="card">
          <div className="card-header"><div className="card-title">{Icon.clock(14)} Approval Cycle Time</div></div>
          <div className="card-pad">
            <div style={{ fontSize: 28, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.01em' }}>{fmtMinutes(metrics.approval_cycle_minutes)}</div>
            <div style={{ fontSize: 11.5, color: '#64748B', marginBottom: 10 }}>Median · compile → HIL sign-off</div>
            <MiniArea data={metrics.weekly_series.submitted.map(v => Math.max(v * 60, 60))} color="#5929d0" gradientId="g1" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94A3B8', marginTop: 4 }}>
              <span>{metrics.weekly_series.weeks[0]}</span><span>{metrics.weekly_series.weeks.at(-1)}</span>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title">{Icon.alert(14)} Flag Mix</div></div>
          <div className="card-pad">
            <div style={{ fontSize: 28, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.01em' }}>{metrics.flag_mix.total}</div>
            <div style={{ fontSize: 11.5, color: '#64748B', marginBottom: 14 }}>Open flags across active pipeline</div>
            <StackedBar segments={[
              { label: 'Low confidence',   value: metrics.flag_mix.low_conf,     color: '#5929d0' },
              { label: 'Schedule conflict',value: metrics.flag_mix.conflicts,    color: '#E4902E' },
              { label: 'Missing rate card',value: metrics.flag_mix.missing_rate, color: '#DC2626' },
              { label: 'High-rated risk',  value: metrics.flag_mix.high_risk,    color: '#CF008B' },
            ].filter(s => s.value > 0)} />
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title">{Icon.pound(14)} Pricing Variance</div></div>
          <div className="card-pad">
            <div style={{ fontSize: 28, fontWeight: 700, color: metrics.pricing_variance_pct >= 0 ? '#16A34A' : '#DC2626', letterSpacing: '-0.01em' }}>
              {metrics.pricing_variance_pct >= 0 ? '+' : ''}{metrics.pricing_variance_pct}%
            </div>
            <div style={{ fontSize: 11.5, color: '#64748B', marginBottom: 10 }}>Avg variance: compiled → approved value</div>
            <MiniArea data={metrics.weekly_series.value.map(v => Math.max(v / 100, 1))} color="#CF008B" gradientId="g2" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94A3B8', marginTop: 4 }}>
              <span>{metrics.weekly_series.weeks[0]}</span><span>{metrics.weekly_series.weeks.at(-1)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-16">
        <div className="card-header">
          <div>
            <div className="card-title">{isDirector ? 'My HIL Queue' : 'My Active Compilations'}</div>
            <div className="card-sub">{myBids.length} bids assigned to {user.name}</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onTabChange?.('pipeline')}>View all bids {Icon.arrow(11)}</button>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Bid / ID</th><th>Client</th><th>RFP Reference</th><th>Stage</th><th>Value</th><th>Sections</th><th>Deadline</th><th>Flags</th><th>Owner</th><th></th></tr>
          </thead>
          <tbody>
            {myBids.slice(0, 5).map(b => <BidRow key={b.id} bid={b} onClick={() => onOpenBid(b)} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KPI({ label, value, sub, tone = 'primary', trend, trendVal, sparkData }) {
  return (
    <div className={`kpi k-${tone === 'primary' ? '' : tone}`}>
      <div className="kpi-label">{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <div className="kpi-value">{value}</div>
        {sparkData && <div style={{ width: 80, opacity: 0.7 }}><Sparkline data={sparkData} color={tone === 'pink' ? '#CF008B' : tone === 'success' ? '#16A34A' : tone === 'warning' ? '#E4902E' : '#5929d0'} /></div>}
      </div>
      <div className="kpi-meta">
        {trend && <span className={`kpi-trend ${trend}`}>{trend === 'up' ? Icon.trendUp(11) : Icon.trendDown(11)} {trendVal}</span>}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}
