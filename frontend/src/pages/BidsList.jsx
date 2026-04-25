import React, { useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { BidRow } from './Dashboard';
import { useBids } from '../hooks/useApiData';
import { downloadCSV } from '../utils/csv';

export default function BidsList({ user, onOpenBid, onTabChange }) {
  const { bids, error } = useBids();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const isDirector = user.id === 'director';

  if (error) return <div style={{ padding: 40, color: '#DC2626' }}>API error: {String(error)}</div>;
  if (!bids) return <div style={{ padding: 40, color: '#94A3B8' }}>Loading bids…</div>;

  const filters = [
    { k: 'all',      label: 'All bids',                                 count: bids.length },
    { k: 'mine',     label: isDirector ? 'My queue' : 'Assigned to me', count: bids.filter(b => b.assigned === user.id).length },
    { k: 'pending',  label: 'Pending HIL',                              count: bids.filter(b => b.stage === 'pending').length },
    { k: 'compiling',label: 'Compiling',                                count: bids.filter(b => b.stage === 'compiling').length },
    { k: 'flagged',  label: 'Flagged',                                  count: bids.filter(b => (b.flags.lowConf + b.flags.conflicts + b.flags.missingRate + b.flags.highRisk) > 0).length },
    { k: 'urgent',   label: '< 5 days',                                 count: bids.filter(b => b.daysLeft <= 5 && b.stage !== 'submitted').length },
  ];

  let visible = bids;
  if      (filter === 'mine')     visible = visible.filter(b => b.assigned === user.id);
  else if (filter === 'pending')  visible = visible.filter(b => b.stage === 'pending');
  else if (filter === 'compiling')visible = visible.filter(b => b.stage === 'compiling' || b.stage === 'validating');
  else if (filter === 'flagged')  visible = visible.filter(b => (b.flags.lowConf + b.flags.conflicts + b.flags.missingRate + b.flags.highRisk) > 0);
  else if (filter === 'urgent')   visible = visible.filter(b => b.daysLeft <= 5 && b.stage !== 'submitted');

  if (search) {
    const s = search.toLowerCase();
    visible = visible.filter(b => b.title.toLowerCase().includes(s) || b.client.toLowerCase().includes(s) || b.id.toLowerCase().includes(s));
  }

  return (
    <div>
      <div className="page-banner" style={{ background: 'linear-gradient(90deg, #5929d0 0%, #8b3fb8 50%, #CF008B 100%)' }}>
        <div className="page-banner-dot" />
        <div className="page-banner-text">
          <div className="page-banner-title">Bid Pipeline · {visible.length} of {bids.length} bids</div>
          <div className="page-banner-sub">RFP reference, deadline, days remaining and stage status across the active book</div>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn" onClick={() => downloadCSV(`bids-${new Date().toISOString().slice(0, 10)}.csv`, visible, [
            { key: 'id',     label: 'Bid ID' },
            { key: 'client', label: 'Client' },
            { key: 'rfp',    label: 'RFP' },
            { key: 'stage',  label: 'Stage' },
            { key: 'value',  label: 'Value', format: v => v.toLocaleString() },
            { key: 'currency', label: 'Currency' },
            { key: 'deadline', label: 'Deadline', format: v => v ? v.slice(0, 10) : '' },
            { key: 'daysLeft', label: 'Days Left' },
            { key: 'sectionsComplete', label: 'Sections' },
            { key: 'outcome', label: 'Outcome' },
          ])}>Export</button>
          {!isDirector && <button className="page-banner-btn primary" onClick={() => onTabChange?.('inputs')}>+ New compilation</button>}
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-search">
          {Icon.search(14)}
          <input placeholder="Search by client, RFP, bid ID…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="filter-pills">
          {filters.map(f => (
            <button key={f.k} className={`filter-pill ${filter === f.k ? 'active' : ''}`} onClick={() => setFilter(f.k)}>
              {f.label} <span className="count">{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bids-table">
        <table className="data-table">
          <thead>
            <tr><th>Bid / ID</th><th>Client</th><th>RFP Reference</th><th>Stage</th><th>Value</th><th>Sections</th><th>Deadline</th><th>Flags</th><th>Owner</th><th></th></tr>
          </thead>
          <tbody>
            {visible.map(b => <BidRow key={b.id} bid={b} onClick={() => onOpenBid(b)} />)}
            {visible.length === 0 && (
              <tr><td colSpan="10" style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>No bids match the current filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
