import React, { useState, useEffect } from 'react';
import { Icon } from '../components/ui/Icon';
import { useBids } from '../hooks/useApiData';
import { bidsApi } from '../api/client';

const STATUS_STYLE = {
  approved:   { bg: '#DCFCE7', fg: '#16A34A', label: 'Complete'   },
  complete:   { bg: '#DCFCE7', fg: '#16A34A', label: 'Complete'   },
  flagged:    { bg: '#FEF3C7', fg: '#92400E', label: 'Flagged'    },
  pending:    { bg: '#E8E5FF', fg: '#5929d0', label: 'Pending'    },
  returned:   { bg: '#FEE2E2', fg: '#DC2626', label: 'Returned'   },
};

function fmtDuration(seconds) {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

export default function Compilation({ user, onOpenBid }) {
  const isManager = user.id === 'manager';
  const { bids, error: bidsErr, refresh } = useBids();
  const [telemetry, setTelemetry] = useState(null);
  const [tlError, setTlError]     = useState(null);
  const [busy, setBusy]   = useState(false);
  const [toast, setToast] = useState(null);

  const compiling = bids?.find(b => b.stage === 'compiling') || bids?.[0];

  useEffect(() => {
    if (!compiling) return;
    let alive = true;
    bidsApi.getCompilationTelemetry(compiling.id)
      .then(t => { if (alive) setTelemetry(t); })
      .catch(e => { if (alive) setTlError(e); });
    return () => { alive = false; };
  }, [compiling?.id]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 2400); return () => clearTimeout(t); } }, [toast]);

  if (bidsErr) return <div style={{ padding: 40, color: '#DC2626' }}>API error: {String(bidsErr)}</div>;
  if (!bids)   return <div style={{ padding: 40, color: '#94A3B8' }}>Loading…</div>;

  async function routeToDirector() {
    if (!compiling) return;
    setBusy(true);
    try {
      await bidsApi.routeToDirector(compiling.id, {
        performed_by: user.name, role: 'Manager',
        note: 'Compilation complete — routed to Director for HIL approval',
      });
      setToast(`${compiling.id} routed to Director`);
      refresh();
    } catch (e) { setToast(`Error: ${e.response?.data?.detail || e.message}`); }
    finally { setBusy(false); }
  }

  const sections      = telemetry?.sections || [];
  const incomplete    = sections.filter(s => s.status === 'pending');
  const allClear      = sections.length > 0 && incomplete.length === 0;
  const approvedCount = sections.filter(s => s.status === 'approved' || s.status === 'complete').length;

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#0F172A', color: '#fff', padding: '10px 16px', borderRadius: 10, fontSize: 12, zIndex: 2000, boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
          {toast}
        </div>
      )}

      <div className="page-banner" style={{ background: 'linear-gradient(90deg, #06B6D4 0%, #5929d0 100%)' }}>
        <div className="page-banner-dot" />
        <div className="page-banner-text">
          <div className="page-banner-title">Bid Compilation · {compiling?.id || '—'}</div>
          <div className="page-banner-sub">{compiling?.client || ''} · live telemetry from bid_sections · BR-002</div>
        </div>
        <div className="page-banner-actions">
          {compiling && <button className="page-banner-btn" onClick={() => onOpenBid(compiling)}>Open bid</button>}
          {compiling && (
            <button
              className="page-banner-btn primary"
              disabled={!allClear || !isManager || busy}
              onClick={routeToDirector}
              title={!isManager ? 'Bid Manager only' : !allClear ? 'Sections still pending' : ''}
              style={{ opacity: !allClear || !isManager || busy ? 0.55 : 1 }}
            >
              Route to Director {Icon.arrow(11)}
            </button>
          )}
        </div>
      </div>

      {!compiling && (
        <div className="card"><div className="card-pad" style={{ color: '#94A3B8', textAlign: 'center', padding: 32 }}>
          No bids currently in <code>compiling</code> stage. Trigger a compilation from <strong>Input Validation</strong>.
        </div></div>
      )}

      {tlError && (
        <div className="card" style={{ marginBottom: 14, background: '#FEF2F2' }}>
          <div className="card-pad" style={{ color: '#991B1B', fontSize: 12 }}>Could not load telemetry: {String(tlError)}</div>
        </div>
      )}

      {compiling && telemetry && (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-header">
              <div className="card-title">Compilation telemetry</div>
              <span className="badge badge-success">Live · {approvedCount}/{sections.length}</span>
            </div>
            <div style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              <Metric label="Elapsed"          value={fmtDuration(telemetry.elapsed_seconds)} />
              <Metric label="Sources merged"   value={`${telemetry.sources_merged} / ${telemetry.sources_total}`} />
              <Metric label="Confidence (avg)" value={telemetry.avg_confidence ? telemetry.avg_confidence.toFixed(2) : '—'} />
              <Metric label="Flags raised"     value={String(telemetry.flags_raised)} />
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {sections.map((s, i) => {
              const st = STATUS_STYLE[s.status] || { bg: '#F1F5F9', fg: '#475569', label: s.status };
              return (
                <div key={s.key} className="card">
                  <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="section-card-num">{i + 1}</div>
                      <div>
                        <div className="card-title">{s.name}</div>
                        <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                          Source: <strong style={{ color: '#475569' }}>{s.source_module}</strong> · Input version <strong style={{ color: '#475569' }}>{s.input_version}</strong> · Confidence {s.confidence?.toFixed(2) || '—'}
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

function Metric({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#0F172A' }}>{value}</div>
    </div>
  );
}
