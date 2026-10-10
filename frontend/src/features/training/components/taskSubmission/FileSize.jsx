import { displayFileName, formatFileSize, getFileExtension } from '../../taskSubmissionLimits.js';

export { displayFileName };

/** Byte size isolated as LTR so "12 MB" keeps its order inside Arabic text. */
export function FileSize({ bytes }) {
  return <bdi dir="ltr">{formatFileSize(bytes)}</bdi>;
}

/** Extension shown apart from the (possibly truncated) file name, e.g. "ZIP". */
export function FileExtLabel({ name }) {
  const ext = getFileExtension(name).slice(1);
  if (!ext) return null;
  return (
    <bdi dir="ltr" className="task-file-row__ext">
      {(ext.length > 8 ? `${ext.slice(0, 8)}…` : ext).toUpperCase()}
    </bdi>
  );
}
