import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

const colorMapping = {
  blue:    { icon: 'bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20', accent: 'from-blue-500 to-cyan-400' },
  emerald: { icon: 'bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20', accent: 'from-emerald-500 to-teal-400' },
  amber:   { icon: 'bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20', accent: 'from-amber-500 to-orange-400' },
  rose:    { icon: 'bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20', accent: 'from-rose-500 to-pink-400' },
  violet:  { icon: 'bg-violet-500/10 text-violet-600 ring-1 ring-violet-500/20', accent: 'from-violet-500 to-purple-400' },
  slate:   { icon: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200', accent: 'from-slate-400 to-slate-300' }
};

/**
 * Reusable KPI Card Component
 */
export default function KpiCard({
  icon,
  label,
  value,
  subtext,
  trend,
  trendValue,
  color = 'blue',
  onClick
}) {
  const isClickable = typeof onClick === 'function';
  const theme = colorMapping[color] || colorMapping.blue;

  return (
    <div
      className={`relative bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden group ${
        isClickable ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200' : ''
      }`}
      onClick={isClickable ? onClick : undefined}
    >
      {/* Top accent gradient line */}
      <div className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r ${theme.accent} opacity-80`} />
      
      <div className="p-5 sm:p-6 flex items-center gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${theme.icon}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1 truncate">{label}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-extrabold text-slate-800 tracking-tight truncate">{value}</p>
            {trend && trendValue && (
              <span className={`text-[10px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-md ${
                trend === 'up' ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
              }`}>
                {trend === 'up' ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                {trendValue}
              </span>
            )}
          </div>
          {subtext && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{subtext}</p>}
        </div>
      </div>
    </div>
  );
}
