import { useLocation } from 'react-router-dom';

/** @returns {'/admin' | '/instructor'} */
export function usePortalPathPrefix() {
  const { pathname } = useLocation();
  return pathname.startsWith('/instructor') ? '/instructor' : '/admin';
}
