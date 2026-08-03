import { Button } from '../../../../components/common/Button.jsx';

function downloadBlob(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function flattenToRows(obj, prefix = '') {
  const rows = [];
  for (const [key, value] of Object.entries(obj || {})) {
    const label = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      rows.push(...flattenToRows(value, label));
    } else if (Array.isArray(value)) {
      rows.push([label, value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : v)).join(' | ')]);
    } else {
      rows.push([label, value ?? '']);
    }
  }
  return rows;
}

function toCsv(rows) {
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

/**
 * Lightweight export toolbar for report views: raw JSON download, CSV
 * ("Excel") export flattened from the snapshot, and a print-friendly window
 * for saving as PDF via the browser's native print dialog.
 * @param {{ data: object, filenameBase?: string, title?: string }} props
 */
export function ReportExportActions({ data, filenameBase = 'training-report', title = 'تقرير' }) {
  function handleJson() {
    downloadBlob(`${filenameBase}.json`, JSON.stringify(data, null, 2), 'application/json;charset=utf-8;');
  }

  function handleCsv() {
    const rows = flattenToRows(data);
    downloadBlob(`${filenameBase}.csv`, `\uFEFF${toCsv(rows)}`, 'text/csv;charset=utf-8;');
  }

  function handlePrint() {
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (!win) return;
    win.document.write(`<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: 'Tajawal', 'IBM Plex Sans Arabic', sans-serif; padding: 2rem; color: #243241; }
  h1 { color: #132d4a; font-size: 1.35rem; margin-bottom: 1rem; }
  pre { white-space: pre-wrap; word-break: break-word; background: #f7f1e7; padding: 1rem; border-radius: 8px; font-size: 0.85rem; line-height: 1.6; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>
</body>
</html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div className="report-export-actions">
      <Button type="button" variant="outline" size="sm" onClick={handleJson}>
        تنزيل JSON
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={handleCsv}>
        تصدير Excel (CSV)
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
        طباعة / PDF
      </Button>
    </div>
  );
}
