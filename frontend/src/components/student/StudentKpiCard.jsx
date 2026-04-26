import React from 'react';

export function StudentKpiCard({ label, value, icon: Icon, color = 'primary' }) {
  const colorClass = `student-kpi--${color}`;
  
  return (
    <div className={`student-kpi ${colorClass}`}>
      <div className="student-kpi__icon">
        <Icon size={24} />
      </div>
      <div className="student-kpi__content">
        <span className="student-kpi__label">{label}</span>
        <span className="student-kpi__value">{value}</span>
      </div>
    </div>
  );
}
