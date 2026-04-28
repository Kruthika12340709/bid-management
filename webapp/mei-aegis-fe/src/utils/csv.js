/**
 * Download an array of objects as CSV.
 * @param {string} filename
 * @param {Array<Object>} rows
 * @param {Array<{key: string, label: string, format?: (v: any, row: any) => string}>} columns
 */
export function downloadCSV(filename, rows, columns) {
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /["\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map(c => escape(c.label)).join(',');
  const body = rows.map(r => columns.map(c => {
    const raw = r[c.key];
    return escape(c.format ? c.format(raw, r) : raw);
  }).join(',')).join('\n');
  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
