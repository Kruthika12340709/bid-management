import React, { useState, useEffect } from 'react';
import { Icon } from '../components/ui/Icon';
import { fmtMoney, stageBadge } from '../utils/format';
import { useBidDetail } from '../hooks/useApiData';
import { hilApi, bidsApi } from '../api/client';
import { sections as MOCK_SECTIONS, pricingLines, users } from '../utils/adapt';

const CO_APPROVAL_VALUE_THRESHOLD = 1000000;

export default function BidDetail({ bid: initialBid, user, onBack, defaultSection = 'pricing' }) {
  const isDirector = user.id === 'director';
  const { bid, sections, risks, error, refresh } = useBidDetail(initialBid?.id);

  const [activeSection,   setActiveSection]   = useState(defaultSection);
  const [pendingMargin,   setPendingMargin]   = useState(null);
  const [marginConfirmed, setMarginConfirmed] = useState(false);
  const [edits,           setEdits]           = useState({});
  const [busy,            setBusy]            = useState(false);
  const [toast,           setToast]           = useState(null);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 2400); return () => clearTimeout(t); } }, [toast]);

  if (error)              return <div style={{ padding: 40, color: '#DC2626' }}>API error: {String(error)}</div>;
  if (!bid || !sections)  return <div style={{ padding: 40, color: '#94A3B8' }}>Loading bid {initialBid?.id}…</div>;

  // Build state lookup from API sections
  const sectionStates = Object.fromEntries(sections.map(s => [s.section_key, s.status]));
  const approvedCount = sections.filter(s => s.status === 'approved').length;
  const allApproved   = approvedCount === 8;
  const margin        = pendingMargin ?? Number(bid.currentMargin || bid.margin);

  const totalCost = pricingLines.reduce((s, l) => s + l.rate * l.hours, 0);
  const totalBid  = pricingLines.reduce((s, l) => {
    const isPipelineOrML = l.task.includes('Pipeline Build — Transformation') || l.task.includes('ML');
    const useM = isPipelineOrML ? margin : l.margin;
    return s + l.rate * l.hours * (1 + useM / 100);
  }, 0);

  const highRiskCount      = (risks || []).filter(r => r.severity === 'High').length;
  const coApprovalRequired = bid.value > CO_APPROVAL_VALUE_THRESHOLD || highRiskCount >= 2;
  const managerCoApproved  = !!bid.managerCoApprovedAt;
  const readyForFinal      = allApproved && (!coApprovalRequired || managerCoApproved);

  // ─── action handlers ──────────────────────────────────────────────────────
  const actor = () => ({ performed_by: user.name, role: user.role.includes('Director') ? 'Director' : 'Manager' });

  async function approveSection(key, note) {
    setBusy(true);
    try {
      await hilApi.approveSection(bid.id, key, { ...actor(), note });
      setToast(`Approved ${key}`);
      refresh();
    } catch (e) { setToast(`Error: ${e.message}`); }
    finally { setBusy(false); }
  }

  async function rejectSection(key, note) {
    setBusy(true);
    try {
      await hilApi.rejectSection(bid.id, key, { ...actor(), note: note || 'Returned to upstream' });
      setToast(`Returned ${key}`);
      refresh();
    } catch (e) { setToast(`Error: ${e.message}`); }
    finally { setBusy(false); }
  }

  async function editAndApprove(key, fieldKey, original, revised) {
    setBusy(true);
    try {
      await hilApi.editSection(bid.id, key, {
        ...actor(),
        field_key:      fieldKey,
        original_value: original,
        revised_value:  revised,
        note:           `${fieldKey}: ${original} → ${revised}`,
      });
      setEdits(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [fieldKey]: { original, revised } } }));
      setToast('Edit logged to audit');
    } catch (e) { setToast(`Error: ${e.message}`); }
    finally { setBusy(false); }
  }

  async function applyMarginOverride() {
    setBusy(true);
    try {
      await hilApi.marginOverride(bid.id, { new_margin_pct: pendingMargin, performed_by: user.name, note: `Margin ${bid.margin}% → ${pendingMargin}%` });
      setMarginConfirmed(true);
      setPendingMargin(null);
      setToast('Margin override applied — awaiting Manager co-approval');
      refresh();
    } catch (e) { setToast(`Error: ${e.message}`); }
    finally { setBusy(false); }
  }

  async function ackRisk(riskRef) {
    setBusy(true);
    try {
      await hilApi.acknowledgeRisk(bid.id, riskRef, { performed_by: user.name });
      refresh();
      setToast(`${riskRef} acknowledged`);
    } catch (e) { setToast(`Error: ${e.message}`); }
    finally { setBusy(false); }
  }

  async function signOff() {
    setBusy(true);
    try {
      await hilApi.signOff(bid.id, actor());
      setToast('Signed off — bid moved to Approved, Manager can submit');
      refresh();
    } catch (e) { setToast(`Error: ${e.response?.data?.detail || e.message}`); }
    finally { setBusy(false); }
  }

  async function managerCoApprove() {
    setBusy(true);
    try {
      await hilApi.managerCoApprove(bid.id, { ...actor(), note: 'Confirmed BR-003/BR-005' });
      setToast('Co-approved — Director can now sign off');
      refresh();
    } catch (e) { setToast(`Error: ${e.message}`); }
    finally { setBusy(false); }
  }

  async function submitBid() {
    setBusy(true);
    try {
      await bidsApi.submit(bid.id, { ...actor(), note: 'Submitted to client portal' });
      setToast('Submitted');
      refresh();
    } catch (e) { setToast(`Error: ${e.response?.data?.detail || e.message}`); }
    finally { setBusy(false); }
  }

  const section = MOCK_SECTIONS.find(s => s.id === activeSection);

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#0F172A', color: '#fff', padding: '10px 16px', borderRadius: 10, fontSize: 12, zIndex: 2000, boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
          {toast}
        </div>
      )}

      <div className="detail-header">
        <div className="detail-crumb">
          <a onClick={onBack} style={{ cursor: 'pointer' }}>Bids</a> {Icon.arrow(10)} {bid.id}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <div className="detail-title">{bid.title}</div>
            <div className="detail-sub">
              <div>{Icon.briefcase(12)} {bid.client}</div>
              <div>{Icon.doc(12)} {bid.rfp}</div>
              <div>{Icon.clock(12)} Due {new Date(bid.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} · <strong style={{ color: bid.daysLeft <= 3 ? '#DC2626' : '#0F172A', marginLeft: 4 }}>{bid.daysLeft}d left</strong></div>
              <div>{stageBadge(bid.stage)}</div>
              {(bid.tags || []).map((t, i) => <span key={i} className="badge badge-neutral" style={{ fontSize: 10.5 }}>{t}</span>)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {bid.stage === 'pending' && isDirector && readyForFinal &&
              <button className="btn btn-success" disabled={busy} onClick={signOff}>{Icon.check(12)} Sign-off & route to Manager</button>}
            {bid.stage === 'pending' && isDirector && !readyForFinal &&
              <button className="btn btn-primary" disabled>{approvedCount}/8 sections approved{coApprovalRequired && !managerCoApproved ? ' · awaiting co-approval' : ''}</button>}
            {bid.stage === 'pending' && !isDirector &&
              <button className="btn btn-outline" disabled>Read-only — Director reviewing</button>}
            {bid.stage === 'approved' && !isDirector &&
              <button className="btn btn-success" disabled={busy} onClick={submitBid}>{Icon.check(12)} Confirm & submit</button>}
            {bid.stage === 'approved' && isDirector &&
              <button className="btn btn-outline" disabled>Awaiting Manager submission</button>}
            {bid.stage === 'submitted' &&
              <span className="badge badge-success">{Icon.check(11)} Submitted</span>}
          </div>
        </div>
        <div className="detail-meta-row">
          <div><div className="detail-meta-label">Bid Value</div><div className="detail-meta-value">{fmtMoney(bid.value, bid.currency)}</div></div>
          <div><div className="detail-meta-label">Win Probability</div><div className="detail-meta-value">{Math.round(bid.winProb * 100)}%</div></div>
          <div><div className="detail-meta-label">Compile Time</div><div className="detail-meta-value">{bid.compileTime || '—'}</div></div>
          <div><div className="detail-meta-label">Assigned To</div><div className="detail-meta-value">{users[bid.assigned]?.name || '—'}</div></div>
        </div>

        {/* Pending banner shown only to Manager (they're the only ones who can act on it).
            Green confirmation banner shown to both, so Director sees the gate has cleared. */}
        {coApprovalRequired && (managerCoApproved || !isDirector) && (
          <div style={{ marginTop: 14, padding: 12, background: managerCoApproved ? '#DCFCE7' : '#FFD6F4', border: `1px solid ${managerCoApproved ? '#16A34A' : '#CF008B'}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: managerCoApproved ? '#16A34A' : '#CF008B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {managerCoApproved ? Icon.check(15) : Icon.flag(15)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: managerCoApproved ? '#15803D' : '#9C006A' }}>
                {managerCoApproved ? 'Co-approved by Manager' : 'Co-Approval Required'}
              </div>
              <div style={{ fontSize: 11.5, color: managerCoApproved ? '#166534' : '#9C006A', marginTop: 2 }}>
                {bid.value > CO_APPROVAL_VALUE_THRESHOLD && <>Bid value {fmtMoney(bid.value, bid.currency)} exceeds {fmtMoney(CO_APPROVAL_VALUE_THRESHOLD, bid.currency)} threshold. </>}
                {highRiskCount >= 2 && <>{highRiskCount} risks rated High. </>}
                {managerCoApproved ? 'Director can now finalise sign-off.' : 'Bid Manager must approve before Director sign-off.'}
              </div>
            </div>
            {!isDirector && !managerCoApproved &&
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={managerCoApprove}>{Icon.check(11)} Manager co-approve</button>}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 6 }}>
            <span>HIL APPROVAL PROGRESS</span>
            <span>{approvedCount} / 8 sections approved</span>
          </div>
          <div className="approval-progress">
            {sections.map(s => {
              const cls = s.status === 'approved' ? 'done' : s.status === 'returned' ? 'rejected' : s.status === 'flagged' ? 'flagged' : 'current';
              return <div key={s.section_key} className={`progress-step ${cls}`} title={`${s.section_name} — ${s.status}`} />;
            })}
          </div>
        </div>
      </div>

      {bid.stage === 'submitted' && (
        <div className="card" style={{ marginBottom: 14, border: bid.outcome === 'Awarded' ? '1px solid #86EFAC' : bid.outcome ? '1px solid #FCA5A5' : '1px solid #E2E8F0' }}>
          <div className="card-header" style={{ background: bid.outcome === 'Awarded' ? '#F0FDF4' : bid.outcome ? '#FEF2F2' : '#FAFBFD' }}>
            <div>
              <div className="card-title" style={{ color: bid.outcome === 'Awarded' ? '#15803D' : bid.outcome ? '#DC2626' : '#0F172A' }}>
                {bid.outcome === 'Awarded' ? '🏆 Bid Awarded' : bid.outcome === 'Not Awarded' ? '✗ Bid Not Awarded' : '⏳ Awaiting Outcome'}
              </div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                Submitted · {bid.submittedAt ? new Date(bid.submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'date unknown'}
              </div>
            </div>
            {bid.outcome && (
              <span className={`badge ${bid.outcome === 'Awarded' ? 'badge-success' : 'badge-error'}`} style={{ fontSize: 12, padding: '6px 14px' }}>
                {bid.outcome}
              </span>
            )}
          </div>
          <div style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Submitted Value</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>{fmtMoney(bid.value, bid.currency)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Final Margin</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>{bid.currentMargin || bid.margin}%</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Win Probability</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: (bid.winProb || 0) >= 0.7 ? '#16A34A' : '#D97706' }}>{Math.round((bid.winProb || 0) * 100)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Sections Approved</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>{approvedCount} / 8</div>
            </div>
          </div>
        </div>
      )}

      <div className="section-tabs">
        {sections.map(s => (
          <button key={s.section_key} className={`section-tab ${activeSection === s.section_key ? 'active' : ''}`} onClick={() => setActiveSection(s.section_key)}>
            {s.section_name}
            {s.status === 'approved' && <span className="badge badge-success">{Icon.check(8)}</span>}
            {s.status === 'returned' && <span className="badge badge-error">↺</span>}
            {s.status === 'flagged'  && <span className="badge badge-warning">!</span>}
          </button>
        ))}
      </div>

      {activeSection === 'pricing' && (
        <PricingSection
          bid={bid} margin={margin} pendingMargin={pendingMargin} setPendingMargin={setPendingMargin}
          marginConfirmed={marginConfirmed} setMarginConfirmed={setMarginConfirmed}
          isDirector={isDirector} totalCost={totalCost} totalBid={totalBid}
          onApprove={() => approveSection('pricing')} onReturn={() => rejectSection('pricing')}
          onApplyOverride={applyMarginOverride}
          status={sectionStates.pricing} busy={busy}
        />
      )}
      {activeSection === 'risks' && (
        <RisksSection
          risks={risks || []} onAck={ackRisk}
          isDirector={isDirector}
          onApprove={() => approveSection('risks')} onReturn={() => rejectSection('risks')}
          status={sectionStates.risks} busy={busy}
        />
      )}
      {activeSection !== 'pricing' && activeSection !== 'risks' && (
        <GenericSection
          section={section}
          apiSection={sections.find(s => s.section_key === activeSection)}
          status={sectionStates[activeSection]}
          isDirector={isDirector}
          edits={edits[activeSection] || {}}
          onEdit={(field, original, revised) => editAndApprove(activeSection, field, original, revised)}
          onApprove={() => approveSection(activeSection)}
          onReturn={() => rejectSection(activeSection)}
          busy={busy}
        />
      )}
    </div>
  );
}

// ─── controls + sections ────────────────────────────────────────────────────

function ApprovalControls({ status, isDirector, onApprove, onReturn, disabled, disabledReason, busy }) {
  if (status === 'approved') return <span className="badge badge-success">{Icon.check(10)} Approved</span>;
  if (status === 'returned') return <span className="badge badge-error">{Icon.flag(10)} Returned to upstream</span>;
  if (!isDirector) return <span className="badge badge-primary">Awaiting Director</span>;
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button className="btn btn-outline btn-sm" disabled={busy} onClick={onReturn}>{Icon.flag(10)} Reject & return</button>
      <button className="btn btn-success btn-sm" disabled={disabled || busy} title={disabled ? disabledReason : ''} onClick={onApprove}>
        {Icon.check(11)} Approve section
      </button>
    </div>
  );
}

function PricingSection({ bid, margin, pendingMargin, setPendingMargin, marginConfirmed, setMarginConfirmed, isDirector, totalCost, totalBid, onApprove, onReturn, onApplyOverride, status, busy }) {
  return (
    <div>
      <div className="card mb-16">
        <div className="card-header">
          <div>
            <div className="card-title">{Icon.pound(14)} Pricing Review · {bid.currency}</div>
            <div className="card-sub">Rate card applied · {pricingLines.length} lines · margin overrides logged per BR-003</div>
          </div>
          <ApprovalControls status={status} isDirector={isDirector} onApprove={onApprove} onReturn={onReturn} busy={busy} />
        </div>
        <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <div className="kpi k-cyan" style={{ margin: 0 }}><div className="kpi-label">Total Cost</div><div className="kpi-value">{fmtMoney(totalCost, bid.currency)}</div><div className="kpi-meta">12 tasks · 4 roles · 676h</div></div>
          <div className="kpi" style={{ margin: 0 }}><div className="kpi-label">Bid Price</div><div className="kpi-value">{fmtMoney(totalBid, bid.currency)}</div><div className="kpi-meta">After margin · {bid.currency}</div></div>
          <div className="kpi k-pink" style={{ margin: 0 }}><div className="kpi-label">Effective Margin</div><div className="kpi-value">{((totalBid / totalCost - 1) * 100).toFixed(1)}%</div></div>
        </div>
        {isDirector && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', background: '#FAFBFD', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Adjust margin (Pipeline Build & ML lines)</div>
            <input type="range" min="18" max="32" step="1"
              value={pendingMargin ?? margin}
              onChange={e => setPendingMargin(+e.target.value)}
              style={{ flex: 1 }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#5929d0', minWidth: 50, textAlign: 'right' }}>{pendingMargin ?? margin}%</div>
            {pendingMargin !== null && pendingMargin !== margin &&
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => setMarginConfirmed('asking')}>Apply override</button>}
            {marginConfirmed === true &&
              <span className="badge badge-success" style={{ fontSize: 10 }}>{Icon.check(10)} Override logged</span>}
          </div>
        )}
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">Line items</div><div className="card-sub">{pricingLines.length} lines</div></div>
        <table className="dt" style={{ borderRadius: 0, border: 'none' }}>
          <thead><tr><th>Task</th><th>Role</th><th className="num">Rate</th><th className="num">Hours</th><th className="num">Margin</th><th className="num">Subtotal</th></tr></thead>
          <tbody>
            {pricingLines.map((l, i) => {
              const overridden = (l.task.includes('Pipeline Build — Transformation') || l.task.includes('ML')) && margin !== bid.margin;
              const useM = overridden ? margin : l.margin;
              const subtotal = l.rate * l.hours * (1 + useM / 100);
              return (
                <tr key={i}>
                  <td><strong>{l.task}</strong></td>
                  <td>{l.role}</td>
                  <td className="num">£{l.rate.toLocaleString()}</td>
                  <td className="num">{l.hours}</td>
                  <td className="num">{useM}% {overridden && <span className="badge badge-pink" style={{ fontSize: 9, marginLeft: 4 }}>O</span>}</td>
                  <td className="num"><strong>£{Math.round(subtotal).toLocaleString()}</strong></td>
                </tr>
              );
            })}
            <tr style={{ background: '#FAFBFD', fontWeight: 700 }}>
              <td colSpan="5" style={{ textAlign: 'right' }}>Bid Total</td>
              <td className="num"><strong style={{ color: '#5929d0' }}>£{Math.round(totalBid).toLocaleString()}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      {marginConfirmed === 'asking' && (
        <ModalOverride
          oldMargin={bid.margin} newMargin={pendingMargin}
          target="Pipeline Build & ML lines"
          onCancel={() => { setPendingMargin(null); setMarginConfirmed(false); }}
          onConfirm={onApplyOverride}
        />
      )}
    </div>
  );
}

function ModalOverride({ oldMargin, newMargin, target, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 460, padding: 22, boxShadow: '0 24px 80px rgba(15,23,42,0.32)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FFD6F4', color: '#CF008B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {Icon.flag(16)}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Confirm margin override</div>
            <div style={{ fontSize: 11, color: '#64748B' }}>BR-003 · director sign-off — logged to audit</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#0F172A', lineHeight: 1.5, marginBottom: 16 }}>
          Confirm margin override from <strong>{oldMargin}%</strong> to <strong style={{ color: '#CF008B' }}>{newMargin}%</strong> on{' '}
          <strong>{target}</strong>.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm}>{Icon.check(11)} Confirm override</button>
        </div>
      </div>
    </div>
  );
}

function RisksSection({ risks, onAck, isDirector, onApprove, onReturn, status, busy }) {
  const high = risks.filter(r => r.severity === 'High');
  const allHighAcked = high.every(r => r.acknowledged);
  const blockedReason = !allHighAcked ? `Acknowledge ${high.length} High-severity risks first (BR-005)` : '';
  return (
    <div>
      <div className="card mb-16">
        <div className="card-header">
          <div>
            <div className="card-title">{Icon.alert(14)} Risk Register · {risks.length} risks · {high.length} High-rated</div>
            <div className="card-sub">High-severity risks require explicit Bid Director acknowledgement (BR-005)</div>
          </div>
          <ApprovalControls
            status={status} isDirector={isDirector}
            onApprove={onApprove} onReturn={onReturn}
            disabled={!allHighAcked} disabledReason={blockedReason} busy={busy}
          />
        </div>
        <div style={{ padding: '14px 20px' }}>
          {risks.length === 0 ? (
            <div style={{ color: '#94A3B8', textAlign: 'center', padding: 20 }}>No risks recorded for this bid</div>
          ) : (
            <table className="dt">
              <thead><tr><th>ID</th><th>Risk</th><th>Cat</th><th>P</th><th>I</th><th>Sev</th><th>Mitigation</th><th>Owner</th><th>Ack</th></tr></thead>
              <tbody>
                {risks.map(r => {
                  const acked = r.acknowledged;
                  return (
                    <tr key={r.risk_id} style={{ background: r.severity === 'High' && !acked ? '#FEF2F2' : 'transparent' }}>
                      <td><strong>{r.risk_ref}</strong></td>
                      <td style={{ maxWidth: 240, lineHeight: 1.4 }}>{r.description}</td>
                      <td><span className="badge badge-neutral" style={{ fontSize: 10 }}>{r.category}</span></td>
                      <td>{r.probability}</td><td>{r.impact}</td>
                      <td><span className={`badge ${r.severity === 'High' ? 'badge-error' : r.severity === 'Medium' ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: 10 }}>{r.severity}</span></td>
                      <td style={{ maxWidth: 220, fontSize: 11.5, color: '#475569' }}>{r.mitigation}</td>
                      <td>{!r.owner ? <span className="badge badge-error" style={{ fontSize: 10 }}>missing</span> : r.owner}</td>
                      <td>
                        {r.severity !== 'High' ? <span className="muted" style={{ fontSize: 11 }}>—</span>
                          : acked
                            ? <span className="badge badge-success" style={{ fontSize: 10 }}>{Icon.check(9)} ack</span>
                            : isDirector
                              ? <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => onAck(r.risk_ref)}>ack</button>
                              : <span className="badge badge-warning" style={{ fontSize: 10 }}>req</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function GenericSection({ section, apiSection, status, isDirector, edits, onEdit, onApprove, onReturn, busy }) {
  const [editingField, setEditingField] = useState(null);
  const [draft, setDraft] = useState('');

  function startEdit(field, currentValue) { setEditingField(field); setDraft(currentValue); }
  function saveEdit(field, original) {
    if (draft !== original) onEdit(field, original, draft);
    setEditingField(null);
  }

  const compiledData = apiSection?.compiled_data;
  const sourceLabel  = apiSection ? `Source: ${apiSection.source_module} · v${apiSection.input_version} · Confidence ${apiSection.confidence_score || '—'}` : section?.sub;

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">{section?.name || apiSection?.section_name || 'Section'}</div>
          <div className="card-sub">{sourceLabel}</div>
        </div>
        <ApprovalControls status={status} isDirector={isDirector} onApprove={onApprove} onReturn={onReturn} busy={busy} />
      </div>
      <div className="card-pad">
        {status === 'flagged' && (
          <div className="flag-row" style={{ marginBottom: 14 }}>
            {Icon.flag(13)} Section has open flags from upstream compilation. Edit-and-approve, or reject to return upstream.
          </div>
        )}
        <SectionContent
          sectionKey={section?.id || apiSection?.section_key}
          compiledData={compiledData}
          edits={edits}
          editingField={editingField} draft={draft} setDraft={setDraft}
          isDirector={isDirector && status !== 'approved' && status !== 'returned'}
          onStartEdit={startEdit} onSaveEdit={saveEdit} onCancelEdit={() => setEditingField(null)}
        />
      </div>
    </div>
  );
}

function EditableField({ fieldKey, original, edit, isDirector, editing, draft, setDraft, onStart, onSave, onCancel }) {
  const revised = edit?.revised;
  if (editing) {
    return (
      <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
        <input value={draft} onChange={e => setDraft(e.target.value)}
          style={{ padding: '3px 8px', border: '1px solid #5929d0', borderRadius: 4, fontSize: 12, minWidth: 100 }} />
        <button className="btn btn-success btn-sm" onClick={() => onSave(original)} style={{ padding: '3px 8px', fontSize: 10 }}>save</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel} style={{ padding: '3px 8px', fontSize: 10 }}>cancel</button>
      </span>
    );
  }
  if (revised !== undefined && revised !== original) {
    return (
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <span style={{ textDecoration: 'line-through', color: '#94A3B8' }}>{edit.original}</span>
        <span style={{ background: '#DCFCE7', color: '#15803D', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>{revised}</span>
        {isDirector && <button className="btn btn-ghost btn-sm" onClick={() => onStart(fieldKey, revised)} style={{ padding: '2px 6px', fontSize: 10 }}>edit</button>}
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      {original}
      {isDirector && <button className="btn btn-ghost btn-sm" onClick={() => onStart(fieldKey, original)} style={{ padding: '2px 6px', fontSize: 10, color: '#94A3B8' }}>edit</button>}
    </span>
  );
}

function SectionContent({ sectionKey, compiledData, edits, editingField, draft, setDraft, isDirector, onStartEdit, onSaveEdit, onCancelEdit }) {
  const fp = (k) => ({
    fieldKey: k, edit: edits[k], isDirector,
    editing: editingField === k, draft, setDraft,
    onStart: onStartEdit, onSave: onSaveEdit, onCancel: onCancelEdit,
  });

  if (!compiledData) {
    return <div style={{ color: '#94A3B8', padding: 20, textAlign: 'center' }}>No compiled data yet for this section.</div>;
  }

  if (sectionKey === 'effort') {
    const rows = compiledData.tasks || [];
    const summary = compiledData.summary || {};
    return (
      <table className="dt">
        <thead><tr><th>Task</th><th>Description</th><th>Role</th><th className="num">Hours</th><th className="num">Confidence</th><th>Source</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ background: r.confidence < 0.65 ? '#FFFBEB' : 'transparent' }}>
              <td><strong>{r.id}</strong></td>
              <td>{r.name}</td>
              <td>{r.role}</td>
              <td className="num"><EditableField {...fp(`${r.id}.hours`)} original={`${r.hours}h`} /></td>
              <td className="num">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {r.confidence.toFixed(2)}
                  {r.confidence < 0.65 && <span className="badge badge-warning" style={{ fontSize: 9 }}>{Icon.flag(8)} low</span>}
                </span>
              </td>
              <td style={{ fontSize: 10.5, color: '#94A3B8', fontFamily: 'ui-monospace, monospace' }}>{r.source_ref || '—'}</td>
            </tr>
          ))}
          <tr style={{ background: '#FAFBFD', fontWeight: 700 }}>
            <td colSpan="3" style={{ textAlign: 'right' }}>Total</td>
            <td className="num">{summary.total_hours || rows.reduce((s, r) => s + r.hours, 0)}h</td>
            <td className="num">avg {summary.avg_confidence?.toFixed(2) || '—'}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    );
  }

  if (sectionKey === 'schedule') {
    const phases = (compiledData.phases || []).map((p, i) => ({
      ...p, color: ['#5929d0', '#22D3EE', '#CF008B', '#16A34A'][i % 4],
    }));
    const totalWeeks = compiledData.duration_weeks || 14;
    const conflicts  = compiledData.conflicts || [];
    const milestones = compiledData.milestones || [];
    return (
      <div>
        {conflicts.map((c, i) => (
          <div key={i} className="flag-row" style={{ marginBottom: 14 }}>
            {Icon.alert(13)} {c.description} (week {c.week})
          </div>
        ))}

        {/* Gantt visual */}
        <div style={{ display: 'grid', gridTemplateColumns: `140px repeat(${totalWeeks}, 1fr)`, gap: 4, alignItems: 'center', fontSize: 11, marginBottom: 18 }}>
          <div style={{ fontWeight: 600, color: '#94A3B8' }}>Phase</div>
          {Array.from({ length: totalWeeks }, (_, i) => <div key={i} style={{ textAlign: 'center', color: '#94A3B8', fontSize: 9.5 }}>W{i + 1}</div>)}
          {phases.map((p, pi) => (
            <React.Fragment key={pi}>
              <div style={{ fontWeight: 600, fontSize: 12 }}>{p.name}</div>
              {Array.from({ length: totalWeeks }, (_, i) => {
                const hasConflict = conflicts.some(c => c.week === i + 1) && p.weeks.includes(i + 1);
                return (
                  <div key={i} style={{ height: 24, background: p.weeks.includes(i + 1) ? p.color : '#F1F5F9', borderRadius: 4, position: 'relative' }}>
                    {hasConflict && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11 }}>!</span>}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>

        {/* Milestones — MVP §6.2: name, start, end, predecessor, role, mode */}
        {milestones.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>Milestones</div>
            <table className="dt">
              <thead>
                <tr><th>Milestone</th><th>Start</th><th>End</th><th>Predecessor</th><th>Role</th><th>Mode</th></tr>
              </thead>
              <tbody>
                {milestones.map((m, i) => (
                  <tr key={i}>
                    <td><strong>{m.name}</strong></td>
                    <td><EditableField {...fp(`MS-${i + 1}.start`)} original={m.start_date} /></td>
                    <td><EditableField {...fp(`MS-${i + 1}.end`)} original={m.end_date} /></td>
                    <td style={{ fontSize: 11, color: '#475569' }}>{m.predecessor || '—'}</td>
                    <td>{m.role}</td>
                    <td><span className="badge badge-neutral" style={{ fontSize: 10 }}>{m.mode}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    );
  }

  if (sectionKey === 'deliverables') {
    const items = (compiledData && compiledData.items) || compiledData || [];
    return (
      <table className="dt">
        <thead><tr><th>ID</th><th>Deliverable</th><th>Description</th><th>Format</th><th>Acceptance</th><th>Responsible</th></tr></thead>
        <tbody>
          {items.map((d, i) => (
            <tr key={i}>
              <td><strong>{d.id}</strong></td>
              <td><EditableField {...fp(`${d.id}.name`)} original={d.name} /></td>
              <td style={{ fontSize: 11.5, color: '#475569', maxWidth: 260 }}>{d.description || '—'}</td>
              <td>{d.format}</td>
              <td><EditableField {...fp(`${d.id}.acceptance`)} original={d.acceptance} /></td>
              <td>{d.responsible}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (sectionKey === 'acceptance') {
    const items = compiledData.criteria || [];
    // New schema: array of objects with id/description/measurement/verification/responsible
    const isStructured = items.length > 0 && typeof items[0] === 'object';
    if (isStructured) {
      return (
        <table className="dt">
          <thead><tr><th>ID</th><th>Criterion</th><th>Measurement Method</th><th>Verification</th><th>Responsible</th></tr></thead>
          <tbody>
            {items.map((c, i) => (
              <tr key={i}>
                <td><strong>{c.id}</strong></td>
                <td><EditableField {...fp(`${c.id}.description`)} original={c.description} /></td>
                <td style={{ fontSize: 11.5, color: '#475569' }}>{c.measurement || '—'}</td>
                <td style={{ fontSize: 11.5, color: '#475569' }}>{c.verification || '—'}</td>
                <td>{c.responsible || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    // Fallback for old string-only format
    return (
      <ol style={{ margin: 0, paddingLeft: 24, fontSize: 13, lineHeight: 1.7, color: '#1E293B' }}>
        {items.map((t, i) => (
          <li key={i} style={{ marginBottom: 6 }}>
            <EditableField {...fp(`AC-${i + 1}`)} original={t} />
          </li>
        ))}
      </ol>
    );
  }

  if (sectionKey === 'quality') {
    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>Compliance standards</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(compiledData.standards || []).map((s, i) => <span key={i} className="badge badge-primary">{s}</span>)}
          </div>
        </div>
        <table className="dt">
          <thead><tr><th>Metric</th><th>Target</th><th>Measurement</th><th>Verification</th></tr></thead>
          <tbody>
            {(compiledData.metrics || []).map((m, i) => (
              <tr key={i}>
                <td><strong>{m.metric}</strong></td>
                <td>{m.target}</td>
                <td>{m.measurement}</td>
                <td style={{ fontSize: 11.5, color: '#475569' }}>{m.verification || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (sectionKey === 'dependencies') {
    return (
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>Internal dependencies</div>
        <table className="dt" style={{ marginBottom: 16 }}>
          <thead><tr><th>Name</th><th>Linked Task / Deliverable</th><th>Owner</th><th>Status</th></tr></thead>
          <tbody>
            {(compiledData.internal || []).map((d, i) => (
              <tr key={i}>
                <td>{d.name}</td>
                <td style={{ fontSize: 11.5, color: '#5929d0' }}>{d.linked_task || '—'}</td>
                <td>{d.owner}</td>
                <td><span className={`badge ${d.status === 'confirmed' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 10 }}>{d.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>External dependencies</div>
        <table className="dt">
          <thead><tr><th>Name</th><th>Linked Task / Deliverable</th><th>Owner</th><th>Status</th></tr></thead>
          <tbody>
            {(compiledData.external || []).map((d, i) => (
              <tr key={i}>
                <td>{d.name}</td>
                <td style={{ fontSize: 11.5, color: '#5929d0' }}>{d.linked_task || '—'}</td>
                <td>{d.owner}</td>
                <td><span className={`badge ${d.status === 'confirmed' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 10 }}>{d.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return <pre style={{ background: '#FAFBFD', padding: 12, borderRadius: 6, fontSize: 11, overflow: 'auto' }}>{JSON.stringify(compiledData, null, 2)}</pre>;
}
