// Desktop shell + window manager + main app

const { useState, useEffect, useRef } = React;

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);
  return now;
}

function Desktop() {
  const [openApps, setOpenApps] = useState([]); // [{id, title, x, y, w, h, z, minimized}]
  const [activeApp, setActiveApp] = useState(null);
  const [user, setUser] = useState(window.BID_DATA.users.director);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [bidScreen, setBidScreen] = useState({ tab: 'dashboard', bid: null });
  const [zCounter, setZCounter] = useState(10);
  const now = useClock();

  function openApp(id) {
    setActiveApp(id);
    setOpenApps(prev => {
      const existing = prev.find(a => a.id === id);
      if (existing) {
        return prev.map(a => a.id === id ? { ...a, z: zCounter+1, minimized: false } : a);
      }
      const def = APP_DEFS[id];
      const vw = window.innerWidth, vh = window.innerHeight;
      const w = Math.min(def.w || 1100, vw - 60);
      const h = Math.min(def.h || 700, vh - 80);
      const x = Math.max(20, Math.floor((vw - w) / 2) + prev.length * 24);
      const y = Math.max(20, Math.floor((vh - h - 56) / 4) + prev.length * 16);
      return [...prev, { id, title: def.title, x, y, w, h, z: zCounter+1, minimized: false }];
    });
    setZCounter(z => z+1);
  }
  function closeApp(id) {
    setOpenApps(prev => prev.filter(a => a.id !== id));
    if (activeApp === id) setActiveApp(null);
  }
  function focusApp(id) {
    setActiveApp(id);
    setZCounter(z => z+1);
    setOpenApps(prev => prev.map(a => a.id === id ? { ...a, z: zCounter+1, minimized: false } : a));
  }

  return (
    <div className="desktop">
      <div className="desktop-area">
        <div className="desktop-icons">
          {DESKTOP_ICONS.map(ic => (
            <div key={ic.id} className="desktop-icon" onDoubleClick={()=>openApp(ic.id)} onClick={()=>openApp(ic.id)}>
              <div className="desktop-icon-glyph">{ic.icon()}</div>
              <div className="desktop-icon-label">{ic.label}</div>
            </div>
          ))}
        </div>
        <DesktopWidgets onOpenBid={()=>openApp('bid')} now={now}/>
      </div>

      {openApps.filter(a => !a.minimized).map(a => (
        <Window key={a.id} app={a} onClose={()=>closeApp(a.id)} onFocus={()=>focusApp(a.id)}
          isActive={activeApp === a.id}
          onUpdate={(patch)=>setOpenApps(prev=>prev.map(x=>x.id===a.id?{...x, ...patch}:x))}>
          <AppContent appId={a.id} user={user} onUserChange={setUser}
            showUserMenu={showUserMenu} setShowUserMenu={setShowUserMenu}
            bidScreen={bidScreen} setBidScreen={setBidScreen}
            openApp={openApp}/>
        </Window>
      ))}

      <Taskbar now={now} openApps={openApps} activeApp={activeApp}
        onOpenApp={openApp} onFocusApp={focusApp}/>
    </div>
  );
}

// ─────────────────────────────────────────────
// WIDGETS on the desktop
function DesktopWidgets({ onOpenBid, now }) {
  const D = window.BID_DATA;
  const pendingCount = D.bids.filter(b=>b.stage==='pending').length;
  const compileCount = D.bids.filter(b=>b.stage==='compiling'||b.stage==='validating').length;
  const urgentCount = D.bids.filter(b=>b.daysLeft<=5 && b.stage!=='submitted').length;

  return (
    <div className="widgets">
      <div className="widget" style={{background:'linear-gradient(135deg, rgba(89,41,208,0.92), rgba(207,0,139,0.85))', color:'#fff', border:'1px solid rgba(255,255,255,0.25)'}}>
        <div className="widget-header">
          <div className="widget-title" style={{color:'rgba(255,255,255,0.85)'}}>Bid Management · Today</div>
          <span className="badge" style={{background:'rgba(255,255,255,0.2)', color:'#fff', fontSize:10}}>Live</span>
        </div>
        <div style={{fontSize:30, fontWeight:700, lineHeight:1, letterSpacing:'-0.01em'}}>{D.bids.length}<span style={{fontSize:13, opacity:0.7, fontWeight:500, marginLeft:6}}>active bids</span></div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginTop:14}}>
          <div>
            <div style={{fontSize:18, fontWeight:700}}>{pendingCount}</div>
            <div style={{fontSize:10.5, opacity:0.85}}>HIL pending</div>
          </div>
          <div>
            <div style={{fontSize:18, fontWeight:700}}>{compileCount}</div>
            <div style={{fontSize:10.5, opacity:0.85}}>Compiling</div>
          </div>
          <div>
            <div style={{fontSize:18, fontWeight:700, color:'#FECACA'}}>{urgentCount}</div>
            <div style={{fontSize:10.5, opacity:0.85}}>&lt; 5 days</div>
          </div>
        </div>
        <button onClick={onOpenBid} style={{marginTop:14, width:'100%', padding:'8px 14px', background:'#fff', color:'#5929d0', borderRadius:999, fontSize:12, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:6}}>
          Open Bid Management {Icon.arrow(11)}
        </button>
      </div>

      <div className="widget">
        <div className="widget-header">
          <div className="widget-title">Notifications</div>
          <span className="widget-link">{D.notifications.length}</span>
        </div>
        {D.notifications.map((n,i)=>(
          <div key={i} style={{display:'flex', gap:10, padding:'10px 0', borderBottom: i<D.notifications.length-1?'1px solid #F1F5F9':'none'}}>
            <div style={{
              width:32, height:32, borderRadius:8, flexShrink:0,
              background: n.type==='approval'?'#FEF3C7': n.type==='override'?'#FFD6F4': n.type==='outcome'?'#DCFCE7':'#E8E5FF',
              color: n.type==='approval'?'#92400E':n.type==='override'?'#CF008B':n.type==='outcome'?'#16A34A':'#5929d0',
              display:'flex', alignItems:'center', justifyContent:'center'
            }}>
              {n.type==='approval'?Icon.check(14):n.type==='override'?Icon.flag(14):n.type==='outcome'?Icon.trendUp(14):Icon.bell(14)}
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:12, fontWeight:600, color:'#0F172A', lineHeight:1.35, display:'flex', alignItems:'center', gap:6}}>
                {n.title}
                {n.urgent && <span className="badge badge-error" style={{fontSize:9, padding:'1px 6px'}}>urgent</span>}
              </div>
              <div style={{fontSize:11, color:'#64748B', marginTop:2}}>{n.sub}</div>
              <div style={{fontSize:10, color:'#94A3B8', marginTop:2}}>{n.time}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="widget" style={{padding:'14px 16px'}}>
        <div className="widget-header">
          <div className="widget-title">Calendar</div>
          <span className="widget-link">{now.toLocaleDateString('en-GB',{month:'short', year:'numeric'})}</span>
        </div>
        <div style={{fontSize:42, fontWeight:700, color:'#0F172A', letterSpacing:'-0.02em', lineHeight:1}}>{now.getDate()}</div>
        <div style={{fontSize:13, color:'#64748B', marginBottom:10}}>{now.toLocaleDateString('en-GB',{weekday:'long'})}</div>
        <div style={{display:'flex', gap:8, padding:'8px 10px', background:'#F1F5F9', borderRadius:8, fontSize:11.5, color:'#475569'}}>
          {Icon.clock(13)} <strong>11:00</strong> — HIL approval window · NHS Digital
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// WINDOW
function Window({ app, children, onClose, onFocus, onUpdate, isActive }) {
  const dragRef = useRef(null);
  const isMax = !!app.maximized;
  function startDrag(e) {
    if (isMax) return;
    onFocus();
    const startX = e.clientX, startY = e.clientY, startAx = app.x, startAy = app.y;
    function move(ev) { onUpdate({ x: startAx + (ev.clientX-startX), y: startAy + (ev.clientY-startY) }); }
    function up() { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  }
  function toggleMax() {
    if (isMax) {
      onUpdate({ maximized:false });
    } else {
      onUpdate({ maximized:true, _restore:{ x:app.x, y:app.y, w:app.w, h:app.h } });
    }
  }
  const style = isMax
    ? { left:0, top:0, width:'100vw', height:'calc(100vh - 56px)', zIndex:100 + app.z, borderRadius:0 }
    : { left: app.x, top: app.y, width: app.w, height: app.h, zIndex: 100 + app.z, opacity: isActive?1:0.985 };
  return (
    <div className="window" style={style} onMouseDown={onFocus}>
      <div className="window-titlebar">
        <div className="titlebar-grip" ref={dragRef} onMouseDown={startDrag} onDoubleClick={toggleMax}>
          <span className="titlebar-grip-icon">B</span>
          {app.title}
        </div>
        <div className="window-controls">
          <button className="window-control" onClick={()=>onUpdate({minimized:true})} title="Minimize">—</button>
          <button className="window-control" onClick={toggleMax} title={isMax?'Restore':'Maximize'}>{isMax?'❐':'▢'}</button>
          <button className="window-control close" onClick={onClose} title="Close">×</button>
        </div>
      </div>
      <div className="window-body">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// APP CONTENT (routes inside windows)
function AppContent({ appId, user, onUserChange, showUserMenu, setShowUserMenu, bidScreen, setBidScreen, openApp }) {
  const bidAppIds = ['bid','dashboard','pipeline','hil','pricing','risk','reports','audit','inputs','compilation'];
  if (bidAppIds.includes(appId)) {
    const initialTab = appId === 'bid' ? bidScreen.tab : appId;
    return <BidApp activeTab={initialTab}
      onTabChange={(t)=>setBidScreen(s=>({...s, tab:t}))}
      user={user} onUserChange={onUserChange}
      showUserMenu={showUserMenu} setShowUserMenu={setShowUserMenu}
      bid={bidScreen.bid} setBid={(b)=>setBidScreen(s=>({...s, bid:b}))}
      openApp={openApp}/>;
  }
  return <PlaceholderApp appId={appId}/>;
}

// ─────────────────────────────────────────────
// THE BID APP
function BidApp({ activeTab, onTabChange, user, onUserChange, showUserMenu, setShowUserMenu, bid, setBid, openApp }) {
  const isDirector = user.id === 'director';
  // BRD-aligned navigation. Manager gets UI-01 + UI-02; Director gets approval-centric nav.
  const tabs = isDirector ? [
    { id:'dashboard', label:'Dashboard',      icon: Icon.layers },
    { id:'pipeline',  label:'Pipeline',       icon: Icon.briefcase },
    { id:'hil',       label:'HIL Approval',   icon: Icon.flag,    badge:'pending' },
    { id:'pricing',   label:'Pricing Panel',  icon: Icon.pound },
    { id:'risk',      label:'Risk Panel',     icon: Icon.shield },
    { id:'reports',   label:'Reports',        icon: Icon.trendUp },
    { id:'audit',     label:'Audit Log',      icon: Icon.audit }
  ] : [
    { id:'dashboard',   label:'Dashboard',         icon: Icon.layers },
    { id:'inputs',      label:'Input Validation',  icon: Icon.check, badge:'inputs' },
    { id:'compilation', label:'Compilation',       icon: Icon.doc },
    { id:'pipeline',    label:'Pipeline',          icon: Icon.briefcase },
    { id:'hil',         label:'Co-review',         icon: Icon.flag,    badge:'pending' },
    { id:'reports',     label:'Reports',           icon: Icon.trendUp },
    { id:'audit',       label:'Audit Log',         icon: Icon.audit }
  ];
  const D = window.BID_DATA;
  const pendingCount = D.bids.filter(b=>b.stage==='pending').length;
  const inputsCount = 2;

  return (
    <div className="app">
      <div className="app-content">
        <div className="app-sidenav">
          {/* Brand mark */}
          <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:52, borderBottom:'1px solid var(--neutral-7)', flexShrink:0}}>
            <div className="app-brand-mark">B</div>
          </div>

          {/* Nav tabs */}
          <div style={{flex:1, display:'flex', flexDirection:'column', padding:'8px 0', gap:2, overflow:'hidden'}}>
            {tabs.map(t => {
              const showPending = t.badge==='pending' && pendingCount>0;
              const showInputs = t.badge==='inputs' && inputsCount>0;
              return (
                <button key={t.id}
                  className={`app-sidenav-btn ${activeTab===t.id?'active':''}`}
                  onClick={()=>{ onTabChange(t.id); if(t.id!=='bids') setBid(null); }}>
                  {t.icon(18)}
                  {showPending && <span className="nav-badge-mini">{pendingCount}</span>}
                  {showInputs && <span className="nav-badge-mini warn">{inputsCount}</span>}
                  <span className="nav-tooltip">{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Bottom: notifications + user switcher */}
          <div style={{borderTop:'1px solid var(--neutral-7)', padding:'6px 0', flexShrink:0}}>
            <button className="app-sidenav-btn">
              {Icon.bell(18)}
              <span className="nav-tooltip">Notifications</span>
            </button>
            <div style={{position:'relative'}}>
              <button className={`app-sidenav-btn ${showUserMenu?'active':''}`} onClick={()=>setShowUserMenu(v=>!v)}>
                <div className={`user-avatar ${user.avatarClass}`} style={{width:26, height:26, fontSize:10, flexShrink:0}}>{user.initials}</div>
                <span className="nav-tooltip">{user.name} · {user.role}</span>
              </button>
              {showUserMenu && (
                <div style={{
                  position:'absolute', bottom:4, left:'calc(100% + 8px)',
                  background:'#fff', border:'1px solid var(--neutral-7)',
                  borderRadius:12, boxShadow:'0 8px 30px rgba(15,23,42,0.12)',
                  width:280, padding:6, zIndex:999
                }}>
                  <div style={{padding:'8px 12px 12px', borderBottom:'1px solid #E2E8F0', marginBottom:6}}>
                    <div style={{fontSize:10.5, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:700}}>Switch role</div>
                  </div>
                  {Object.values(window.BID_DATA.users).map(u => (
                    <button key={u.id} className={`user-option ${u.id===user.id?'selected':''}`}
                      onClick={()=>{ onUserChange(u); setShowUserMenu(false); }}>
                      <div className={`user-avatar ${u.avatarClass}`}>{u.initials}</div>
                      <div className="user-option-info">
                        <strong>{u.name}</strong>
                        <span>{u.role}</span>
                      </div>
                      {u.id===user.id && <span className="user-option-check">{Icon.check(14)}</span>}
                    </button>
                  ))}
                  <div style={{padding:'10px 12px 4px', fontSize:11, color:'#64748B', borderTop:'1px solid #E2E8F0', marginTop:6}}>
                    {user.title}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="app-main">
          {activeTab === 'dashboard' && <Dashboard user={user} onOpenBid={(b)=>{ onTabChange('pipeline'); setBid(b); }}/>}
          {activeTab === 'pipeline' && (bid
            ? <BidDetail bid={bid} user={user} onBack={()=>setBid(null)}/>
            : <PipelineScreen user={user} onOpenBid={(b)=>setBid(b)}/>)}
          {activeTab === 'bids' && (bid
            ? <BidDetail bid={bid} user={user} onBack={()=>setBid(null)}/>
            : <BidsList user={user} onOpenBid={(b)=>setBid(b)}/>)}
          {activeTab === 'hil' && (bid
            ? <BidDetail bid={bid} user={user} onBack={()=>setBid(null)}/>
            : <HILQueue user={user} onOpenBid={(b)=>setBid(b)}/>)}
          {activeTab === 'inputs' && <InputValidationScreen user={user}/>}
          {activeTab === 'compilation' && <CompilationScreen user={user} onOpenBid={(b)=>{ onTabChange('pipeline'); setBid(b); }}/>}
          {activeTab === 'pricing' && <PricingPanelScreen user={user}/>}
          {activeTab === 'risk' && <RiskPanelScreen user={user}/>}
          {activeTab === 'reports' && <ReportsScreen user={user}/>}
          {activeTab === 'audit' && <AuditView user={user}/>}
        </div>
        <div className="app-aside">
          <LiveCommentary user={user} bidContext={bid?bid.id:null}/>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Placeholders for non-Bid apps
function PlaceholderApp({ appId }) {
  const meta = APP_DEFS[appId];
  return (
    <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, background:'#FAFBFD'}}>
      <div style={{width:64, height:64, borderRadius:16, background:'#fff', boxShadow:'0 4px 20px rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'center'}}>
        {meta.iconBig ? meta.iconBig() : <span style={{fontSize:30, color:'#5929d0'}}>{meta.title[0]}</span>}
      </div>
      <div style={{fontSize:18, fontWeight:700, color:'#0F172A'}}>{meta.title}</div>
      <div style={{fontSize:12.5, color:'#64748B', maxWidth:380, textAlign:'center', lineHeight:1.6}}>
        Workspace placeholder. Bid Management is the focus of this build — open the Bid app from the taskbar.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TASKBAR
function Taskbar({ now, openApps, activeApp, onOpenApp, onFocusApp }) {
  const D = window.BID_DATA;
  const pendingCount = D.bids.filter(b=>b.stage==='pending').length;

  return (
    <div className="taskbar">
      <div className="taskbar-start">
        <button className="taskbar-app" title="Start">
          <span className="taskbar-app-glyph">
            <svg width="18" height="18" viewBox="0 0 18 18">
              <rect x="0" y="0" width="8" height="8" fill="#F25022"/>
              <rect x="10" y="0" width="8" height="8" fill="#7FBA00"/>
              <rect x="0" y="10" width="8" height="8" fill="#00A4EF"/>
              <rect x="10" y="10" width="8" height="8" fill="#FFB900"/>
            </svg>
          </span>
        </button>
        <div className="taskbar-search">{Icon.search(13)} <span>Search</span></div>
      </div>

      <div className="taskbar-apps">
        {TASKBAR_APPS.map(app => {
          const open = openApps.find(a => a.id === app.id);
          const isActive = activeApp === app.id && open && !open.minimized;
          const cls = `taskbar-app ${isActive?'active':''} ${app.id==='bid'?'bid-app':''}`;
          return (
            <button key={app.id} className={cls} title={app.title}
              onClick={()=> open ? onFocusApp(app.id) : onOpenApp(app.id)}>
              <span className="taskbar-app-glyph">{app.icon()}</span>
              {app.id === 'bid' && pendingCount > 0 && (
                <span style={{fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:999, background:'#CF008B', color:'#fff'}}>{pendingCount}</span>
              )}
              {open && <span className="taskbar-app-indicator"/>}
            </button>
          );
        })}
      </div>

      <div className="taskbar-end">
        <div className="taskbar-tray" title="Tray">
          <div className="tray-icons">{Icon.wifi(13)} {Icon.speaker(13)} {Icon.battery(15)}</div>
          <div className="tray-clock">
            <strong>{now.toLocaleTimeString('en-GB',{hour:'2-digit', minute:'2-digit'})}</strong>
            <span>{now.toLocaleDateString('en-GB',{day:'2-digit', month:'2-digit', year:'numeric'})}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// APP REGISTRY
const APP_DEFS = {
  bid:        { title:'Bid Management', w: 1180, h: 760 },
  dashboard:  { title:'Bid Management — Dashboard', w: 1180, h: 760 },
  pipeline:   { title:'Bid Management — Pipeline', w: 1180, h: 760 },
  hil:        { title:'Bid Management — HIL Approval', w: 1180, h: 760 },
  pricing:    { title:'Bid Management — Pricing Panel', w: 1180, h: 760 },
  risk:       { title:'Bid Management — Risk Panel', w: 1180, h: 760 },
  reports:    { title:'Bid Management — Reports', w: 1180, h: 760 },
  audit:      { title:'Bid Management — Audit Log', w: 1180, h: 760 },
  inputs:     { title:'Bid Management — Inputs', w: 1180, h: 760 },
  compilation:{ title:'Bid Management — Compilation', w: 1180, h: 760 },
  files:      { title:'Files', w: 900, h: 600, iconBig: AppIcon.files },
  word:       { title:'Word', w: 900, h: 600, iconBig: AppIcon.word },
  ppt:        { title:'PowerPoint', w: 900, h: 600, iconBig: AppIcon.ppt },
  excel:      { title:'Excel', w: 900, h: 600, iconBig: AppIcon.excel },
  mail:       { title:'Outlook', w: 900, h: 600, iconBig: AppIcon.mail },
  edge:       { title:'Edge', w: 1100, h: 700, iconBig: AppIcon.edge },
  teams:      { title:'Teams', w: 900, h: 600, iconBig: AppIcon.teams }
};

const TASKBAR_APPS = [
  { id:'edge',  title:'Edge',  icon: AppIcon.edge },
  { id:'files', title:'Files', icon: AppIcon.files },
  { id:'word',  title:'Word',  icon: AppIcon.word },
  { id:'ppt',   title:'PowerPoint', icon: AppIcon.ppt },
  { id:'excel', title:'Excel', icon: AppIcon.excel },
  { id:'mail',  title:'Outlook', icon: AppIcon.mail },
  { id:'teams', title:'Teams', icon: AppIcon.teams },
  { id:'bid',   title:'Bid Management', icon: AppIcon.bid }
];

const DESKTOP_ICONS = [
  { id:'bid',   label:'Bid Management', icon: AppIcon.bid },
  { id:'files', label:'Files',          icon: AppIcon.files },
  { id:'word',  label:'Documents',      icon: AppIcon.word },
  { id:'ppt',   label:'Presentations',  icon: AppIcon.ppt },
  { id:'excel', label:'Spreadsheets',   icon: AppIcon.excel },
  { id:'mail',  label:'Outlook',        icon: AppIcon.mail }
];

window.Desktop = Desktop;
