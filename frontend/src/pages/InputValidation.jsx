import React, { useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { useInputs } from '../hooks/useApiData';
import { inputsApi } from '../api/client';

const STATUS = {
  received:  { bg: '#DCFCE7', fg: '#16A34A', row: 'transparent', label: 'Received' },
  missing:   { bg: '#FEE2E2', fg: '#DC2626', row: '#FFFBEB',     label: 'Missing' },
  malformed: { bg: '#FFE4E6', fg: '#BE123C', row: '#FFFBEB',     label: 'Malformed' },
};

export default function InputValidation({ user }) {
  const isManager = user.id === 'manager';
  const { data, error, refresh } = useInputs();
  const [requested, setRequested] = useState({});
  const [busy, setBusy]           = useState(false);
  const [toast, setToast]         = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [jsonText, setJsonText]   = useState('');
  const [validationError, setValidationError] = useState('');
  const [isValid, setIsValid]     = useState(false);

  React.useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  function validateJson() {
    try {
      const data = JSON.parse(jsonText);
      if (!data.rfp_id || !data.modules) {
        setValidationError('Missing rfp_id or modules');
        setIsValid(false);
        return;
      }
      setValidationError('');
      setIsValid(true);
    } catch (e) {
      setValidationError('Invalid JSON');
      setIsValid(false);
    }
  }

  async function startCompilation() {
    try {
      const data = JSON.parse(jsonText);
      await inputsApi.createFromJson(data);
      setToast('Started compiling');
      refresh();
      setShowPopup(false);
      setJsonText('');
      setIsValid(false);
    } catch (e) {
      const errMsg = e.response?.data?.detail || e.message || 'Unknown error';
      setToast(`Error: ${errMsg}`);
    }
  }

  if (error) return <div style={{ padding: 40, color: '#DC2626' }}>API error: {String(error)}</div>;
  if (!data) return <div style={{ padding: 40, color: '#94A3B8' }}>Loading inputs…</div>;

  async function requestMissing(rfpId, category) {
    const key = `${rfpId}:${category}`;
    setRequested(prev => ({ ...prev, [key]: true }));
    try {
      await inputsApi.requestMissing(rfpId, category);
      setToast(`Request sent to upstream for '${category}'`);
    } catch (e) { setToast(`Error: ${e.message}`); }
  }

  async function confirmCompilation(rfpId) {
    setBusy(true);
    try {
      const res = await inputsApi.confirmCompilation(rfpId);
      setToast(`Compilation triggered → ${res.bid_reference} created (stage: ${res.stage})`);
      refresh();
    } catch (e) {
      setToast(`Error: ${e.response?.data?.detail || e.message}`);
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="page-banner" style={{ background: 'linear-gradient(90deg, #06B6D4 0%, #5929d0 60%, #CF008B 100%)' }}>
        <div className="page-banner-dot" />
        <div className="page-banner-text" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="page-banner-title">Input Validation Dashboard</div>
            <div className="page-banner-sub">8 input categories must be Received before compilation can start · BR-001</div>
          </div>
          <button onClick={() => setShowPopup(true)} className="btn btn-primary btn-sm" title="Add new RFP from JSON">{Icon.plus(14)} Add RFP</button>
        </div>
      </div>

      {data.length === 0 && (
        <div className="card"><div className="card-pad" style={{ color: '#94A3B8', textAlign: 'center', padding: 32 }}>
          No RFPs in <code>rfp_module</code>. Insert a row in Aiven to see input validation status.
        </div></div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#0F172A', color: '#fff', padding: '10px 16px', borderRadius: 10, fontSize: 12, zIndex: 2000, boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
          {toast}
        </div>
      )}

      {showPopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '500px', maxHeight: '80vh', overflow: 'auto' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>Add RFP from JSON</div>
              <button onClick={() => setShowPopup(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div className="card-pad">
              <textarea
                value={jsonText}
                onChange={e => setJsonText(e.target.value)}
                placeholder="Paste JSON here"
                style={{ width: '100%', height: '200px', fontFamily: 'monospace' }}
              />
              <div style={{ marginTop: 10 }}>
                <button onClick={validateJson} className="btn btn-secondary btn-sm">Validate</button>
                {validationError && <span style={{ color: '#DC2626', marginLeft: 10 }}>{validationError}</span>}
                {isValid && <span style={{ color: '#16A34A', marginLeft: 10 }}>Everything is correct</span>}
              </div>
              {isValid && (
                <div style={{ marginTop: 10 }}>
                  <button onClick={startCompilation} className="btn btn-primary btn-sm">Start Compilation</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {data.map(b => {
        const blockers = b.inputs.filter(i => i.status !== 'received');
        const ready = blockers.length === 0;
        const alreadyCompiled = !!b.compiled_bid_ref;
        return (
          <div key={b.rfp_id} className="card" style={{ marginBottom: 18 }}>
            <div className="card-header">
              <div>
                <div className="card-title">{b.client} · {b.rfp_id}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>
                  {b.title} · {b.inputs.filter(i => i.status === 'received').length}/{b.inputs.length} received
                  {blockers.length > 0 && ` · ${blockers.length} blocker${blockers.length > 1 ? 's' : ''}`}
                </div>
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* MVP state badge */}
                {alreadyCompiled ? (
                  <span className="badge badge-success">{Icon.check(11)} Compiled → {b.compiled_bid_ref} ({b.compiled_bid_stage})</span>
                ) : (
                  <>
                    <span className={`badge ${ready ? 'badge-cyan' : 'badge-neutral'}`} style={{ fontWeight: 700 }}>
                      {ready ? 'Inputs Ready' : 'Awaiting Inputs'}
                    </span>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={!ready || !isManager || busy}
                      onClick={() => confirmCompilation(b.rfp_id)}
                      title={!ready ? `Blocked by: ${blockers.map(x => x.category).join(', ')}` : !isManager ? 'Bid Manager only' : ''}
                      style={{ opacity: !ready || !isManager || busy ? 0.55 : 1, cursor: !ready || !isManager || busy ? 'not-allowed' : 'pointer' }}
                    >
                      {Icon.check(11)} Confirm Compilation
                    </button>
                  </>
                )}
              </div>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Upstream Module</th>
                  <th>Input Category</th>
                  <th>Status</th>
                  <th>Last Received</th>
                  <th style={{ width: 180 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {b.inputs.map((i, idx) => {
                  const st = STATUS[i.status];
                  const key = `${b.rfp_id}:${i.category}`;
                  const reqSent = requested[key];
                  const tsDisplay = i.ts ? new Date(i.ts).toISOString().slice(0, 16).replace('T', ' ') : '—';
                  return (
                    <tr key={idx} style={{ background: st.row }}>
                      <td style={{ fontWeight: 500 }}>{i.module}</td>
                      <td>{i.category}</td>
                      <td>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: st.bg, color: st.fg, textTransform: 'uppercase' }}>
                          {st.label}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: !i.ts ? '#CBD5E1' : '#475569' }}>{tsDisplay}</td>
                      <td>
                        {i.status === 'received' ? (
                          <span style={{ fontSize: 11, color: '#94A3B8' }}>—</span>
                        ) : reqSent ? (
                          <span className="badge badge-primary" style={{ fontSize: 10 }}>{Icon.check(9)} Request sent</span>
                        ) : isManager ? (
                          <button className="btn btn-outline btn-sm" onClick={() => requestMissing(b.rfp_id, i.category)}>
                            Request Missing Data
                          </button>
                        ) : (
                          <span style={{ fontSize: 10.5, color: '#94A3B8' }}>Manager only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!ready && (
              <div style={{ padding: '10px 20px', background: '#FFFBEB', borderTop: '1px solid #FCD34D', fontSize: 11.5, color: '#92400E', display: 'flex', alignItems: 'center', gap: 8 }}>
                {Icon.alert(13)}
                <strong>Confirm Compilation blocked.</strong>
                Blocking inputs: {blockers.map(x => x.category).join(' · ')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
