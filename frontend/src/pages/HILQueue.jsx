import React from 'react';
import { Icon } from '../components/ui/Icon';
import { useBids } from '../hooks/useApiData';
import { users } from '../utils/adapt';

export default function HILQueue({ user, onOpenBid }) {
  const { bids, error } = useBids();
  const isDirector = user.id === 'director';

  if (error) return <div style={{ padding: 40, color: '#DC2626' }}>API error: {String(error)}</div>;
  if (!bids) return <div style={{ padding: 40, color: '#94A3B8' }}>Loading queue…</div>;

  const queue = bids.filter(b => b.stage === 'pending').sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <div>
      <div className="page-banner" style={{ background: 'linear-gradient(90deg, #CF008B 0%, #8b3fb8 50%, #5929d0 100%)' }}>
        <div className="page-banner-dot" />
        <div className="page-banner-text">
          <div className="page-banner-title">Interactive HIL Approval · {queue.length} awaiting</div>
          <div className="page-banner-sub">{isDirector ? 'Bid Director — primary approval gate (BR-002, BR-003, BR-005)' : 'Bid Manager — co-review and override secondary confirmation'}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18, background: 'linear-gradient(135deg,#FFF7ED,#FEF3C7)', border: '1px solid #FCD34D' }}>
        <div className="card-pad" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#F59E0B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Icon.clock(18)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>SLA · approval cycle target ≤ 4h</div>
            <div style={{ fontSize: 11.5, color: '#78350F', marginTop: 2 }}>2 of {queue.length} bids exceed the 4h SLA · oldest in-queue: 6h 14m</div>
          </div>
          <button className="btn btn-outline btn-sm">View SLA report</button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        {queue.map(b => {
          const totalFlags = b.flags.lowConf + b.flags.conflicts + b.flags.missingRate + b.flags.highRisk;
          return (
            <div key={b.id} className="card" style={{ cursor: 'pointer' }} onClick={() => onOpenBid(b)}>
              <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 18, alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#5929d0', fontWeight: 600 }}>{b.id}</span>
                    {b.daysLeft <= 5 && <span className="badge badge-error">⏱ {b.daysLeft}d</span>}
                    {b.flags.highRisk > 0 && <span className="badge badge-error">{b.flags.highRisk} High risk</span>}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{b.title}</div>
                  <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>{b.client} · {b.rfp}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Bid value</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>{b.currency === 'GBP' ? '£' : '€'}{(b.value / 1000).toFixed(0)}k</div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>Margin {b.currentMargin}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Sections</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>{b.sectionsComplete}/{b.sectionsTotal}</div>
                  <div style={{ fontSize: 11, color: totalFlags ? '#DC2626' : '#16A34A' }}>{totalFlags ? `${totalFlags} flag${totalFlags !== 1 ? 's' : ''}` : 'clean'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Reviewer</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <div className={`user-avatar ${users[b.assigned].avatarClass}`} style={{ width: 24, height: 24, fontSize: 10 }}>{users[b.assigned].initials}</div>
                    <span style={{ fontSize: 12, color: '#0F172A', fontWeight: 600 }}>{users[b.assigned].name.split(' ')[0]}</span>
                  </div>
                </div>
                <button className="btn btn-primary btn-sm">{isDirector ? 'Review & approve' : 'Open for co-review'} {Icon.arrow(11)}</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
