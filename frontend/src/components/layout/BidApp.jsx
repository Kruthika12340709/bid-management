import React, { useState } from 'react';
import { Icon } from '../ui/Icon';
import Commentary from '../ui/Commentary';
import BID_DATA from '../../data/mockData';

import Dashboard from '../../pages/Dashboard';
import BidsList from '../../pages/BidsList';
import BidDetail from '../../pages/BidDetail';
import Pipeline from '../../pages/Pipeline';
import HILQueue from '../../pages/HILQueue';
import InputValidation from '../../pages/InputValidation';
import Compilation from '../../pages/Compilation';
import PricingPanel from '../../pages/PricingPanel';
import RiskPanel from '../../pages/RiskPanel';
import Reports from '../../pages/Reports';
import AuditLog from '../../pages/AuditLog';

export default function BidApp({ activeTab, onTabChange, user, onUserChange, showUserMenu, setShowUserMenu, bid, setBid }) {
  const isDirector = user.id === 'director';

  const tabs = isDirector ? [
    { id: 'dashboard', label: 'Dashboard',     icon: Icon.layers },
    { id: 'pipeline',  label: 'Pipeline',      icon: Icon.briefcase },
    { id: 'hil',       label: 'HIL Approval',  icon: Icon.flag,   badge: 'pending' },
    { id: 'pricing',   label: 'Pricing Panel', icon: Icon.pound },
    { id: 'risk',      label: 'Risk Panel',    icon: Icon.shield },
    { id: 'reports',   label: 'Reports',       icon: Icon.trendUp },
    { id: 'audit',     label: 'Audit Log',     icon: Icon.audit },
  ] : [
    { id: 'dashboard',   label: 'Dashboard',        icon: Icon.layers },
    { id: 'inputs',      label: 'Input Validation', icon: Icon.check,  badge: 'inputs' },
    { id: 'compilation', label: 'Compilation',      icon: Icon.doc },
    { id: 'pipeline',    label: 'Pipeline',         icon: Icon.briefcase },
    { id: 'hil',         label: 'Co-review',        icon: Icon.flag,   badge: 'pending' },
    { id: 'reports',     label: 'Reports',          icon: Icon.trendUp },
    { id: 'audit',       label: 'Audit Log',        icon: Icon.audit },
  ];

  const pendingCount = BID_DATA.bids.filter(b => b.stage === 'pending').length;
  const inputsCount  = 2;

  return (
    <div className="app">
      <div className="app-content">

        {/* ── Sidenav ── */}
        <div className="app-sidenav">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 52, borderBottom: '1px solid var(--neutral-7)', flexShrink: 0 }}>
            <div className="app-brand-mark">B</div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 0', gap: 2, overflow: 'hidden' }}>
            {tabs.map(t => {
              const showPending = t.badge === 'pending' && pendingCount > 0;
              const showInputs  = t.badge === 'inputs'  && inputsCount  > 0;
              return (
                <button key={t.id}
                  title={t.label}
                  className={`app-sidenav-btn ${activeTab === t.id ? 'active' : ''}`}
                  onClick={() => { onTabChange(t.id); if (t.id !== 'bids') setBid(null); }}>
                  {t.icon(18)}
                  {showPending && <span className="nav-badge-mini">{pendingCount}</span>}
                  {showInputs  && <span className="nav-badge-mini warn">{inputsCount}</span>}
                  <span className="nav-tooltip">{t.label}</span>
                </button>
              );
            })}
          </div>

          <div style={{ borderTop: '1px solid var(--neutral-7)', padding: '6px 0', flexShrink: 0 }}>
            <button className="app-sidenav-btn">
              {Icon.bell(18)}
              <span className="nav-tooltip">Notifications</span>
            </button>
            <div style={{ position: 'relative' }}>
              <button className={`app-sidenav-btn ${showUserMenu ? 'active' : ''}`} onClick={() => setShowUserMenu(v => !v)}>
                <div className={`user-avatar ${user.avatarClass}`} style={{ width: 26, height: 26, fontSize: 10, flexShrink: 0 }}>{user.initials}</div>
                <span className="nav-tooltip">{user.name} · {user.role}</span>
              </button>
              {showUserMenu && (
                <div style={{ position: 'absolute', bottom: 4, left: 'calc(100% + 8px)', background: '#fff', border: '1px solid var(--neutral-7)', borderRadius: 12, boxShadow: '0 8px 30px rgba(15,23,42,0.12)', width: 280, padding: 6, zIndex: 999 }}>
                  <div style={{ padding: '8px 12px 12px', borderBottom: '1px solid #E2E8F0', marginBottom: 6 }}>
                    <div style={{ fontSize: 10.5, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Switch role</div>
                  </div>
                  {Object.values(BID_DATA.users).map(u => (
                    <button key={u.id} className={`user-option ${u.id === user.id ? 'selected' : ''}`}
                      onClick={() => { onUserChange(u); setShowUserMenu(false); }}>
                      <div className={`user-avatar ${u.avatarClass}`}>{u.initials}</div>
                      <div className="user-option-info">
                        <strong>{u.name}</strong>
                        <span>{u.role}</span>
                      </div>
                      {u.id === user.id && <span className="user-option-check">{Icon.check(14)}</span>}
                    </button>
                  ))}
                  <div style={{ padding: '10px 12px 4px', fontSize: 11, color: '#64748B', borderTop: '1px solid #E2E8F0', marginTop: 6 }}>
                    {user.title}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="app-main">
          {activeTab === 'dashboard'   && <Dashboard   user={user} onTabChange={onTabChange} onOpenBid={b => { onTabChange('pipeline'); setBid(b); }} />}
          {activeTab === 'pipeline'    && (bid ? <BidDetail bid={bid} user={user} onBack={() => setBid(null)} /> : <Pipeline     user={user} onOpenBid={b => setBid(b)} />)}
          {activeTab === 'bids'        && (bid ? <BidDetail bid={bid} user={user} onBack={() => setBid(null)} /> : <BidsList     user={user} onTabChange={onTabChange} onOpenBid={b => setBid(b)} />)}
          {activeTab === 'hil'         && (bid ? <BidDetail bid={bid} user={user} onBack={() => setBid(null)} /> : <HILQueue     user={user} onOpenBid={b => setBid(b)} />)}
          {activeTab === 'inputs'      && <InputValidation user={user} />}
          {activeTab === 'compilation' && <Compilation user={user} onOpenBid={b => { onTabChange('pipeline'); setBid(b); }} />}
          {activeTab === 'pricing'     && <PricingPanel user={user} />}
          {activeTab === 'risk'        && <RiskPanel    user={user} />}
          {activeTab === 'reports'     && <Reports      user={user} />}
          {activeTab === 'audit'       && <AuditLog     user={user} />}
        </div>

        {/* ── Commentary aside ── */}
        <div className="app-aside">
          <Commentary user={user} bidContext={bid ? bid.id : null} />
        </div>

      </div>
    </div>
  );
}
