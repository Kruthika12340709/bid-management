import React from 'react';

export default function Pagination({ total, page, pageSize, onChange }) {
  if (total <= pageSize) return null;

  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize + 1;
  const end   = Math.min(page * pageSize, total);

  // Build page number window: always show first, last, current ±1
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  const btn = (content, target, disabled, active) => (
    <button
      key={typeof content === 'string' ? content + target : content}
      onClick={() => typeof target === 'number' && onChange(target)}
      disabled={disabled}
      style={{
        minWidth: 30, height: 28, padding: '0 8px',
        border: active ? '1px solid #5929d0' : '1px solid #E2E8F0',
        borderRadius: 6,
        background: active ? '#5929d0' : disabled ? '#F8FAFC' : '#fff',
        color: active ? '#fff' : disabled ? '#CBD5E1' : '#475569',
        fontSize: 11.5, fontWeight: active ? 700 : 500,
        cursor: disabled || typeof target !== 'number' ? 'default' : 'pointer',
      }}
    >
      {content}
    </button>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid #F1F5F9' }}>
      <span style={{ fontSize: 11.5, color: '#64748B' }}>
        Showing <strong>{start}–{end}</strong> of <strong>{total}</strong>
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        {btn('‹', page - 1, page === 1, false)}
        {pages.map((p, i) =>
          p === '…'
            ? btn('…', null, true, false)
            : btn(p, p, false, p === page)
        )}
        {btn('›', page + 1, page === totalPages, false)}
      </div>
      <span style={{ fontSize: 11.5, color: '#94A3B8' }}>
        Page {page} of {totalPages}
      </span>
    </div>
  );
}
