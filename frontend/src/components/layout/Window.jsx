import React, { useRef } from 'react';

export default function Window({ app, children, onClose, onFocus, onUpdate, isActive }) {
  const dragRef = useRef(null);
  const isMax = !!app.maximized;

  function startDrag(e) {
    if (isMax) return;
    onFocus();
    const startX = e.clientX, startY = e.clientY, startAx = app.x, startAy = app.y;
    function move(ev) { onUpdate({ x: startAx + (ev.clientX - startX), y: startAy + (ev.clientY - startY) }); }
    function up() { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  function toggleMax() {
    if (isMax) {
      onUpdate({ maximized: false });
    } else {
      onUpdate({ maximized: true, _restore: { x: app.x, y: app.y, w: app.w, h: app.h } });
    }
  }

  const style = isMax
    ? { left: 0, top: 0, width: '100vw', height: 'calc(100vh - 56px)', zIndex: 100 + app.z, borderRadius: 0 }
    : { left: app.x, top: app.y, width: app.w, height: app.h, zIndex: 100 + app.z, opacity: isActive ? 1 : 0.985 };

  return (
    <div className="window" style={style} onMouseDown={onFocus}>
      <div className="window-titlebar">
        <div className="titlebar-grip" ref={dragRef} onMouseDown={startDrag} onDoubleClick={toggleMax}>
          <span className="titlebar-grip-icon">B</span>
          {app.title}
        </div>
        <div className="window-controls">
          <button className="window-control" onClick={() => onUpdate({ minimized: true })} title="Minimize">—</button>
          <button className="window-control" onClick={toggleMax} title={isMax ? 'Restore' : 'Maximize'}>{isMax ? '❐' : '▢'}</button>
          <button className="window-control close" onClick={onClose} title="Close">×</button>
        </div>
      </div>
      <div className="window-body">{children}</div>
    </div>
  );
}
