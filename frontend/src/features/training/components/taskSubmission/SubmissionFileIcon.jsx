import {
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  FileAudio,
  Palette,
  Presentation,
} from 'lucide-react';
import { getFileKind } from '../../taskSubmissionLimits.js';

const ICONS = {
  pdf: FileText,
  doc: FileText,
  sheet: FileSpreadsheet,
  slides: Presentation,
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  archive: FileArchive,
  code: FileCode,
  design: Palette,
  other: File,
};

export function SubmissionFileIcon({ name, mimeType, size = 20 }) {
  const kind = getFileKind(name, mimeType);
  const Icon = ICONS[kind] || File;
  return (
    <span className={`task-file-icon task-file-icon--${kind}`} aria-hidden>
      <Icon size={size} />
    </span>
  );
}
