import React, { useState, useEffect } from 'react';
import { Icon } from '../components/ui/Icon';
import { bidsApi, hilApi } from '../api/client';

const FOCUSED_BID = 'BID-2026-041';

export default function RiskPanel({ user }) {
  const isDirector = user.id === 'director';
  const [risks, setRisks]   = useState(null);
  const [error, setError]   = useState(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy]     = useState(false);
  const [toast, setToast]   = useState(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    bidsApi.getRisks(FOCUSED_BID)
      .then(rows => { if (alive) setRisks(rows); })
      .catch(e   => { if (alive) setError(e); });
    return () => { alive = false; };
  }, [reload]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 2400); return () => clearTimeout(t); } }, [toast]);

  if (error) return <div style={{ padding: 40, color: '#DC2626' }}>API error: {String(error)}</div>;
  if (!risks) return <div style={{ padding: 40, color: '#94A3B8' }}>Loading risks…</div>;

  const high = risks.filter(r => r.severity === 'High');
  const med  = risks.filter(r => r.severity === 'Medium');
  const low  = risks.filter(r => r.severity === 'Low');
  const sevColor = { High: '#DC2626', Medium: '#E4902E', Low: '#16A34A' };

  async function ack(riskRef) {
    setBusy(true);
    try {
      await hilApi.acknowledgeRisk(FOCUSED_BID, riskRef, { performed_by: user.name });
      setToast(`${riskRef} acknowledged`);
      setReload(n => n + 1);
    } catch (e) { setToast(`Error: ${e.response?.data?.detail || e.message}`); }
    finally { setBusy(false); }
  }

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#0F172A', color: '#fff', padding: '10px 16px', borderRadius: 10, fontSize: 12, zIndex: 2000, boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
          {toast}
        </div>
      )}

      <div className="page-banner" style={{ background: 'linear-gradient(90deg, #DC2626 0%, #5929d0 100%)' }}>
        <div className="page-banner-dot" />
        <div className="page-banner-text">
          <div className="page-banner-title">Risk & Dependency Review</div>
          <div className="page-banner-sub">BR-005 · High-rated risks must be explicitly acknowledged before approval · {FOCUSED_BID}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
        {[['High', high, '#DC2626'], ['Medium', med, '#E4902E'], ['Low', low, '#16A34A']].map(([lbl, list, c]) => (
          <div key={lbl} className="card">
            <div className="card-pad">
              <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>{lbl} severity</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: c, letterSpacing: '-0.01em' }}>{list.length}</div>
              <div style={{ fontSize: 11.5, color: '#64748B' }}>{list.filter(r => r.acknowledged).length} acknowledged · {list.filter(r => !r.acknowledged).length} pending</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Risk register · {risks.length} risks</div>
          <span style={{ fontSize: 11, color: '#64748B' }}>3 external dependencies linked</span>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>ID</th><th>Description</th><th>Category</th><th>Sev</th><th>Mitigation</th><th>Owner</th><th>Ack</th></tr>
          </thead>
          <tbody>
            {risks.map(r => (
              <tr key={r.risk_id}>
                <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5, color: '#5929d0', fontWeight: 600 }}>{r.risk_ref}</td>
                <td>{r.description}</td>
                <td><span style={{ fontSize: 11, color: '#475569' }}>{r.category}</span></td>
                <td><span className="badge" style={{ background: sevColor[r.severity] + '22', color: sevColor[r.severity], fontWeight: 600 }}>{r.severity}</span></td>
                <td style={{ fontSize: 11.5, color: '#475569' }}>{r.mitigation}</td>
                <td>{!r.owner
                  ? <span style={{ color: '#DC2626', fontWeight: 600, fontSize: 11 }}>Missing</span>
                  : <span style={{ fontSize: 11.5 }}>{r.owner}</span>}
                </td>
                <td>{r.acknowledged
                  ? <span className="badge badge-success">{Icon.check(10)} ack'd</span>
                  : (r.severity === 'High'
                    ? (isDirector
                      ? <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => ack(r.risk_ref)}>Ack BR-005</button>
                      : <span style={{ fontSize: 10.5, color: '#94A3B8' }}>Director only</span>)
                    : <span style={{ fontSize: 10.5, color: '#94A3B8' }}>—</span>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
