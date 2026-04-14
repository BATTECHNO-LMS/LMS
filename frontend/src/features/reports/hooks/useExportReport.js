import { useMutation } from '@tanstack/react-query';
import { exportReport } from '../reports.service.js';

function triggerCsvDownload(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function useExportReport() {
  return useMutation({
    mutationFn: ({ type, format, params }) => exportReport(type, format, params),
    onSuccess: (data) => {
      if (data?.format === 'csv' && data?.content) {
        triggerCsvDownload(data.filename || 'report.csv', data.content);
      }
    },
  });
}
