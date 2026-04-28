import React from 'react';
import { Icon, AppIcon } from '../ui/Icon';
import { useBids } from '../../hooks/useApiData';

const TASKBAR_APPS = [
  { id: 'files', title: 'Files',          icon: AppIcon.files },
  { id: 'word',  title: 'Word',           icon: AppIcon.word },
  { id: 'ppt',   title: 'PowerPoint',     icon: AppIcon.ppt },
  { id: 'excel', title: 'Excel',          icon: AppIcon.excel },
  { id: 'bid',   title: 'Bid Management', icon: AppIcon.bid },
];

export default function Taskbar({ now, openApps, activeApp, onOpenApp, onFocusApp }) {
  const { bids } = useBids();
  const pendingCount = (bids || []).filter(b => b.stage === 'pending').length;

  return (
    <div className="taskbar">
      <div className="taskbar-apps">
        {TASKBAR_APPS.map(app => {
          const open = openApps.find(a => a.id === app.id);
          const isActive = activeApp === app.id && open && !open.minimized;
          const cls = `taskbar-app ${isActive ? 'active' : ''} ${app.id === 'bid' ? 'bid-app' : ''}`;
          return (
            <button key={app.id} className={cls} title={app.title}
              onClick={() => open ? onFocusApp(app.id) : onOpenApp(app.id)}>
              <span className="taskbar-app-glyph">{app.icon()}</span>
              {app.id === 'bid' && pendingCount > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: '#CF008B', color: '#fff' }}>{pendingCount}</span>
              )}
              {open && <span className="taskbar-app-indicator" />}
            </button>
          );
        })}
      </div>

      <div className="taskbar-end">
        <div className="taskbar-tray" title="Tray">
          <div className="tray-icons">{Icon.wifi(13)} {Icon.speaker(13)} {Icon.battery(15)}</div>
          <div className="tray-clock">
            <strong>{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</strong>
            <span>{now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
