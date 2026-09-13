import { useEffect } from 'react';
import { APP_NAME } from '../config/brand.js';

export function useDocumentTitle(pageTitle) {
  useEffect(() => {
    const prev = document.title;
    const next = pageTitle ? `${pageTitle} | ${APP_NAME}` : APP_NAME;
    document.title = next;
    return () => {
      document.title = prev;
    };
  }, [pageTitle]);
}
