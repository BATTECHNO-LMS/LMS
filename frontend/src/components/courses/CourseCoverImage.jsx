import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { getFileUrl } from '../../utils/uploadUrl.js';

/**
 * Resolves course cover URLs and falls back to a placeholder on missing/broken images.
 */
export function CourseCoverImage({
  src,
  alt = '',
  className,
  imgClassName = 'course-card__cover-img',
  fallbackClassName = 'course-card__cover-fallback',
  iconSize = 36,
}) {
  const [failed, setFailed] = useState(false);
  const url = getFileUrl(src);

  if (!url || failed) {
    return (
      <div className={fallbackClassName} aria-hidden>
        <BookOpen size={iconSize} strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className={imgClassName || className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
