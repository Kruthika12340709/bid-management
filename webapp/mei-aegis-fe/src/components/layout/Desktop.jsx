import React, { useState, useEffect } from 'react';
import { Icon, AppIcon } from '../ui/Icon';
import Window from './Window';
import Taskbar from './Taskbar';
import BidApp from './BidApp';
import BID_DATA from '../../data/mockData';
import { useBids, useAuditLog } from '../../hooks/useApiData';
import { setActiveRole } from '../../api/client';

function relTime(iso) {
  if (!iso) return '';
  const ago = (Date.now() - new Date(iso).getTime()) / 1000;
  if (ago < 60)    return `${Math.round(ago)}s ago`;
  if (ago < 3600)  return `${Math.round(ago / 60)}m ago`;
  if (ago < 86400) return `${Math.round(ago / 3600)}h ago`;
  return `${Math.round(ago / 86400)}d ago`;
}

function actionToNotificationType(action) {
  if (/approv|sign-off/i.test(action))   return 'approval';
  if (/edit|override/i.test(action))     return 'override';
  if (/submit/i.test(action))            return 'submitted';
  if (/outcome|award/i.test(action))     return 'outcome';
  if (/reject|return|fail/i.test(action))return 'reject';
  return 'info';
}

const APP_DEFS = {
  bid:         { title: 'Bid Management',              w: 1180, h: 760 },
  dashboard:   { title: 'Bid Management — Dashboard',  w: 1180, h: 760 },
  pipeline:    { title: 'Bid Management — Pipeline',   w: 1180, h: 760 },
  hil:         { title: 'Bid Management — HIL Approval', w: 1180, h: 760 },
  pricing:     { title: 'Bid Management — Pricing Panel', w: 1180, h: 760 },
  risk:        { title: 'Bid Management — Risk Panel', w: 1180, h: 760 },
  reports:     { title: 'Bid Management — Reports',    w: 1180, h: 760 },
  audit:       { title: 'Bid Management — Audit Log',  w: 1180, h: 760 },
  inputs:      { title: 'Bid Management — Inputs',     w: 1180, h: 760 },
  compilation: { title: 'Bid Management — Compilation', w: 1180, h: 760 },
  files:       { title: 'Files',       w: 900, h: 600, iconBig: AppIcon.files },
  word:        { title: 'Word',        w: 900, h: 600, iconBig: AppIcon.word },
  ppt:         { title: 'PowerPoint',  w: 900, h: 600, iconBig: AppIcon.ppt },
  excel:       { title: 'Excel',       w: 900, h: 600, iconBig: AppIcon.excel },
  mail:        { title: 'Outlook',     w: 900, h: 600, iconBig: AppIcon.mail },
  edge:        { title: 'Edge',        w: 1100, h: 700, iconBig: AppIcon.edge },
  teams:       { title: 'Teams',       w: 900, h: 600, iconBig: AppIcon.teams },
};

const DESKTOP_ICONS = [
  { id: 'bid', label: 'Bid Management', icon: AppIcon.bid },
];

const BID_APP_IDS = ['bid','dashboard','pipeline','hil','pricing','risk','reports','audit','inputs','compilation'];

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function Desktop() {
  const [openApps, setOpenApps]         = useState([]);
  const [activeApp, setActiveApp]       = useState(null);
  const [user, setUserState]            = useState(BID_DATA.users.director);
  const setUser = (u) => { setActiveRole(u?.id); setUserState(u); };
  // Keep header in sync on first mount (initial role = director)
  useEffect(() => { setActiveRole(user?.id); }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [bidScreen, setBidScreen]       = useState({ tab: 'dashboard', bid: null });
  const [zCounter, setZCounter]         = useState(10);
  const now = useClock();

  function openApp(id) {
    setActiveApp(id);
    setOpenApps(prev => {
      const existing = prev.find(a => a.id === id);
      if (existing) {
        setZCounter(z => z + 1);
        return prev.map(a => a.id === id ? { ...a, z: zCounter + 1, minimized: false } : a);
      }
      const def = APP_DEFS[id];
      const vw = window.innerWidth, vh = window.innerHeight;
      const w = Math.min(def.w || 1100, vw - 60);
      const h = Math.min(def.h || 700, vh - 80);
      const x = Math.max(20, Math.floor((vw - w) / 2) + prev.length * 24);
      const y = Math.max(20, Math.floor((vh - h - 56) / 4) + prev.length * 16);
      setZCounter(z => z + 1);
      return [...prev, { id, title: def.title, x, y, w, h, z: zCounter + 1, minimized: false }];
    });
  }

  function closeApp(id) {
    setOpenApps(prev => prev.filter(a => a.id !== id));
    if (activeApp === id) setActiveApp(null);
  }

  function focusApp(id) {
    setActiveApp(id);
    setZCounter(z => z + 1);
    setOpenApps(prev => prev.map(a => a.id === id ? { ...a, z: zCounter + 1, minimized: false } : a));
  }

  return (
    <div className="desktop">
      <div className="desktop-area">
        <div className="desktop-icons">
          {DESKTOP_ICONS.map(ic => (
            <div key={ic.id} className="desktop-icon" onClick={() => openApp(ic.id)}>
              <div className="desktop-icon-glyph">{ic.icon()}</div>
              <div className="desktop-icon-label">{ic.label}</div>
            </div>
          ))}
        </div>
        <DesktopWidgets onOpenBid={() => openApp('bid')} now={now} />
      </div>

      {openApps.filter(a => !a.minimized).map(a => (
        <Window key={a.id} app={a} onClose={() => closeApp(a.id)} onFocus={() => focusApp(a.id)}
          isActive={activeApp === a.id}
          onUpdate={patch => setOpenApps(prev => prev.map(x => x.id === a.id ? { ...x, ...patch } : x))}>
          {BID_APP_IDS.includes(a.id)
            ? <BidApp
                activeTab={a.id === 'bid' ? bidScreen.tab : a.id}
                onTabChange={t => setBidScreen(s => ({ ...s, tab: t }))}
                user={user} onUserChange={setUser}
                showUserMenu={showUserMenu} setShowUserMenu={setShowUserMenu}
                bid={bidScreen.bid} setBid={b => setBidScreen(s => ({ ...s, bid: b }))}
              />
            : <PlaceholderApp appId={a.id} />
          }
        </Window>
      ))}

      <Taskbar now={now} openApps={openApps} activeApp={activeApp}
        onOpenApp={openApp} onFocusApp={focusApp} />
    </div>
  );
}

function DesktopWidgets({ onOpenBid, now }) {
  const { bids } = useBids();
  const { entries } = useAuditLog({ limit: 4 }, 15000);

  const live = bids || [];
  const pendingCount = live.filter(b => b.stage === 'pending').length;
  const compileCount = live.filter(b => b.stage === 'compiling' || b.stage === 'validating').length;
  const urgentCount  = live.filter(b => b.daysLeft <= 5 && b.stage !== 'submitted').length;
  const totalCount   = live.length;

  const notifications = (entries || []).map(e => ({
    type:    actionToNotificationType(e.action),
    title:   e.detail || `${e.action} · ${e.section}`,
    sub:     `${e.bid !== '—' ? e.bid + ' · ' : ''}${e.role}: ${e.user === 'system' ? 'Bid Engine' : e.user === 'director' ? 'Priya Menon' : 'Arjun Kapoor'}`,
    time:    relTime(e.ts.replace(' ', 'T') + 'Z'),
    urgent:  /reject|return|miss|escalat/i.test(e.action + ' ' + (e.detail || '')),
  }));

  return (
    <div className="widgets">
      <div className="widget" style={{ background: 'linear-gradient(135deg, rgba(89,41,208,0.92), rgba(207,0,139,0.85))', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>
        <div className="widget-header">
          <div className="widget-title" style={{ color: 'rgba(255,255,255,0.85)' }}>Bid Management · Today</div>
          <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 10 }}>Live</span>
        </div>
        <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.01em' }}>
          {totalCount}<span style={{ fontSize: 13, opacity: 0.7, fontWeight: 500, marginLeft: 6 }}>active bids</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 14 }}>
          <div><div style={{ fontSize: 18, fontWeight: 700 }}>{pendingCount}</div><div style={{ fontSize: 10.5, opacity: 0.85 }}>HIL pending</div></div>
          <div><div style={{ fontSize: 18, fontWeight: 700 }}>{compileCount}</div><div style={{ fontSize: 10.5, opacity: 0.85 }}>Compiling</div></div>
          <div><div style={{ fontSize: 18, fontWeight: 700, color: '#FECACA' }}>{urgentCount}</div><div style={{ fontSize: 10.5, opacity: 0.85 }}>&lt; 5 days</div></div>
        </div>
        <button onClick={onOpenBid} style={{ marginTop: 14, width: '100%', padding: '8px 14px', background: '#fff', color: '#5929d0', borderRadius: 999, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', cursor: 'pointer' }}>
          Open Bid Management {Icon.arrow(11)}
        </button>
      </div>

      <div className="widget">
        <div className="widget-header">
          <div className="widget-title">Notifications</div>
          <span className="widget-link">{notifications.length}</span>
        </div>
        {notifications.length === 0 ? (
          <div style={{ color: '#94A3B8', fontSize: 11, padding: '14px 0', textAlign: 'center' }}>
            {entries === null ? 'Loading…' : 'No recent activity'}
          </div>
        ) : notifications.map((n, i) => {
          const palette = {
            approval:  { bg: '#FEF3C7', fg: '#92400E', icon: Icon.check(14) },
            override:  { bg: '#FFD6F4', fg: '#CF008B', icon: Icon.flag(14) },
            submitted: { bg: '#CFFAFE', fg: '#0E7490', icon: Icon.check(14) },
            outcome:   { bg: '#DCFCE7', fg: '#16A34A', icon: Icon.trendUp(14) },
            reject:    { bg: '#FEE2E2', fg: '#DC2626', icon: Icon.alert(14) },
            info:      { bg: '#E8E5FF', fg: '#5929d0', icon: Icon.bell(14) },
          }[n.type] || { bg: '#E8E5FF', fg: '#5929d0', icon: Icon.bell(14) };
          return (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < notifications.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: palette.bg, color: palette.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {palette.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', lineHeight: 1.35, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
                  {n.urgent && <span className="badge badge-error" style={{ fontSize: 9, padding: '1px 6px', flexShrink: 0 }}>urgent</span>}
                </div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.sub}</div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{n.time}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="widget" style={{ padding: '14px 16px' }}>
        <div className="widget-header">
          <div className="widget-title">Calendar</div>
          <span className="widget-link">{now.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
        </div>
        <div style={{ fontSize: 42, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1 }}>{now.getDate()}</div>
        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 10 }}>{now.toLocaleDateString('en-GB', { weekday: 'long' })}</div>
        <div style={{ display: 'flex', gap: 8, padding: '8px 10px', background: '#F1F5F9', borderRadius: 8, fontSize: 11.5, color: '#475569' }}>
          {Icon.clock(13)} <strong>11:00</strong> — HIL approval window · NHS Digital
        </div>
      </div>
    </div>
  );
}

function PlaceholderApp({ appId }) {
  const meta = APP_DEFS[appId] || { title: appId };
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, background: '#FAFBFD' }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {meta.iconBig ? meta.iconBig() : <span style={{ fontSize: 30, color: '#5929d0' }}>{meta.title[0]}</span>}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>{meta.title}</div>
      <div style={{ fontSize: 12.5, color: '#64748B', maxWidth: 380, textAlign: 'center', lineHeight: 1.6 }}>
        Workspace placeholder — open Bid Management from the taskbar.
      </div>
    </div>
  );
}
