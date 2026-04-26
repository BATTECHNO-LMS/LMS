import React from 'react';

export function StudentDashboardSkeleton() {
  return (
    <div className="student-dash-skeleton" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="student-dash-skeleton__block" />
      ))}
    </div>
  );
}
