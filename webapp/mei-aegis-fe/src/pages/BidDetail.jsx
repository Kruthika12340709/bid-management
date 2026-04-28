import React, { useState, useEffect, useRef } from 'react';
import html2pdf from 'html2pdf.js';
import companyLogo from './image.png';
import { Icon } from '../components/ui/Icon';
import { fmtMoney, stageBadge } from '../utils/format';
import { useBidDetail } from '../hooks/useApiData';
import { hilApi, bidsApi } from '../api/client';
import { sections as MOCK_SECTIONS, pricingLines, users } from '../utils/adapt';

const CO_APPROVAL_VALUE_THRESHOLD = 1000000;

export default function BidDetail({ bid: initialBid, user, onBack, defaultSection = 'pricing' }) {
  const isDirector = user.id === 'director' || user.role?.includes('Director');
  const { bid, sections, risks, error, refresh } = useBidDetail(initialBid?.id);

  const [activeSection,   setActiveSection]   = useState(defaultSection);
  const printRef = useRef(null);
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

  const totalCost = (pricingLines || []).reduce((s, l) => s + (l.rate || 0) * (l.hours || 0), 0);
  const totalBid  = (pricingLines || []).reduce((s, l) => {
    const isPipelineOrML = l.task?.includes('Pipeline Build — Transformation') || l.task?.includes('ML');
    const useM = isPipelineOrML ? margin : (l.margin || 0);
    return s + (l.rate || 0) * (l.hours || 0) * (1 + useM / 100);
  }, 0);

  const marginVal = totalCost > 0 ? ((totalBid / totalCost - 1) * 100).toFixed(1) : '0.0';

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

  async function onEdit(key, fieldKey, original, revised) {
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

  async function exportToPdf() {
    if (!printRef.current) return;
    setToast('Generating PDF...');
    const element = printRef.current;
    
    const opt = {
      margin:       10,
      filename:     `Bid-${bid.id}-Approved.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().from(element).set(opt).save().then(() => {
      setToast('PDF exported successfully');
    }).catch(err => {
      console.error('PDF Export Error:', err);
      setToast('Error exporting PDF');
    });
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
            {allApproved && (
              <button className="btn btn-outline" disabled={busy} onClick={exportToPdf} title="Export Approved Sections to PDF">
                {Icon.doc(12)} Export PDF
              </button>
            )}
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
          onEdit={(f, o, r) => onEdit('pricing', f, o, r)}
          edits={edits.pricing || {}}
          marginVal={marginVal}
          status={sectionStates.pricing} busy={busy}
        />
      )}
      {activeSection === 'risks' && (
        <RisksSection
          risks={risks || []} onAck={ackRisk}
          isDirector={isDirector}
          onApprove={() => approveSection('risks')} onReturn={() => rejectSection('risks')}
          onEdit={(f, o, r) => onEdit('risks', f, o, r)}
          edits={edits.risks || {}}
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
          onEdit={(f, o, r) => onEdit(activeSection, f, o, r)}
          onApprove={() => approveSection(activeSection)}
          onReturn={() => rejectSection(activeSection)}
          busy={busy}
        />
      )}

      {/* Hidden view for PDF generation — off-screen instead of display:none for better capture */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '800px' }}>
        <div ref={printRef}>
          <PrintableView bid={bid} sections={sections} risks={risks || []} totalCost={totalCost} totalBid={totalBid} margin={margin} />
        </div>
      </div>
    </div>
  );
}

// ─── controls + sections ────────────────────────────────────────────────────

function ApprovalControls({ status, isDirector, onApprove, onReturn, onToggleEdit, isEditing, disabled, disabledReason, busy }) {
  if (!isDirector) return <span className="badge badge-primary">Awaiting Director</span>;
  
  if (isEditing) {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-outline btn-sm" onClick={onToggleEdit}>Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={onToggleEdit}>Done Editing</button>
      </div>
    );
  }

  const isApproved = status === 'approved';
  const isReturned = status === 'returned';

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {isApproved && <span className="badge badge-success" style={{ marginRight: 8 }}>{Icon.check(10)} Approved</span>}
      {isReturned && <span className="badge badge-error" style={{ marginRight: 8 }}>{Icon.flag(10)} Returned</span>}
      
      <button className="btn btn-ghost btn-sm" style={{ color: '#5929d0', fontWeight: 600 }} onClick={onToggleEdit}>
        {Icon.edit(10)} {isApproved ? 'Edit approved section' : 'Edit section'}
      </button>

      {!isApproved && (
        <>
          <button className="btn btn-outline btn-sm" disabled={busy} onClick={onReturn}>{Icon.flag(10)} Reject</button>
          <button className="btn btn-success btn-sm" disabled={disabled || busy} title={disabled ? disabledReason : ''} onClick={onApprove}>
            {Icon.check(11)} Approve
          </button>
        </>
      )}
    </div>
  );
}

function PricingSection({ bid, margin, pendingMargin, setPendingMargin, marginConfirmed, setMarginConfirmed, isDirector, totalCost, totalBid, marginVal, onApprove, onReturn, onApplyOverride, onEdit, edits, status, busy }) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div>
      <div className="card mb-16">
        <div className="card-header">
          <div>
            <div className="card-title">{Icon.pound(14)} Pricing Review · {bid.currency}</div>
            <div className="card-sub">Rate card applied · {pricingLines.length} lines</div>
          </div>
          <ApprovalControls 
            status={status} isDirector={isDirector} 
            onApprove={onApprove} onReturn={onReturn} 
            isEditing={isEditing} onToggleEdit={() => setIsEditing(!isEditing)}
            busy={busy} 
          />
        </div>
        <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <div className="kpi k-cyan" style={{ margin: 0 }}><div className="kpi-label">Total Cost</div><div className="kpi-value">{fmtMoney(totalCost, bid.currency)}</div></div>
          <div className="kpi" style={{ margin: 0 }}><div className="kpi-label">Bid Price</div><div className="kpi-value">{fmtMoney(totalBid, bid.currency)}</div></div>
          <div className="kpi k-pink" style={{ margin: 0 }}><div className="kpi-label">Effective Margin</div><div className="kpi-value">{marginVal}%</div></div>
        </div>
        {isDirector && isEditing && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', background: '#FAFBFD', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Adjust margin (Pipeline Build & ML lines)</div>
            <input type="range" min="18" max="32" step="1"
              value={pendingMargin ?? margin}
              onChange={e => setPendingMargin(+e.target.value)}
              style={{ flex: 1 }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#5929d0', minWidth: 50, textAlign: 'right' }}>{pendingMargin ?? margin}%</div>
            {pendingMargin !== null && pendingMargin !== margin &&
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => setMarginConfirmed('asking')}>Apply override</button>}
          </div>
        )}
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">Line items</div></div>
        <table className="dt" style={{ borderRadius: 0, border: 'none' }}>
          <thead><tr><th>Task</th><th>Role</th><th className="num">Rate</th><th className="num">Hours</th><th className="num">Margin</th><th className="num">Subtotal</th></tr></thead>
          <tbody>
            {pricingLines.map((l, i) => {
              const overridden = (l.task.includes('Pipeline Build — Transformation') || l.task.includes('ML')) && margin !== bid.margin;
              const useM = overridden ? margin : l.margin;
              const subtotal = l.rate * l.hours * (1 + useM / 100);
              const rowKey = `line-${i}`;
              
              return (
                <tr key={i}>
                  <td>
                    {isEditing ? (
                      <input className="input-inline" defaultValue={l.task} onBlur={e => onEdit(`${rowKey}.task`, l.task, e.target.value)} />
                    ) : (
                      <strong>{edits[`${rowKey}.task`]?.revised || l.task}</strong>
                    )}
                  </td>
                  <td>{l.role}</td>
                  <td className="num">
                    {isEditing ? (
                      <input className="input-inline num" style={{ width: 60 }} defaultValue={l.rate} onBlur={e => onEdit(`${rowKey}.rate`, l.rate.toString(), e.target.value)} />
                    ) : (
                      `£${(edits[`${rowKey}.rate`]?.revised || l.rate).toLocaleString()}`
                    )}
                  </td>
                  <td className="num">
                    {isEditing ? (
                      <input className="input-inline num" style={{ width: 50 }} defaultValue={l.hours} onBlur={e => onEdit(`${rowKey}.hours`, l.hours.toString(), e.target.value)} />
                    ) : (
                      edits[`${rowKey}.hours`]?.revised || l.hours
                    )}
                  </td>
                  <td className="num">{useM}%</td>
                  <td className="num"><strong>£{Math.round(subtotal).toLocaleString()}</strong></td>
                </tr>
              );
            })}
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

function RisksSection({ risks, onAck, isDirector, onApprove, onReturn, onEdit, edits, status, busy }) {
  const [isEditing, setIsEditing] = useState(false);

  const high = risks.filter(r => r.severity === 'High');
  const allHighAcked = high.every(r => r.acknowledged);
  const blockedReason = !allHighAcked ? `Acknowledge ${high.length} High-severity risks first (BR-005)` : '';
  
  return (
    <div>
      <div className="card mb-16">
        <div className="card-header">
          <div>
            <div className="card-title">{Icon.alert(14)} Risk Register · {risks.length} risks</div>
          </div>
          <ApprovalControls
            status={status} isDirector={isDirector}
            onApprove={onApprove} onReturn={onReturn}
            isEditing={isEditing} onToggleEdit={() => setIsEditing(!isEditing)}
            disabled={!allHighAcked} disabledReason={blockedReason} busy={busy}
          />
        </div>
        <div style={{ padding: '14px 20px' }}>
          {risks.length === 0 ? (
            <div style={{ color: '#94A3B8', textAlign: 'center', padding: 20 }}>No risks recorded</div>
          ) : (
            <table className="dt">
              <thead><tr><th>Risk</th><th>Severity</th><th>Mitigation</th><th>Ack</th></tr></thead>
              <tbody>
                {risks.map(r => (
                  <tr key={r.risk_id}>
                    <td style={{ maxWidth: 240 }}>
                      {isEditing ? (
                        <input className="input-inline" defaultValue={r.description} onBlur={e => onEdit(`${r.risk_id}.description`, r.description, e.target.value)} />
                      ) : (
                        edits[`${r.risk_id}.description`]?.revised || r.description
                      )}
                    </td>
                    <td><span className={`badge ${r.severity === 'High' ? 'badge-error' : 'badge-warning'}`} style={{ fontSize: 10 }}>{r.severity}</span></td>
                    <td>
                      {isEditing ? (
                        <input className="input-inline" defaultValue={r.mitigation} onBlur={e => onEdit(`${r.risk_id}.mitigation`, r.mitigation, e.target.value)} />
                      ) : (
                        edits[`${r.risk_id}.mitigation`]?.revised || r.mitigation
                      )}
                    </td>
                    <td>
                      {r.severity === 'High' && !r.acknowledged && isDirector && !isEditing &&
                        <button className="btn btn-outline btn-sm" onClick={() => onAck(r.risk_ref)}>ack</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function GenericSection({ section, apiSection, status, isDirector, onApprove, onReturn, onEdit, edits, busy }) {
  const [isEditing, setIsEditing] = useState(false);
  const compiledData = apiSection?.compiled_data || {};
  const sectionKey = apiSection?.section_key || section?.id;
  const sourceLabel = apiSection ? `Source: ${apiSection.source_module} · Confidence ${apiSection.confidence?.toFixed(3) || '—'}` : section?.sub;

  return (
    <div className="card mb-16">
      <div className="card-header">
        <div>
          <div className="card-title">{section?.name || apiSection?.section_name || 'Section'}</div>
          <div className="card-sub">{sourceLabel}</div>
        </div>
        <ApprovalControls 
          status={status} isDirector={isDirector} 
          onApprove={onApprove} onReturn={onReturn} 
          isEditing={isEditing} onToggleEdit={() => setIsEditing(!isEditing)}
          busy={busy} 
        />
      </div>
      <div className="card-pad">
        <SectionContent 
          sectionKey={sectionKey} compiledData={compiledData} 
          edits={edits} isDirector={isDirector} 
          isEditing={isEditing} onEdit={onEdit}
        />
      </div>
    </div>
  );
}

function SectionContent({ sectionKey, compiledData, edits, isDirector, isEditing, onEdit }) {
  if (!compiledData) {
    return <div style={{ color: '#94A3B8', padding: 20, textAlign: 'center' }}>No compiled data yet.</div>;
  }

  if (sectionKey === 'effort') {
    const rows = compiledData.tasks || [];
    return (
      <table className="dt">
        <thead><tr><th>Task</th><th>Role</th><th className="num">Hours</th><th className="num">Confidence</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>
                {isEditing ? (
                  <input className="input-inline" defaultValue={r.name} onBlur={e => onEdit(`${r.id}.name`, r.name, e.target.value)} />
                ) : (
                  <strong>{edits[`${r.id}.name`]?.revised || r.name}</strong>
                )}
              </td>
              <td>{r.role}</td>
              <td className="num">
                {isEditing ? (
                  <input className="input-inline num" style={{ width: 50 }} defaultValue={r.hours} onBlur={e => onEdit(`${r.id}.hours`, `${r.hours}h`, e.target.value)} />
                ) : (
                  edits[`${r.id}.hours`]?.revised || `${r.hours}h`
                )}
              </td>
              <td className="num">{(r.confidence || 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (sectionKey === 'schedule') {
    const phases = (compiledData.phases || []).map((p, i) => ({
      ...p, color: ['#5929d0', '#22D3EE', '#CF008B', '#16A34A'][i % 4],
    }));
    const totalWeeks = compiledData.duration_weeks || 14;
    const milestones = compiledData.milestones || [];
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: `140px repeat(${totalWeeks}, 1fr)`, gap: 4, alignItems: 'center', fontSize: 11, marginBottom: 18 }}>
          <div style={{ fontWeight: 600, color: '#94A3B8' }}>Phase</div>
          {Array.from({ length: totalWeeks }, (_, i) => <div key={i} style={{ textAlign: 'center', color: '#94A3B8', fontSize: 9.5 }}>W{i + 1}</div>)}
          {phases.map((p, pi) => (
            <React.Fragment key={pi}>
              <div style={{ fontWeight: 600, fontSize: 12 }}>
                {isEditing ? (
                  <input className="input-inline" defaultValue={p.name} onBlur={e => onEdit(`phase-${pi}.name`, p.name, e.target.value)} />
                ) : (
                  edits[`phase-${pi}.name`]?.revised || p.name
                )}
              </div>
              {Array.from({ length: totalWeeks }, (_, i) => (
                <div key={i} style={{ height: 24, background: p.weeks.includes(i + 1) ? p.color : '#F1F5F9', borderRadius: 4 }} />
              ))}
            </React.Fragment>
          ))}
        </div>
        {milestones.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>Milestones</div>
            <table className="dt">
              <thead><tr><th>Milestone</th><th>Start</th><th>End</th><th>Role</th></tr></thead>
              <tbody>
                {milestones.map((m, i) => (
                  <tr key={i}>
                    <td>
                      {isEditing ? (
                        <input className="input-inline" defaultValue={m.name} onBlur={e => onEdit(`MS-${i + 1}.name`, m.name, e.target.value)} />
                      ) : (
                        <strong>{edits[`MS-${i + 1}.name`]?.revised || m.name}</strong>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input className="input-inline" defaultValue={m.start_date} onBlur={e => onEdit(`MS-${i + 1}.start`, m.start_date, e.target.value)} />
                      ) : (
                        edits[`MS-${i + 1}.start`]?.revised || m.start_date
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input className="input-inline" defaultValue={m.end_date} onBlur={e => onEdit(`MS-${i + 1}.end`, m.end_date, e.target.value)} />
                      ) : (
                        edits[`MS-${i + 1}.end`]?.revised || m.end_date
                      )}
                    </td>
                    <td>{m.role}</td>
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
        <thead><tr><th>Deliverable</th><th>Acceptance</th><th>Responsible</th></tr></thead>
        <tbody>
          {items.map((d, i) => (
            <tr key={i}>
              <td>
                {isEditing ? (
                  <input className="input-inline" defaultValue={d.name} onBlur={e => onEdit(`${d.id}.name`, d.name, e.target.value)} />
                ) : (
                  <strong>{edits[`${d.id}.name`]?.revised || d.name}</strong>
                )}
              </td>
              <td>
                {isEditing ? (
                  <input className="input-inline" defaultValue={d.acceptance} onBlur={e => onEdit(`${d.id}.acceptance`, d.acceptance, e.target.value)} />
                ) : (
                  edits[`${d.id}.acceptance`]?.revised || d.acceptance
                )}
              </td>
              <td>{d.responsible}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (sectionKey === 'acceptance') {
    const items = compiledData.criteria || [];
    return (
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {items.map((c, i) => {
          const desc = typeof c === 'object' ? c.description : c;
          const id = typeof c === 'object' ? c.id : `AC-${i+1}`;
          return (
            <li key={i} style={{ marginBottom: 8 }}>
              {isEditing ? (
                <input className="input-inline" defaultValue={desc} onBlur={e => onEdit(`${id}.description`, desc, e.target.value)} />
              ) : (
                edits[`${id}.description`]?.revised || desc
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  if (sectionKey === 'quality') {
    return (
      <table className="dt">
        <thead><tr><th>Metric</th><th>Target</th><th>Measurement</th></tr></thead>
        <tbody>
          {(compiledData.metrics || []).map((m, i) => (
            <tr key={i}>
              <td><strong>{m.metric}</strong></td>
              <td>
                {isEditing ? (
                  <input className="input-inline" defaultValue={m.target} onBlur={e => onEdit(`metric-${i}.target`, m.target, e.target.value)} />
                ) : (
                  edits[`metric-${i}.target`]?.revised || m.target
                )}
              </td>
              <td>
                {isEditing ? (
                  <input className="input-inline" defaultValue={m.measurement} onBlur={e => onEdit(`metric-${i}.measurement`, m.measurement, e.target.value)} />
                ) : (
                  edits[`metric-${i}.measurement`]?.revised || m.measurement
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (sectionKey === 'dependencies') {
    return (
      <table className="dt">
        <thead><tr><th>Name</th><th>Link</th><th>Owner</th></tr></thead>
        <tbody>
          {[...(compiledData.internal || []), ...(compiledData.external || [])].map((d, i) => (
            <tr key={i}>
              <td>{d.name}</td>
              <td>
                {isEditing ? (
                  <input className="input-inline" defaultValue={d.linked_task} onBlur={e => onEdit(`dep-${i}.link`, d.linked_task, e.target.value)} />
                ) : (
                  edits[`dep-${i}.link`]?.revised || d.linked_task || '—'
                )}
              </td>
              <td>
                {isEditing ? (
                  <input className="input-inline" defaultValue={d.owner} onBlur={e => onEdit(`dep-${i}.owner`, d.owner, e.target.value)} />
                ) : (
                  edits[`dep-${i}.owner`]?.revised || d.owner || '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return <pre style={{ background: '#F8FAFC', padding: 12, borderRadius: 6, fontSize: 11, overflow: 'auto' }}>{JSON.stringify(compiledData, null, 2)}</pre>;
}

function PrintableView({ bid, sections, risks, totalCost, totalBid, margin }) {
  const logoPath = companyLogo;
  
  return (
    <div style={{ color: '#0F172A', fontFamily: "'Inter', -apple-system, sans-serif", backgroundColor: '#FFFFFF' }}>
      
      {/* --- COVER PAGE --- */}
      <div style={{ 
        height: '1000px', // Force full page height for capture
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center', 
        textAlign: 'center',
        padding: '0 80px',
        pageBreakAfter: 'always',
        borderBottom: '20px solid #5929d0'
      }}>
        <img src={logoPath} alt="Centific Logo" style={{ width: 180, marginBottom: 40 }} />
        
        <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: '-0.04em', color: '#0F172A', marginBottom: 12 }}>
          CENTIFIC
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#64748B', letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: 80 }}>
          Strategic Bid Proposal
        </div>

        <div style={{ width: '100%', height: '2px', background: 'linear-gradient(90deg, transparent, #E2E8F0, transparent)', marginBottom: 60 }}></div>

        <h1 style={{ margin: '0 0 24px 0', fontSize: 32, fontWeight: 800, color: '#0F172A', maxWidth: '600px', lineHeight: 1.2 }}>
          {bid.title}
        </h1>

        <div style={{ display: 'flex', gap: 60, marginTop: 40 }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Prepared for</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>{bid.client_name || bid.client}</div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Proposal Reference</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#5929d0' }}>{bid.bid_reference || bid.id}</div>
          </div>
        </div>

        <div style={{ marginTop: 100, fontSize: 12, color: '#64748B', fontWeight: 500 }}>
          Document Date: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      <div style={{ padding: '40px 50px' }}>
        {/* --- REPEATING HEADER FOR INTERNAL PAGES --- */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40, borderBottom: '1px solid #E2E8F0', paddingBottom: 15 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={logoPath} alt="Logo" style={{ width: 32, height: 32, borderRadius: 6 }} />
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>CENTIFIC</div>
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' }}>
            {bid.id} | Page Content
          </div>
        </div>
      
      {sections.map((s, idx) => (
        <div key={s.section_key} style={{ marginBottom: 40, pageBreakInside: 'avoid' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, borderBottom: '1px solid #E2E8F0', paddingBottom: 10 }}>
            <div style={{ width: 28, height: 28, background: '#5929d0', color: '#fff', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
              {idx + 1}
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0F172A' }}>{s.section_name}</h2>
          </div>

          {s.section_key === 'pricing' ? (
             <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 20 }}>
               <div style={{ display: 'flex', gap: 40, marginBottom: 24 }}>
                 <div>
                   <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Total Resource Cost</div>
                   <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>{fmtMoney(totalCost, bid.currency)}</div>
                 </div>
                 <div>
                   <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Applied Margin</div>
                   <div style={{ fontSize: 18, fontWeight: 700, color: '#CF008B' }}>{bid.currentMargin || bid.margin}%</div>
                 </div>
                 <div>
                   <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Total Proposal Value</div>
                   <div style={{ fontSize: 18, fontWeight: 700, color: '#5929d0' }}>{fmtMoney(totalBid, bid.currency)}</div>
                 </div>
               </div>
               <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                 <thead>
                   <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                     <th style={{ padding: '10px 12px', borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }}>Task</th>
                     <th style={{ padding: '10px 12px' }}>Role</th>
                     <th style={{ padding: '10px 12px', textAlign: 'right' }}>Rate</th>
                     <th style={{ padding: '10px 12px', textAlign: 'right' }}>Hours</th>
                     <th style={{ padding: '10px 12px', textAlign: 'right', borderTopRightRadius: 8, borderBottomRightRadius: 8 }}>Subtotal</th>
                   </tr>
                 </thead>
                 <tbody>
                   {pricingLines.map((l, i) => {
                     const overridden = (l.task.includes('Pipeline Build — Transformation') || l.task.includes('ML')) && margin !== bid.margin;
                     const useM = overridden ? margin : l.margin;
                     const subtotal = l.rate * l.hours * (1 + useM / 100);
                     return (
                       <tr key={i} style={{ borderBottom: '1px solid #E2E8F0' }}>
                         <td style={{ padding: '10px 12px', fontWeight: 600 }}>{l.task}</td>
                         <td style={{ padding: '10px 12px' }}>{l.role}</td>
                         <td style={{ padding: '10px 12px', textAlign: 'right' }}>£{l.rate.toLocaleString()}</td>
                         <td style={{ padding: '10px 12px', textAlign: 'right' }}>{l.hours}</td>
                         <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>£{Math.round(subtotal).toLocaleString()}</td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
             </div>
          ) : s.section_key === 'risks' ? (
             <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
               <thead>
                 <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                   <th style={{ padding: '10px 12px', borderTopLeftRadius: 8, borderBottomLeftRadius: 8, width: 60 }}>ID</th>
                   <th style={{ padding: '10px 12px' }}>Risk Description</th>
                   <th style={{ padding: '10px 12px', width: 80 }}>Severity</th>
                   <th style={{ padding: '10px 12px', borderTopRightRadius: 8, borderBottomRightRadius: 8 }}>Mitigation Strategy</th>
                 </tr>
               </thead>
               <tbody>
                 {risks.map(r => (
                   <tr key={r.risk_id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                     <td style={{ padding: '10px 12px', fontWeight: 700 }}>{r.risk_ref}</td>
                     <td style={{ padding: '10px 12px', lineHeight: 1.4 }}>{r.description}</td>
                     <td style={{ padding: '10px 12px' }}>
                        <span style={{ 
                          padding: '2px 8px', 
                          borderRadius: 4, 
                          background: r.severity === 'High' ? '#FEE2E2' : r.severity === 'Medium' ? '#FEF3C7' : '#DCFCE7',
                          color: r.severity === 'High' ? '#BE123C' : r.severity === 'Medium' ? '#B45309' : '#16A34A',
                          fontWeight: 700,
                          fontSize: 9
                        }}>
                          {r.severity}
                        </span>
                     </td>
                     <td style={{ padding: '10px 12px', color: '#475569', fontSize: 10.5 }}>{r.mitigation}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
          ) : s.section_key === 'effort' ? (
             <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
               <thead>
                 <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                   <th style={{ padding: '10px 12px', borderTopLeftRadius: 8, borderBottomLeftRadius: 8, width: 80 }}>Task ID</th>
                   <th style={{ padding: '10px 12px' }}>Description</th>
                   <th style={{ padding: '10px 12px' }}>Resource Role</th>
                   <th style={{ padding: '10px 12px', textAlign: 'right', borderTopRightRadius: 8, borderBottomRightRadius: 8 }}>Estimated Hours</th>
                 </tr>
               </thead>
               <tbody>
                 {(s.compiled_data?.tasks || []).map((t, i) => (
                   <tr key={i} style={{ borderBottom: '1px solid #E2E8F0' }}>
                     <td style={{ padding: '10px 12px', fontWeight: 700 }}>{t.id}</td>
                     <td style={{ padding: '10px 12px' }}>{t.name}</td>
                     <td style={{ padding: '10px 12px' }}>{t.role}</td>
                     <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{t.hours}h</td>
                   </tr>
                 ))}
                 <tr style={{ background: '#F8FAFC', fontWeight: 800 }}>
                   <td colSpan="3" style={{ padding: '12px', textAlign: 'right', color: '#64748B' }}>TOTAL ESTIMATED EFFORT</td>
                   <td style={{ padding: '12px', textAlign: 'right', color: '#5929d0', fontSize: 14 }}>
                    {s.compiled_data?.summary?.total_hours || (s.compiled_data?.tasks || []).reduce((acc, t) => acc + t.hours, 0)}h
                   </td>
                 </tr>
               </tbody>
             </table>
          ) : s.section_key === 'schedule' ? (
             <div>
               <div style={{ marginBottom: 20, display: 'flex', gap: 12 }}>
                 <div style={{ background: '#F0F9FF', padding: '8px 16px', borderRadius: 8, border: '1px solid #BAE6FD' }}>
                    <span style={{ fontSize: 10, color: '#0369A1', textTransform: 'uppercase', fontWeight: 700 }}>Project Duration</span>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0C4A6E' }}>{s.compiled_data?.duration_weeks || 14} Weeks</div>
                 </div>
               </div>
               <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                 <thead>
                   <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                     <th style={{ padding: '10px 12px', borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }}>Milestone</th>
                     <th style={{ padding: '10px 12px' }}>Start Date</th>
                     <th style={{ padding: '10px 12px' }}>End Date</th>
                     <th style={{ padding: '10px 12px', borderTopRightRadius: 8, borderBottomRightRadius: 8 }}>Responsible</th>
                   </tr>
                 </thead>
                 <tbody>
                   {(s.compiled_data?.milestones || []).map((m, i) => (
                     <tr key={i} style={{ borderBottom: '1px solid #E2E8F0' }}>
                       <td style={{ padding: '10px 12px', fontWeight: 700 }}>{m.name}</td>
                       <td style={{ padding: '10px 12px' }}>{m.start_date ? new Date(m.start_date).toLocaleDateString('en-GB') : '—'}</td>
                       <td style={{ padding: '10px 12px' }}>{m.end_date ? new Date(m.end_date).toLocaleDateString('en-GB') : '—'}</td>
                       <td style={{ padding: '10px 12px' }}>{m.role}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          ) : s.section_key === 'deliverables' ? (
             <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
               <thead>
                 <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                   <th style={{ padding: '10px 12px', borderTopLeftRadius: 8, borderBottomLeftRadius: 8, width: 60 }}>ID</th>
                   <th style={{ padding: '10px 12px' }}>Deliverable</th>
                   <th style={{ padding: '10px 12px' }}>Format</th>
                   <th style={{ padding: '10px 12px', borderTopRightRadius: 8, borderBottomRightRadius: 8 }}>Responsible</th>
                 </tr>
               </thead>
               <tbody>
                 {((s.compiled_data?.items || s.compiled_data) || []).map((d, i) => (
                   <tr key={i} style={{ borderBottom: '1px solid #E2E8F0' }}>
                     <td style={{ padding: '10px 12px', fontWeight: 700 }}>{d.id}</td>
                     <td style={{ padding: '10px 12px' }}>
                       <div style={{ fontWeight: 600 }}>{d.name}</div>
                       <div style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>{d.description}</div>
                     </td>
                     <td style={{ padding: '10px 12px' }}>{d.format}</td>
                     <td style={{ padding: '10px 12px' }}>{d.responsible}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
          ) : s.section_key === 'acceptance' ? (
             <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
               <thead>
                 <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                   <th style={{ padding: '10px 12px', borderTopLeftRadius: 8, borderBottomLeftRadius: 8, width: 80 }}>Ref</th>
                   <th style={{ padding: '10px 12px' }}>Acceptance Criterion</th>
                   <th style={{ padding: '10px 12px' }}>Verification Method</th>
                   <th style={{ padding: '10px 12px', borderTopRightRadius: 8, borderBottomRightRadius: 8 }}>Responsible</th>
                 </tr>
               </thead>
               <tbody>
                 {(s.compiled_data?.criteria || []).map((c, i) => (
                   <tr key={i} style={{ borderBottom: '1px solid #E2E8F0' }}>
                     <td style={{ padding: '10px 12px', fontWeight: 700 }}>{c.id || `AC-${i+1}`}</td>
                     <td style={{ padding: '10px 12px' }}>{c.description || c}</td>
                     <td style={{ padding: '10px 12px' }}>{c.verification || '—'}</td>
                     <td style={{ padding: '10px 12px' }}>{c.responsible || '—'}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
          ) : s.section_key === 'quality' ? (
             <div>
               <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                 {(s.compiled_data?.standards || []).map((std, si) => (
                   <span key={si} style={{ background: '#F0F9FF', color: '#0369A1', padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, border: '1px solid #BAE6FD' }}>
                     {std}
                   </span>
                 ))}
               </div>
               <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                 <thead>
                   <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                     <th style={{ padding: '10px 12px', borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }}>Quality Metric</th>
                     <th style={{ padding: '10px 12px' }}>Target Threshold</th>
                     <th style={{ padding: '10px 12px', borderTopRightRadius: 8, borderBottomRightRadius: 8 }}>Measurement Method</th>
                   </tr>
                 </thead>
                 <tbody>
                   {(s.compiled_data?.metrics || []).map((m, i) => (
                     <tr key={i} style={{ borderBottom: '1px solid #E2E8F0' }}>
                       <td style={{ padding: '10px 12px', fontWeight: 700 }}>{m.metric}</td>
                       <td style={{ padding: '10px 12px' }}>{m.target}</td>
                       <td style={{ padding: '10px 12px' }}>{m.measurement}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          ) : s.section_key === 'dependencies' ? (
             <div>
               <div style={{ fontSize: 12, fontWeight: 700, color: '#5929d0', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Internal Project Dependencies</div>
               <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 24 }}>
                 <thead>
                   <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                     <th style={{ padding: '10px 12px', borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }}>Dependency Name</th>
                     <th style={{ padding: '10px 12px' }}>Linked Task</th>
                     <th style={{ padding: '10px 12px' }}>Owner</th>
                     <th style={{ padding: '10px 12px', borderTopRightRadius: 8, borderBottomRightRadius: 8 }}>Status</th>
                   </tr>
                 </thead>
                 <tbody>
                   {(s.compiled_data?.internal || []).map((d, i) => (
                     <tr key={i} style={{ borderBottom: '1px solid #E2E8F0' }}>
                       <td style={{ padding: '10px 12px', fontWeight: 600 }}>{d.name}</td>
                       <td style={{ padding: '10px 12px', color: '#5929d0' }}>{d.linked_task || '—'}</td>
                       <td style={{ padding: '10px 12px' }}>{d.owner}</td>
                       <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: d.status === 'confirmed' ? '#16A34A' : '#D97706' }}>
                            {d.status?.toUpperCase()}
                          </span>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
               <div style={{ fontSize: 12, fontWeight: 700, color: '#06B6D4', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>External & Client Dependencies</div>
               <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                 <thead>
                   <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                     <th style={{ padding: '10px 12px', borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }}>Dependency Name</th>
                     <th style={{ padding: '10px 12px' }}>Linked Task</th>
                     <th style={{ padding: '10px 12px' }}>Owner</th>
                     <th style={{ padding: '10px 12px', borderTopRightRadius: 8, borderBottomRightRadius: 8 }}>Status</th>
                   </tr>
                 </thead>
                 <tbody>
                   {(s.compiled_data?.external || []).map((d, i) => (
                     <tr key={i} style={{ borderBottom: '1px solid #E2E8F0' }}>
                       <td style={{ padding: '10px 12px', fontWeight: 600 }}>{d.name}</td>
                       <td style={{ padding: '10px 12px', color: '#06B6D4' }}>{d.linked_task || '—'}</td>
                       <td style={{ padding: '10px 12px' }}>{d.owner}</td>
                       <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: d.status === 'confirmed' ? '#16A34A' : '#D97706' }}>
                            {d.status?.toUpperCase()}
                          </span>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>           ) : (
            <div style={{ fontSize: 11, background: '#F8FAFC', padding: 20, borderRadius: 12, whiteSpace: 'pre-wrap', border: '1px solid #E2E8F0', color: '#475569' }}>
               {JSON.stringify(s.compiled_data, null, 2)}
            </div>
          )}
        </div>
      ))}
      </div>

      {/* --- FOOTER --- */}
      <div style={{ marginTop: 60, borderTop: '1px solid #E2E8F0', paddingTop: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: '#94A3B8', letterSpacing: '0.05em' }}>
          CONFIDENTIAL · GENERATED BY CENTIFIC BID MANAGEMENT SYSTEM · © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
