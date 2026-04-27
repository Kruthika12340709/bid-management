import React, { useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { useInputs } from '../hooks/useApiData';
import { inputsApi } from '../api/client';

const STATUS = {
  valid:          { bg: '#DCFCE7', fg: '#16A34A', row: 'transparent', label: 'Valid',          icon: '✓' },
  low_confidence: { bg: '#FEF3C7', fg: '#B45309', row: '#FEFCE8',     label: 'Low Confidence', icon: '⚠' },
  invalid:        { bg: '#FFE4E6', fg: '#BE123C', row: '#FFF5F5',     label: 'Invalid',         icon: '✗' },
  missing:        { bg: '#FEE2E2', fg: '#DC2626', row: '#FFF5F5',     label: 'Missing',         icon: '✗' },
  received:       { bg: '#DCFCE7', fg: '#16A34A', row: 'transparent', label: 'Valid',           icon: '✓' },
  malformed:      { bg: '#FFE4E6', fg: '#BE123C', row: '#FFF5F5',     label: 'Invalid',         icon: '✗' },
};

const DECISION_BADGE = {
  proceed: { label: 'Proceeding', bg: '#EDE9FE', fg: '#6D28D9' },
  request: { label: 'Requested',  bg: '#DBEAFE', fg: '#1D4ED8' },
  descope: { label: 'De-scoped',  bg: '#F1F5F9', fg: '#475569' },
};

function ConfidenceBar({ value }) {
  const pct   = Math.round((value || 0) * 100);
  const color = pct >= 80 ? '#16A34A' : pct >= 60 ? '#D97706' : '#DC2626';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 5, background: '#E2E8F0', borderRadius: 99, overflow: 'hidden', minWidth: 56 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color, minWidth: 26 }}>{pct}%</span>
    </div>
  );
}

export default function InputValidation({ user }) {
  const isManager = user.id === 'manager';
  const { data, error, refresh } = useInputs();
<<<<<<< HEAD
  const [requested, setRequested] = useState({});
  const [busy, setBusy]           = useState(false);
  const [toast, setToast]         = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [jsonText, setJsonText]   = useState('');
  const [validationError, setValidationError] = useState('');
  const [isValid, setIsValid]     = useState(false);
=======
  const [busy, setBusy]   = useState(false);
  const [toast, setToast] = useState(null);
>>>>>>> 48237f6350af39ed2581294ea97bcfd19d42ae2d

  React.useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }
  }, [toast]);

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
  if (!data)  return <div style={{ padding: 40, color: '#94A3B8' }}>Loading inputs…</div>;

  async function recordDecision(rfpId, category, action) {
    try {
      await inputsApi.recordDecision(rfpId, { category, action, performed_by: user.name || 'Arjun Kapoor' });
      const msg = { proceed: `Proceeding with '${category}'`, request: `Requested data for '${category}'`, descope: `De-scoped '${category}'` };
      setToast(msg[action]);
      refresh();
    } catch (e) { setToast(`Error: ${e.message}`); }
  }

  async function confirmCompilation(rfpId) {
    setBusy(true);
    try {
      const res = await inputsApi.confirmCompilation(rfpId);
      setToast(`Compilation triggered → ${res.bid_reference} (stage: ${res.stage})`);
      refresh();
    } catch (e) {
      setToast(`Error: ${e.response?.data?.detail || e.message}`);
    } finally { setBusy(false); }
  }

  function isBlocking(inp) {
    const isOk = inp.status === 'valid' || inp.status === 'received';
    const decided = inp.decision && (inp.decision.action === 'proceed' || inp.decision.action === 'descope');
    return !isOk && !decided;
  }

  return (
    <div>
      <div className="page-banner" style={{ background: 'linear-gradient(90deg, #06B6D4 0%, #5929d0 60%, #CF008B 100%)' }}>
        <div className="page-banner-dot" />
<<<<<<< HEAD
        <div className="page-banner-text" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="page-banner-title">Input Validation Dashboard</div>
            <div className="page-banner-sub">8 input categories must be Received before compilation can start · BR-001</div>
          </div>
          <button onClick={() => setShowPopup(true)} className="btn btn-primary btn-sm" title="Add new RFP from JSON">{Icon.plus(14)} Add RFP</button>
=======
        <div className="page-banner-text">
          <div className="page-banner-title">Input Validation Dashboard</div>
          <div className="page-banner-sub">
            Review data quality &amp; confidence · Proceed, Request, or De-scope before compilation · BR-001
          </div>
>>>>>>> 48237f6350af39ed2581294ea97bcfd19d42ae2d
        </div>
      </div>

      {data.length === 0 && (
        <div className="card">
          <div className="card-pad" style={{ color: '#94A3B8', textAlign: 'center', padding: 32 }}>
            No RFPs in <code>rfp_module</code>. Insert a row in Aiven to see input validation status.
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#0F172A', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 12, zIndex: 2000, boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
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
        const blockers     = b.inputs.filter(isBlocking);
        const ready        = blockers.length === 0;
        const validCount   = b.inputs.filter(i => i.status === 'valid' || i.status === 'received').length;
        const lowCnt       = b.inputs.filter(i => i.status === 'low_confidence').length;
        const invalidCnt   = b.inputs.filter(i => i.status === 'invalid' || i.status === 'malformed').length;
        const missingCnt   = b.inputs.filter(i => i.status === 'missing').length;
        const confInputs   = b.inputs.filter(i => i.confidence != null);
        const avgConf      = confInputs.length ? confInputs.reduce((s, i) => s + i.confidence, 0) / confInputs.length : 0;
        const alreadyCompiled = !!b.compiled_bid_ref;

        return (
          <div key={b.rfp_id} className="card" style={{ marginBottom: 18 }}>
            <div className="card-header">
              <div>
                <div className="card-title">{b.client} · {b.rfp_id}</div>
                <div style={{ fontSize: 11, color: '#64748B', display: 'flex', gap: 10, alignItems: 'center', marginTop: 3 }}>
                  <span>{b.title}</span>
                  <span style={{ color: '#16A34A', fontWeight: 600 }}>{validCount} valid</span>
                  {lowCnt     > 0 && <span style={{ color: '#B45309', fontWeight: 600 }}>{lowCnt} low confidence</span>}
                  {invalidCnt > 0 && <span style={{ color: '#BE123C', fontWeight: 600 }}>{invalidCnt} invalid</span>}
                  {missingCnt > 0 && <span style={{ color: '#DC2626', fontWeight: 600 }}>{missingCnt} missing</span>}
                  <span style={{ color: '#94A3B8' }}>· avg conf <strong style={{ color: avgConf >= 0.75 ? '#16A34A' : '#D97706' }}>{Math.round(avgConf * 100)}%</strong></span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {alreadyCompiled ? (
                  <span className="badge badge-success">{Icon.check(11)} Compiled → {b.compiled_bid_ref} ({b.compiled_bid_stage})</span>
                ) : (
                  <>
                    <span className={`badge ${ready ? 'badge-cyan' : 'badge-neutral'}`} style={{ fontWeight: 700 }}>
                      {ready ? 'Ready to Compile' : `${blockers.length} blocker${blockers.length !== 1 ? 's' : ''}`}
                    </span>
                    {isManager && (
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={!ready || busy}
                        onClick={() => confirmCompilation(b.rfp_id)}
                        title={!ready ? `Blocked: ${blockers.map(x => x.category).join(', ')}` : ''}
                        style={{ opacity: !ready || busy ? 0.5 : 1, cursor: !ready || busy ? 'not-allowed' : 'pointer' }}
                      >
                        {Icon.check(11)} Confirm Compilation
                      </button>
                    )}
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
                  <th>Confidence</th>
                  <th>Last Received</th>
                  <th style={{ width: 230 }}>Manager Action</th>
                </tr>
              </thead>
              <tbody>
                {b.inputs.map((inp, idx) => {
                  const st        = STATUS[inp.status] || STATUS.missing;
                  const tsDisplay = inp.ts ? new Date(inp.ts).toISOString().slice(0, 16).replace('T', ' ') : '—';
                  const isOk      = inp.status === 'valid' || inp.status === 'received';
                  const dec       = inp.decision;
                  const decBadge  = dec ? DECISION_BADGE[dec.action] : null;

                  return (
                    <React.Fragment key={idx}>
                      <tr style={{ background: isBlocking(inp) ? st.row : 'transparent' }}>
                        <td style={{ fontWeight: 500, fontSize: 12 }}>{inp.module}</td>
                        <td style={{ fontSize: 12 }}>{inp.category}</td>
                        <td>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: st.bg, color: st.fg, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                            {st.icon} {st.label}
                          </span>
                        </td>
                        <td style={{ minWidth: 90 }}>
                          {inp.confidence != null
                            ? <ConfidenceBar value={inp.confidence} />
                            : <span style={{ fontSize: 11, color: '#CBD5E1' }}>—</span>}
                        </td>
                        <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: !inp.ts ? '#CBD5E1' : '#475569' }}>
                          {tsDisplay}
                        </td>
                        <td>
                          {/* Already decided */}
                          {dec ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: decBadge.bg, color: decBadge.fg }}>
                                {decBadge.label}
                              </span>
                              {isManager && (
                                <button
                                  style={{ fontSize: 10, padding: '2px 6px', background: 'none', border: '1px solid #CBD5E1', borderRadius: 4, cursor: 'pointer', color: '#64748B' }}
                                  onClick={() => recordDecision(b.rfp_id, inp.category, 'proceed')}
                                  title="Undo decision"
                                >↩</button>
                              )}
                            </div>
                          ) : isOk ? (
                            <span style={{ fontSize: 11, color: '#94A3B8' }}>—</span>
                          ) : isManager ? (
                            /* Three action buttons */
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                onClick={() => recordDecision(b.rfp_id, inp.category, 'proceed')}
                                title="Accept as-is — include in compilation"
                                style={{ fontSize: 10, padding: '3px 8px', background: '#EDE9FE', color: '#6D28D9', border: '1px solid #C4B5FD', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                              >
                                Proceed
                              </button>
                              <button
                                onClick={() => recordDecision(b.rfp_id, inp.category, 'request')}
                                title="Request better data from upstream — keeps blocking"
                                style={{ fontSize: 10, padding: '3px 8px', background: '#DBEAFE', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                              >
                                Request
                              </button>
                              <button
                                onClick={() => recordDecision(b.rfp_id, inp.category, 'descope')}
                                title="Exclude this section from the bid"
                                style={{ fontSize: 10, padding: '3px 8px', background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                              >
                                De-scope
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 10.5, color: '#94A3B8' }}>Manager only</span>
                          )}
                        </td>
                      </tr>

                      {/* Issues sub-row */}
                      {inp.issues && inp.issues.length > 0 && (
                        <tr style={{ background: '#FFF5F5' }}>
                          <td colSpan={6} style={{ paddingTop: 0, paddingBottom: 7, paddingLeft: 28, borderTop: 'none' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 14px' }}>
                              {inp.issues.map((issue, ii) => (
                                <span key={ii} style={{ fontSize: 10.5, color: '#BE123C', display: 'flex', alignItems: 'center', gap: 3 }}>
                                  {Icon.alert(10)} {issue}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            {!ready && !alreadyCompiled && (
              <div style={{ padding: '10px 20px', background: '#FFFBEB', borderTop: '1px solid #FCD34D', fontSize: 11.5, color: '#92400E', display: 'flex', alignItems: 'center', gap: 8 }}>
                {Icon.alert(13)}
                <strong>Compilation blocked.</strong>&nbsp;
                Resolve or make a decision on: {blockers.map(x => x.category).join(' · ')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
