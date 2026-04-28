import React from 'react';
import { useAuditLog } from '../../hooks/useApiData';

// Map an audit log entry → commentary item shape
function adaptToCommentary(e) {
  const tags = [];
  if (e.action) tags.push(e.action);
  if (e.role && e.role !== 'System') tags.push(e.role);

  let text;
  if (e.action === 'Edited' && e.original !== '—' && e.revised !== '—') {
    text = `${e.detail || 'Edited'} (${e.original} → ${e.revised})`;
  } else if (e.action === 'Acknowledged' && e.revised !== '—') {
    text = `${e.revised}. ${e.detail || ''}`.trim();
  } else if (e.action === 'Approved' || e.action === 'Rejected' || e.action === 'Submitted' || e.action === 'Sign-off' || e.action === 'Outcome') {
    text = `${e.action} ${e.section !== '—' ? `· ${e.section}` : ''}${e.detail ? ` — ${e.detail}` : ''}`;
  } else {
    text = e.detail || `${e.action}${e.section !== '—' ? ` ${e.section}` : ''}`;
  }

  return {
    time: e.ts ? e.ts.slice(11, 16) : '',
    author: { director: 'Priya Menon', manager: 'Arjun Kapoor', system: 'Bid Engine' }[e.user] || e.user,
    authorClass: e.user,
    text,
    tags,
    bidRef: e.bid,
  };
}

export default function Commentary({ user, bidContext }) {
  const feedRef = React.useRef(null);

  const { entries, error } = useAuditLog(
    bidContext ? { bid_ref: bidContext, limit: 50 } : { limit: 50 },
    8000
  );

  const items = (entries || []).map(adaptToCommentary).reverse();

  React.useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [items.length]);

  return (
    <>
      <div className="aside-header">
        <div className="aside-title">
          <span className="live-pulse">Live</span>
          Commentary
        </div>
        {error && <span style={{ fontSize: 10, color: '#DC2626' }}>API offline</span>}
      </div>

      {bidContext && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(89,41,208,0.12)', background: 'rgba(89,41,208,0.05)', fontSize: 11, color: '#5929d0', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="dot dot-primary" />
          Streaming for <strong style={{ color: '#0F172A', fontWeight: 600 }}>&nbsp;{bidContext}</strong>
        </div>
      )}

      <div className="aside-feed" ref={feedRef}>
        {entries === null ? (
          <div style={{ color: '#94A3B8', textAlign: 'center', padding: 20, fontSize: 12 }}>Loading commentary…</div>
        ) : items.length === 0 ? (
          <div style={{ color: '#94A3B8', textAlign: 'center', padding: 20, fontSize: 12 }}>No activity yet</div>
        ) : items.map((it, i) => (
          <div key={i} className="feed-item">
            <div className={`feed-item-avatar ${it.authorClass}`}>
              {(it.author || '?').split(' ').map(s => s[0]).slice(0, 2).join('')}
            </div>
            <div className="feed-item-content">
              <div className="feed-item-meta">
                <strong>{it.author}</strong>
                <span>·</span>
                <span>{it.time}</span>
                {it.bidRef && it.bidRef !== '—' && !bidContext && (
                  <span style={{ fontFamily: 'ui-monospace, monospace', color: '#5929d0', fontSize: 10 }}>{it.bidRef}</span>
                )}
              </div>
              <div className="feed-item-text">{it.text}</div>
              {(it.tags || []).length > 0 && (
                <div style={{ gap: 4, display: 'flex', flexWrap: 'wrap', marginTop: 6 }}>
                  {it.tags.map((t, j) => {
                    const cls =
                      /override|edit/i.test(t)                  ? 'badge-pink'    :
                      /flag|detect|confidence|low.?conf/i.test(t)? 'badge-primary' :
                      /audit|activity|log|notify|compil|approv/i.test(t)? 'badge-success' :
                      /risk|alert|error|urgent|warn|reject|return/i.test(t)? 'badge-warning' : 'badge-neutral';
                    return <span key={j} className={`badge ${cls}`} style={{ fontSize: 9.5, padding: '1px 7px' }}>{t}</span>;
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
