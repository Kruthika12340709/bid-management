// Live Commentary panel — present on every screen of the Bid app
function LiveCommentary({ user, bidContext, onUserChange }) {
  const [tab, setTab] = React.useState('live');
  const [items, setItems] = React.useState(window.BID_DATA.commentary);
  const [draft, setDraft] = React.useState('');
  const feedRef = React.useRef(null);

  React.useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [items.length]);

  // Simulate live activity
  React.useEffect(() => {
    const tick = () => {
      const synthetic = [
        { time: now(), author: 'Bid Engine', authorClass: 'system', text: 'Audit log entry written for current view.', tags: ['Audit'] },
        { time: now(), author: 'Bid Engine', authorClass: 'system', text: 'Notification dispatched to Compliance Reviewer.', tags: ['Notify'] },
        { time: now(), author: 'Bid Engine', authorClass: 'system', text: 'Low-confidence score detected on Pricing section.', tags: ['Low Conf', 'Flag'] }
      ];
      const pick = synthetic[Math.floor(Math.random()*synthetic.length)];
      setItems(prev => [...prev.slice(-30), pick]);
    };
    const id = setInterval(tick, 18000);
    return () => clearInterval(id);
  }, []);

  function now(){
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  function send() {
    if (!draft.trim()) return;
    setItems(prev => [...prev, {
      time: now(),
      author: user.name, authorClass: user.avatarClass,
      text: draft.trim()
    }]);
    setDraft('');
  }

  const filtered = tab === 'live' ? items
    : tab === 'flags' ? items.filter(i => (i.tags||[]).some(t => /flag|override|feedback/i.test(t)))
    : items.filter(i => i.authorClass !== 'system');

  return (
    <React.Fragment>
      <div className="aside-header">
        <div className="aside-title">
          <span className="live-pulse">Live</span>
          Commentary
        </div>
        <button className="btn btn-ghost btn-sm" title="Filter">{Icon.layers(13)}</button>
      </div>
      <div className="aside-tabs">
        {['live','flags','people'].map(t => (
          <button key={t} className={`aside-tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>
      {bidContext && (
        <div style={{padding:'10px 14px', borderBottom:'1px solid rgba(89,41,208,0.12)', background:'rgba(89,41,208,0.05)', fontSize:11, color:'#5929d0', display:'flex', alignItems:'center', gap:6}}>
          <span className="dot dot-primary"/>
          Streaming for <strong style={{color:'#0F172A', fontWeight:600}}>&nbsp;{bidContext}</strong>
        </div>
      )}
      <div className="aside-feed" ref={feedRef}>
        {filtered.map((it, i) => (
          <div key={i} className="feed-item">
            <div className={`feed-item-avatar ${it.authorClass}`}>{(it.author||'?').split(' ').map(s=>s[0]).slice(0,2).join('')}</div>
            <div className="feed-item-content">
              <div className="feed-item-meta">
                <strong>{it.author}</strong>
                <span>·</span>
                <span>{it.time}</span>
              </div>
              <div className="feed-item-text">
                {it.highlight ? (
                  <span>{it.text.replace(it.highlight, '⟪H⟫')
                    .split('⟪H⟫').reduce((acc, part, idx, arr) => {
                      acc.push(<span key={idx}>{part}</span>);
                      if (idx < arr.length - 1) acc.push(<span key={idx+'h'} className="highlight">{it.highlight}</span>);
                      return acc;
                    }, [])}</span>
                ) : it.text}
              </div>
              {(it.tags||[]).length > 0 && (
                <div className="feed-item-tag" style={{gap:4, display:'flex', flexWrap:'wrap', marginTop:6}}>
                  {it.tags.map((t,j)=>{
                    const cls = /override/i.test(t) ? 'badge-pink'
                      : /flag|detect|confidence|low.?conf/i.test(t) ? 'badge-primary'
                      : /audit|activity|log|notify|compil/i.test(t) ? 'badge-success'
                      : /risk|alert|error|urgent|warn/i.test(t) ? 'badge-warning'
                      : 'badge-neutral';
                    return <span key={j} className={`badge ${cls}`} style={{fontSize:9.5, padding:'1px 7px'}}>{t}</span>;
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="aside-footer">
        <input className="aside-input" placeholder={`Comment as ${user.name}…`}
          value={draft} onChange={e=>setDraft(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter') send(); }}/>
        <button className="aside-send" onClick={send}>{Icon.send(14)}</button>
      </div>
    </React.Fragment>
  );
}

window.LiveCommentary = LiveCommentary;
