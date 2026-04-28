import React, { useState, useEffect } from 'react';
import { Icon } from '../components/ui/Icon';
import { useBids } from '../hooks/useApiData';
import { bidsApi } from '../api/client';
import Pagination from '../components/ui/Pagination';

const COMPILE_PAGE_SIZE = 10;

const SECTION_STATUS = {
  approved: { bg: '#DCFCE7', fg: '#16A34A', label: 'Complete' },
  complete: { bg: '#DCFCE7', fg: '#16A34A', label: 'Complete' },
  flagged:  { bg: '#FEF3C7', fg: '#92400E', label: 'Flagged'  },
  pending:  { bg: '#E8E5FF', fg: '#5929d0', label: 'Pending'  },
  returned: { bg: '#FEE2E2', fg: '#DC2626', label: 'Returned' },
};

const STAGE_STYLE = {
  compiling:  { bg: '#DBEAFE', fg: '#1D4ED8' },
  pending:    { bg: '#FEF3C7', fg: '#92400E' },
  approved:   { bg: '#DCFCE7', fg: '#16A34A' },
  submitted:  { bg: '#F0FDF4', fg: '#15803D' },
  validating: { bg: '#F1F5F9', fg: '#64748B' },
};

const COMPILED_STAGES = new Set(['compiling']);

function fmtDuration(seconds) {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

function ProgressBar({ done, total }) {
  const pct   = total ? Math.round((done / total) * 100) : 0;
  const color = pct === 100 ? '#16A34A' : pct > 50 ? '#2563EB' : '#F59E0B';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: '#E2E8F0', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 36 }}>{done}/{total}</span>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#0F172A' }}>{value}</div>
    </div>
  );
}

// ─── Screen 1: All compiled bids ──────────────────────────────────────────────
function BidList({ bids, onSelect }) {
  const compiledBids = bids.filter(b => COMPILED_STAGES.has(b.stage));
  const [page, setPage] = useState(1);
  const paginated = compiledBids.slice((page - 1) * COMPILE_PAGE_SIZE, page * COMPILE_PAGE_SIZE);

  if (compiledBids.length === 0) {
    return (
      <div className="card">
        <div className="card-pad" style={{ color: '#94A3B8', textAlign: 'center', padding: 32 }}>
          No bids currently compiling. Trigger compilation from <strong>Input Validation</strong>.
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Compiled Bids</div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
            {compiledBids.length} bid{compiledBids.length !== 1 ? 's' : ''} currently compiling · click a row to view section status
          </div>
        </div>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Bid ID</th>
            <th>Client</th>
            <th>Stage</th>
            <th style={{ minWidth: 160 }}>Section Progress</th>
            <th>Win Prob</th>
            <th>Flags</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {paginated.map(b => {
            const stageSt = STAGE_STYLE[b.stage] || { bg: '#F1F5F9', fg: '#64748B' };
            const done    = b.sectionsComplete ?? 0;
            const total   = b.sectionsTotal ?? 8;
            const flags   = b.flagCount || 0;

            return (
              <tr
                key={b.id}
                onClick={() => onSelect(b)}
                style={{ cursor: 'pointer' }}
                className="hover-row"
              >
                <td><span style={{ fontWeight: 700, color: '#5929d0', fontSize: 12 }}>{b.id}</span></td>
                <td style={{ fontSize: 12 }}>{b.client}</td>
                <td>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: stageSt.bg, color: stageSt.fg, textTransform: 'uppercase' }}>
                    {b.stage}
                  </span>
                </td>
                <td><ProgressBar done={done} total={total} /></td>
                <td style={{ fontSize: 12, fontWeight: 600, color: (b.winProb || 0) >= 0.75 ? '#16A34A' : '#D97706' }}>
                  {b.winProb ? `${Math.round(b.winProb * 100)}%` : '—'}
                </td>
                <td>
                  {flags > 0
                    ? <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706' }}>⚑ {flags}</span>
                    : <span style={{ fontSize: 11, color: '#94A3B8' }}>—</span>}
                </td>
                <td style={{ color: '#94A3B8', fontSize: 13 }}>›</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination total={compiledBids.length} page={page} pageSize={COMPILE_PAGE_SIZE} onChange={setPage} />
    </div>
  );
}

// ─── Screen 2: Section detail for one bid ─────────────────────────────────────
function BidDetail({ bid, onBack, onOpenBid, user, refresh }) {
  const isManager = user.id === 'manager';
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [busy, setBusy]           = useState(false);
  const [toast, setToast]         = useState(null);

  useEffect(() => {
    setLoading(true);
    bidsApi.getCompilationTelemetry(bid.id)
      .then(t => setTelemetry(t))
      .catch(() => setTelemetry(null))
      .finally(() => setLoading(false));
  }, [bid.id]);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 2400); return () => clearTimeout(t); }
  }, [toast]);

  async function routeToDirector() {
    setBusy(true);
    try {
      await bidsApi.routeToDirector(bid.id, {
        performed_by: user.name, role: 'Manager',
        note: 'Compilation complete — routed to Director for HIL approval',
      });
      setToast(`${bid.id} routed to Director`);
      refresh();
      onBack();
    } catch (e) { setToast(`Error: ${e.response?.data?.detail || e.message}`); }
    finally { setBusy(false); }
  }

  const sections     = telemetry?.sections || [];
  const doneCount    = sections.filter(s => s.status === 'approved' || s.status === 'complete').length;
  const pendingCount = sections.filter(s => s.status === 'pending').length;
  const flaggedCount = sections.filter(s => s.status === 'flagged').length;
  const allClear     = sections.length > 0 && pendingCount === 0;

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#0F172A', color: '#fff', padding: '10px 16px', borderRadius: 10, fontSize: 12, zIndex: 2000, boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
          {toast}
        </div>
      )}

      {/* Banner */}
      <div className="page-banner" style={{ background: 'linear-gradient(90deg, #06B6D4 0%, #5929d0 100%)' }}>
        <div className="page-banner-dot" />
        <div className="page-banner-text">
          <div className="page-banner-title">Bid Compilation · {bid.id}</div>
          <div className="page-banner-sub">{bid.client} · live telemetry from bid_sections · BR-002</div>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn" onClick={onBack}>← All Bids</button>
          <button className="page-banner-btn" onClick={() => onOpenBid(bid)}>Open bid</button>
          {bid.stage === 'compiling' && isManager && (
            <button
              className="page-banner-btn primary"
              disabled={!allClear || busy}
              onClick={routeToDirector}
              style={{ opacity: !allClear || busy ? 0.55 : 1 }}
              title={!allClear ? 'Sections still pending' : ''}
            >
              Route to Director {Icon.arrow(11)}
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ padding: 32, color: '#94A3B8', textAlign: 'center' }}>Loading sections…</div>
      )}

      {!loading && telemetry && (
        <>
          {/* Telemetry metrics */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-header">
              <div className="card-title">Compilation Telemetry</div>
              <span className={`badge ${allClear ? 'badge-success' : 'badge-primary'}`}>
                {allClear ? `Complete · ${doneCount}/${sections.length}` : `Live · ${doneCount}/${sections.length}`}
              </span>
            </div>
            <div style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              <Metric label="Elapsed"          value={fmtDuration(telemetry.elapsed_seconds)} />
              <Metric label="Sources merged"   value={`${telemetry.sources_merged} / ${telemetry.sources_total}`} />
              <Metric label="Confidence (avg)" value={telemetry.avg_confidence ? telemetry.avg_confidence.toFixed(2) : '—'} />
              <Metric label="Flags raised"     value={String(telemetry.flags_raised)} />
            </div>
            <div style={{ padding: '0 20px 16px' }}>
              <ProgressBar done={doneCount} total={sections.length || 8} />
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 10.5 }}>
                <span style={{ color: '#16A34A', fontWeight: 600 }}>✓ {doneCount} complete</span>
                {flaggedCount > 0 && <span style={{ color: '#92400E', fontWeight: 600 }}>⚑ {flaggedCount} flagged</span>}
                {pendingCount > 0 && <span style={{ color: '#5929d0', fontWeight: 600 }}>◷ {pendingCount} pending</span>}
              </div>
            </div>
          </div>

          {/* Section cards */}
          <div style={{ display: 'grid', gap: 10 }}>
            {sections.map((s, i) => {
              const st = SECTION_STATUS[s.status] || { bg: '#F1F5F9', fg: '#475569', label: s.status };
              return (
                <div key={s.key} className="card">
                  <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="section-card-num">{i + 1}</div>
                      <div>
                        <div className="card-title">{s.name}</div>
                        <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                          Source: <strong style={{ color: '#475569' }}>{s.source_module}</strong>
                          {' · '}Input version <strong style={{ color: '#475569' }}>{s.input_version}</strong>
                          {' · '}Confidence{' '}
                          <strong style={{ color: (s.confidence || 0) >= 0.75 ? '#16A34A' : '#D97706' }}>
                            {s.confidence?.toFixed(2) || '—'}
                          </strong>
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '4px 10px', borderRadius: 4, background: st.bg, color: st.fg, textTransform: 'uppercase' }}>
                      {st.label}
                    </span>
                  </div>
                  {s.flags?.length > 0 && (
                    <div className="card-pad">
                      {s.flags.map((f, idx) => (
                        <div key={idx} className="flag-row" style={{ marginBottom: idx < s.flags.length - 1 ? 6 : 0 }}>
                          {Icon.flag(13)} {typeof f === 'string' ? f : JSON.stringify(f)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Root: switches between Screen 1 and Screen 2 ─────────────────────────────
export default function Compilation({ user, onOpenBid }) {
  const { bids, error, refresh } = useBids();
  const [selectedBid, setSelectedBid] = useState(null);

  if (error) return <div style={{ padding: 40, color: '#DC2626' }}>API error: {String(error)}</div>;
  if (!bids) return <div style={{ padding: 40, color: '#94A3B8' }}>Loading…</div>;

  if (selectedBid) {
    return (
      <BidDetail
        bid={selectedBid}
        onBack={() => setSelectedBid(null)}
        onOpenBid={onOpenBid}
        user={user}
        refresh={refresh}
      />
    );
  }

  return (
    <>
      <div className="page-banner" style={{ background: 'linear-gradient(90deg, #06B6D4 0%, #5929d0 100%)' }}>
        <div className="page-banner-dot" />
        <div className="page-banner-text">
          <div className="page-banner-title">Bid Compilation</div>
          <div className="page-banner-sub">Bids actively compiling · click a bid to view section status · BR-002</div>
        </div>
      </div>
      <BidList bids={bids} onSelect={setSelectedBid} />
    </>
  );
}
