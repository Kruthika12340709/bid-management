import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '../components/ui/Icon';
import { useAuditLog } from '../hooks/useApiData';
import Pagination from '../components/ui/Pagination';

const PAGE_SIZE = 15;

const USER_LABEL = {
  director: 'Priya Menon',
  manager:  'Arjun Kapoor',
  system:   'Bid Engine',
};

const ACTION_FILTERS = [
  { k: 'all',         label: 'All actions',     match: () => true },
  { k: 'approved',    label: 'Approved',        match: e => e.action === 'Approved' },
  { k: 'edited',      label: 'Edited',          match: e => e.action === 'Edited' },
  { k: 'rejected',    label: 'Rejected',        match: e => e.action === 'Rejected' },
  { k: 'submitted',   label: 'Submitted',       match: e => e.action === 'Submitted' },
  { k: 'inputs',      label: 'Input Confirmed', match: e => e.action === 'Input Confirmed' },
];

export default function AuditLog() {
  const [search, setSearch]   = useState('');
  const [actionK, setActionK] = useState('all');
  const [userF, setUserF]     = useState('all');
  const [from, setFrom]       = useState('');
  const [to, setTo]           = useState('');
  const [page, setPage]       = useState(1);

  const { entries, error } = useAuditLog();

  const visible = useMemo(() => {
    if (!entries) return [];
    return entries.filter(e => {
      if (actionK !== 'all') {
        const f = ACTION_FILTERS.find(x => x.k === actionK);
        if (f && !f.match(e)) return false;
      }
      if (userF !== 'all' && e.user !== userF) return false;
      const dayOnly = e.ts.slice(0, 10);
      if (from && dayOnly < from) return false;
      if (to && dayOnly > to) return false;
      if (search) {
        const s = search.toLowerCase();
        const blob = `${e.bid} ${e.section} ${e.action} ${e.original} ${e.revised} ${USER_LABEL[e.user]} ${e.role} ${e.detail}`.toLowerCase();
        if (!blob.includes(s)) return false;
      }
      return true;
    });
  }, [entries, search, actionK, userF, from, to]);

  useEffect(() => setPage(1), [visible.length]);
  const paginated = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportCSV() {
    const header = ['Timestamp (UTC)', 'Bid Ref', 'Section', 'Action', 'Original', 'Revised', 'User', 'Role', 'Details'];
    const rows = visible.map(e => [e.ts, e.bid, e.section, e.action, e.original, e.revised, USER_LABEL[e.user], e.role, e.detail]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <div className="page-banner" style={{ background: 'linear-gradient(90deg, #001427 0%, #0E2E89 50%, #5929d0 100%)' }}>
        <div className="page-banner-dot" />
        <div className="page-banner-text">
          <div className="page-banner-title">Audit Log & Correction History</div>
          <div className="page-banner-sub">Append-only · 7-year retention · BR-005, BR-006, AC-10 compliance</div>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn primary" onClick={exportCSV}>{Icon.arrow(11, 'right')} Download CSV</button>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-search">
          {Icon.search(14)}
          <input placeholder="Search bid ID, section, action, user…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="filter-pills">
          {ACTION_FILTERS.map(f => {
            const count = (entries || []).filter(f.match).length;
            return (
              <button key={f.k} className={`filter-pill ${actionK === f.k ? 'active' : ''}`} onClick={() => setActionK(f.k)}>
                {f.label} <span className="count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) auto', gap: 14, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 10.5, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 4 }}>From date</div>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12 }} />
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 4 }}>To date</div>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12 }} />
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 4 }}>User</div>
            <select value={userF} onChange={e => setUserF(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12, background: '#fff' }}>
              <option value="all">All users</option>
              <option value="director">Priya Menon (Director)</option>
              <option value="manager">Arjun Kapoor (Manager)</option>
              <option value="system">Bid Engine (System)</option>
            </select>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => { setSearch(''); setActionK('all'); setUserF('all'); setFrom(''); setTo(''); }}>
            Clear filters
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-header">
          <div className="card-title">
            {entries === null ? 'Loading…' : `${visible.length} entries · append-only`}

            {error && <span style={{ color: '#DC2626', fontWeight: 500, marginLeft: 8, fontSize: 11 }}>API error: {String(error)}</span>}
          </div>
          <span className="badge badge-neutral" style={{ fontSize: 10 }}>Immutable · log entries cannot be edited or deleted</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 140 }}>Timestamp (UTC)</th>
              <th>Bid Ref</th><th>Section</th><th>Action</th>
              <th>Original Value</th><th>Revised Value</th>
              <th>User</th><th>Role</th><th>Details</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((e, i) => (
              <tr key={i}>
                <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>{e.ts}</td>
                <td><strong style={{ fontSize: 11.5, color: '#5929d0', fontFamily: 'ui-monospace, monospace' }}>{e.bid}</strong></td>
                <td><span className="badge badge-neutral" style={{ fontSize: 10 }}>{e.section}</span></td>
                <td><strong style={{ fontSize: 11.5, fontWeight: 600 }}>{e.action}</strong></td>
                <td style={{ fontSize: 11.5, color: e.original === '—' ? '#CBD5E1' : '#475569' }}>{e.original}</td>
                <td style={{ fontSize: 11.5, color: '#0F172A', fontWeight: 500 }}>{e.revised}</td>
                <td style={{ fontSize: 11.5, color: '#475569' }}>{USER_LABEL[e.user]}</td>
                <td>
                  <span className={`badge ${e.role === 'Director' ? 'badge-pink' : e.role === 'Manager' ? 'badge-primary' : 'badge-neutral'}`} style={{ fontSize: 10 }}>
                    {e.role}
                  </span>
                </td>
                <td style={{ fontSize: 11, color: '#64748B' }}>{e.detail}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan="9" style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>No log entries match the current filters.</td></tr>
            )}
          </tbody>
        </table>
        <Pagination total={visible.length} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>
    </div>
  );
}
