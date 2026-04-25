import React, { useState, useEffect } from 'react';
import { Icon } from '../components/ui/Icon';
import { bidsApi } from '../api/client';
import { useBids } from '../hooks/useApiData';

const FOCUSED_BID = 'BID-2026-041';

export default function PricingPanel({ user }) {
  const isDirector = user.id === 'director';
  const { bids } = useBids();
  const focused = bids?.find(b => b.id === FOCUSED_BID) || bids?.[0];

  const [lines, setLines]   = useState(null);
  const [error, setError]   = useState(null);
  const [reload, setReload] = useState(0);
  const [editIdx, setEditIdx] = useState(null);
  const [editValue, setEditValue] = useState(0);
  const [confirmModal, setConfirmModal] = useState(null);
  const [resolveModal, setResolveModal] = useState(null);
  const [busy, setBusy]   = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!focused) return;
    let alive = true;
    setError(null);
    bidsApi.getPricingLines(focused.id)
      .then(rows => { if (alive) setLines(rows); })
      .catch(e => { if (alive) setError(e); });
    return () => { alive = false; };
  }, [focused?.id, reload]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 2400); return () => clearTimeout(t); } }, [toast]);

  if (!focused) return <div style={{ padding: 40, color: '#94A3B8' }}>Loading bid…</div>;
  if (error)    return <div style={{ padding: 40, color: '#DC2626' }}>API error: {String(error)}</div>;
  if (!lines)   return <div style={{ padding: 40, color: '#94A3B8' }}>Loading pricing lines…</div>;

  const hasMissingRate = lines.some(l => l.is_missing_rate);

  function openEdit(line) {
    if (!isDirector) return;
    setEditIdx(line.line_no);
    setEditValue(line.margin_pct);
  }

  function requestConfirm(line) {
    if (line.margin_pct === editValue) { setEditIdx(null); return; }
    setConfirmModal({
      line_no:    line.line_no,
      task:       line.task,
      oldMargin:  line.margin_pct,
      newMargin:  editValue,
    });
  }

  async function commitOverride() {
    setBusy(true);
    try {
      await bidsApi.updateLineMargin(focused.id, confirmModal.line_no, {
        performed_by: user.name, role: 'Director',
        note: String(confirmModal.newMargin),
      });
      setToast(`Override logged: ${confirmModal.task} ${confirmModal.oldMargin}% → ${confirmModal.newMargin}%`);
      setReload(r => r + 1);
    } catch (e) {
      setToast(`Error: ${e.response?.data?.detail || e.message}`);
    } finally {
      setBusy(false); setConfirmModal(null); setEditIdx(null);
    }
  }

  async function commitRate() {
    setBusy(true);
    try {
      await bidsApi.resolveMissingRate(focused.id, resolveModal.line_no, {
        performed_by: user.name, role: 'Director',
        note: String(resolveModal.newRate),
      });
      setToast(`Rate set: £${resolveModal.newRate}/h`);
      setReload(r => r + 1);
    } catch (e) {
      setToast(`Error: ${e.response?.data?.detail || e.message}`);
    } finally {
      setBusy(false); setResolveModal(null);
    }
  }

  const totalCost = lines.reduce((s, l) => s + (l.is_missing_rate ? 0 : (l.rate || 0) * l.hours), 0);
  const totalBid  = lines.reduce((s, l) => s + (l.is_missing_rate ? 0 : (l.rate || 0) * l.hours * (1 + l.margin_pct / 100)), 0);
  const symbol    = focused.currency === 'GBP' ? '£' : '€';

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#0F172A', color: '#fff', padding: '10px 16px', borderRadius: 10, fontSize: 12, zIndex: 2000, boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
          {toast}
        </div>
      )}
      <div className="page-banner" style={{ background: 'linear-gradient(90deg, #16A34A 0%, #5929d0 100%)' }}>
        <div className="page-banner-dot" />
        <div className="page-banner-text">
          <div className="page-banner-title">Pricing Review Panel</div>
          <div className="page-banner-sub">{focused.id} · {focused.client} · BR-003 (margin override per line, director-only) · {lines.length} lines</div>
        </div>
      </div>

      {hasMissingRate && (
        <div className="card" style={{ marginBottom: 14, background: '#FEF2F2', border: '1px solid #FCA5A5' }}>
          <div className="card-pad" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {Icon.alert(15)}
            <div style={{ flex: 1, fontSize: 12.5, color: '#991B1B' }}>
              <strong>Section blocked.</strong> Rate card has no entry for {lines.filter(l => l.is_missing_rate).map(l => `${l.role} on '${l.task}'`).join(', ')}.
            </div>
            {isDirector && (
              <button className="btn btn-outline btn-sm" onClick={() => {
                const l = lines.find(x => x.is_missing_rate);
                setResolveModal({ line_no: l.line_no, role: l.role, task: l.task, newRate: 800 });
              }}>Resolve missing rate</button>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div className="card"><div className="card-pad">
          <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Total cost</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0F172A' }}>{symbol}{totalCost.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>{lines.length} lines · rates × hours</div>
        </div></div>
        <div className="card"><div className="card-pad">
          <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Bid total</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#5929d0' }}>{symbol}{Math.round(totalBid).toLocaleString()}</div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>per-line margins applied</div>
        </div></div>
        <div className="card"><div className="card-pad">
          <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Effective margin</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#CF008B' }}>{totalCost > 0 ? ((totalBid / totalCost - 1) * 100).toFixed(1) : '—'}%</div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>blended across lines</div>
        </div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Task-wise pricing — {lines.length} lines</div>
          <span style={{ fontSize: 11, color: '#64748B' }}>BR-003 · BR-004 · live from bid_pricing_lines</span>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Task</th><th>Role</th><th>Rate</th><th>Hours</th><th>Unit</th><th>Subtotal</th><th>Margin</th><th>Line total</th><th>Action</th></tr>
          </thead>
          <tbody>
            {lines.map(l => {
              const isMissing = l.is_missing_rate;
              const subtotal = isMissing ? 0 : (l.rate || 0) * l.hours;
              const lineTotal = subtotal * (1 + l.margin_pct / 100);
              const isEditing = editIdx === l.line_no;
              return (
                <tr key={l.line_no} style={{ background: isMissing ? '#FEF2F2' : 'transparent' }}>
                  <td>{l.task}</td>
                  <td>{l.role}</td>
                  <td>
                    {isMissing
                      ? <span className="badge badge-error" style={{ fontSize: 10 }}>{Icon.flag(9)} Missing Rate</span>
                      : <span style={{ color: '#475569' }}>{symbol}{l.rate}</span>}
                  </td>
                  <td>{l.hours}</td>
                  <td style={{ fontSize: 11, color: '#64748B' }}>{l.unit}</td>
                  <td>{isMissing ? <span style={{ color: '#CBD5E1' }}>—</span> : `${symbol}${subtotal.toLocaleString()}`}</td>
                  <td>
                    {isEditing ? (
                      <input type="number" min="10" max="40" value={editValue}
                        onChange={e => setEditValue(+e.target.value)}
                        style={{ width: 64, padding: '4px 8px', border: '1px solid #5929d0', borderRadius: 4, fontSize: 12 }} />
                    ) : (
                      <span className="badge" style={{ background: '#E8E5FF', color: '#5929d0', fontSize: 11 }}>{l.margin_pct}%</span>
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>{isMissing ? <span style={{ color: '#CBD5E1' }}>—</span> : `${symbol}${Math.round(lineTotal).toLocaleString()}`}</td>
                  <td>
                    {isMissing
                      ? (isDirector ? <button className="btn btn-outline btn-sm" onClick={() => setResolveModal({ line_no: l.line_no, role: l.role, task: l.task, newRate: 800 })}>Set rate</button> : <span style={{ fontSize: 10.5, color: '#94A3B8' }}>Director only</span>)
                      : isEditing
                        ? <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-success btn-sm" disabled={busy} onClick={() => requestConfirm(l)}>Confirm</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setEditIdx(null)}>Cancel</button>
                          </div>
                        : isDirector
                          ? <button className="btn btn-outline btn-sm" onClick={() => openEdit(l)}>Edit margin</button>
                          : <span style={{ fontSize: 10.5, color: '#94A3B8' }}>Director only</span>}
                  </td>
                </tr>
              );
            })}
            <tr style={{ background: '#FAFBFD', fontWeight: 700 }}>
              <td colSpan="7" style={{ textAlign: 'right' }}>Bid total</td>
              <td colSpan="2"><strong style={{ color: '#5929d0' }}>{symbol}{Math.round(totalBid).toLocaleString()}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      {confirmModal && (
        <Modal title="Confirm margin override" subtitle="BR-003 · director sign-off · logged to audit" onCancel={() => setConfirmModal(null)} onConfirm={commitOverride} busy={busy}>
          Confirm margin override from <strong>{confirmModal.oldMargin}%</strong> to <strong style={{ color: '#CF008B' }}>{confirmModal.newMargin}%</strong> on <strong>{confirmModal.task}</strong>.
        </Modal>
      )}

      {resolveModal && (
        <Modal title="Set missing rate" subtitle={`${resolveModal.role} · ${resolveModal.task}`} onCancel={() => setResolveModal(null)} onConfirm={commitRate} busy={busy}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Rate (£/hour):</label>
            <input type="number" value={resolveModal.newRate} onChange={e => setResolveModal({ ...resolveModal, newRate: +e.target.value })}
              style={{ width: 100, padding: '6px 10px', border: '1px solid #5929d0', borderRadius: 6, fontSize: 13 }} />
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, subtitle, children, onConfirm, onCancel, busy }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 480, padding: 22, boxShadow: '0 24px 80px rgba(15,23,42,0.32)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FFD6F4', color: '#CF008B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {Icon.flag(16)}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{title}</div>
            <div style={{ fontSize: 11, color: '#64748B' }}>{subtitle}</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#0F172A', lineHeight: 1.5, marginBottom: 16 }}>{children}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={onConfirm}>{Icon.check(11)} Confirm</button>
        </div>
      </div>
    </div>
  );
}
