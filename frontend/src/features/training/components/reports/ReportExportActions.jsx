import { useState } from 'react';
import { Button } from '../../../../components/common/Button.jsx';
import {
  downloadOfficialReportPdf,
  downloadOfficialReportExcel,
  openOfficialReportPrintable,
} from '../../training.service.js';
import { getApiErrorMessage } from '../../../../services/apiHelpers.js';

/**
 * Official export toolbar: server PDF, Excel workbook, printable HTML.
 * Does not expose raw JSON in the official UI.
 */
export function ReportExportActions({ reportId, disabled = false }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  if (!reportId) return null;

  async function run(action, key) {
    setBusy(key);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذر تصدير التقرير.'));
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="report-export-actions" dir="rtl">
      <Button
        type="button"
        variant="primary"
        size="sm"
        disabled={disabled || Boolean(busy)}
        loading={busy === 'pdf'}
        onClick={() => run(() => downloadOfficialReportPdf(reportId), 'pdf')}
      >
        تنزيل PDF
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || Boolean(busy)}
        loading={busy === 'excel'}
        onClick={() => run(() => downloadOfficialReportExcel(reportId), 'excel')}
      >
        تنزيل Excel
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || Boolean(busy)}
        loading={busy === 'print'}
        onClick={() => run(() => openOfficialReportPrintable(reportId), 'print')}
      >
        نسخة للطباعة
      </Button>
      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
