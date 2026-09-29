import React from 'react';

export default function StatCard({ title, value, subtitle, icon: Icon, color = 'indigo', trend }) {
  const colorMap = {
    indigo: 'bg-white border-slate-200 hover:border-indigo-300 shadow-xs',
    emerald: 'bg-white border-slate-200 hover:border-emerald-300 shadow-xs',
    amber: 'bg-white border-slate-200 hover:border-amber-300 shadow-xs',
    rose: 'bg-white border-slate-200 hover:border-rose-300 shadow-xs',
    sky: 'bg-white border-slate-200 hover:border-sky-300 shadow-xs',
  };

  const iconBgMap = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    sky: 'bg-sky-50 text-sky-600',
  };

  return (
    <div className={`relative p-5 rounded-2xl border transition-all duration-300 hover:translate-y-[-2px] hover:shadow-md ${colorMap[color] || colorMap.indigo}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{value}</span>
            {trend && (
              <span className="text-xs font-bold text-emerald-600">
                {trend}
              </span>
            )}
          </div>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl shrink-0 ${iconBgMap[color] || iconBgMap.indigo}`}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  );
}
