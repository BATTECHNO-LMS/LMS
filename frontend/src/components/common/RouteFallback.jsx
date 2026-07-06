import { LoadingSpinner } from './LoadingSpinner.jsx';

/** Lightweight suspense fallback for lazy-loaded portal routes. */
export function RouteFallback() {
  return (
    <div
      className="route-fallback"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '12rem',
        padding: '2rem 1rem',
      }}
    >
      <LoadingSpinner />
    </div>
  );
}
