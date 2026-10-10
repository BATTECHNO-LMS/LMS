import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { SubmissionFileIcon } from './SubmissionFileIcon.jsx';
import { FileExtLabel, FileSize, displayFileName } from './FileSize.jsx';
import { getFileKind } from '../../taskSubmissionLimits.js';
import {
  downloadLegacyTaskSubmissionFile,
  downloadTaskSubmissionFile,
} from '../../taskSubmissions.service.js';
import { getApiErrorMessage } from '../../../../services/apiHelpers.js';

/**
 * Read-only list of a submission's attachments with secure (authenticated blob) downloads.
 */
export function SubmissionFileList({ submissionId, files = [], hasLegacyFile = false, onError, hideSummary = false }) {
  const [busyId, setBusyId] = useState(null);
  const list = Array.isArray(files) ? files : [];
  if (!list.length && !hasLegacyFile) return null;
  const totalBytes = list.reduce((sum, f) => sum + (Number(f.size) || 0), 0);

  async function run(id, fn) {
    if (busyId) return;
    setBusyId(id);
    try {
      await fn();
    } catch (err) {
      onError?.(getApiErrorMessage(err, 'تعذّر تنزيل الملف.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="task-file-list" dir="rtl">
      {list.length && !hideSummary ? (
        <p className="task-file-list__summary">
          {list.length} {list.length === 1 ? 'ملف' : 'ملفات'} · <FileSize bytes={totalBytes} />
        </p>
      ) : null}
      <ul className="task-file-list__items">
        {list.map((f) => (
          <li key={f.id} className="task-file-row task-file-row--done">
            <SubmissionFileIcon name={f.originalName} mimeType={f.mimeType} />
            <div className="task-file-row__meta">
              <span className="task-file-row__name" title={f.originalName} dir="auto">
                {displayFileName(f.originalName)}
              </span>
              <span className="task-file-row__sub">
                <FileSize bytes={f.size} />
                <FileExtLabel name={f.originalName} />
                {getFileKind(f.originalName, f.mimeType) === 'archive' ? <span>ملف مضغوط (لا يُفك تلقائياً)</span> : null}
              </span>
            </div>
            <button
              type="button"
              className="task-file-row__action"
              onClick={() => run(f.id, () => downloadTaskSubmissionFile(submissionId, f.id, f.originalName))}
              disabled={Boolean(busyId)}
              aria-label={`تنزيل ${f.originalName}`}
            >
              {busyId === f.id ? <Loader2 size={16} className="task-spin" aria-hidden /> : <Download size={16} aria-hidden />}
              <span>تنزيل</span>
            </button>
          </li>
        ))}
        {hasLegacyFile ? (
          <li className="task-file-row task-file-row--done">
            <SubmissionFileIcon name="" />
            <div className="task-file-row__meta">
              <span className="task-file-row__name">الملف المرفق (تسليم سابق)</span>
            </div>
            <button
              type="button"
              className="task-file-row__action"
              onClick={() => run('legacy', () => downloadLegacyTaskSubmissionFile(submissionId))}
              disabled={Boolean(busyId)}
              aria-label="تنزيل الملف المرفق"
            >
              {busyId === 'legacy' ? <Loader2 size={16} className="task-spin" aria-hidden /> : <Download size={16} aria-hidden />}
              <span>تنزيل</span>
            </button>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
