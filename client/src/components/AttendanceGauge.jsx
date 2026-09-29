import React from 'react';

export default function AttendanceGauge({ percentage = 0, size = 180, strokeWidth = 14, title = 'Overall Attendance' }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const safePct = Math.min(100, Math.max(0, percentage));
  const offset = circumference - (safePct / 100) * circumference;

  let colorClass = '#059669'; // emerald
  let statusText = 'Excellent (Above 75%)';
  let statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';

  if (safePct < 60) {
    colorClass = '#e11d48'; // rose
    statusText = 'Critical Shortage';
    statusBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (safePct < 75) {
    colorClass = '#d97706'; // amber
    statusText = 'Low Attendance Warning';
    statusBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 rounded-3xl glass-card text-center">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">{title}</h3>
      
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-100 fill-transparent"
          />
          {/* Progress Ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colorClass}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out fill-transparent"
          />
        </svg>

        {/* Center Percentage Display */}
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            {safePct}%
          </span>
          <span className="text-[11px] text-slate-500 font-semibold">Requirement: 75%</span>
        </div>
      </div>

      <div className="mt-4">
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${statusBadgeClass}`}>
          {statusText}
        </span>
      </div>
    </div>
  );
}
