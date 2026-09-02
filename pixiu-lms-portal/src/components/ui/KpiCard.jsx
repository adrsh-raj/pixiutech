import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
const colorMapping = {
  blue: 'bg-blue-50 text-blue-600 border-blue-100',
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  amber: 'bg-amber-50 text-amber-600 border-amber-100',
  rose: 'bg-rose-50 text-rose-600 border-rose-100',
  violet: 'bg-violet-50 text-violet-600 border-violet-100',
  slate: 'bg-slate-100 text-slate-600 border-slate-200'
};

/**
 * Reusable KPI Card Component
 * 
 * @param {React.ReactNode} icon - Icon to display
 * @param {string} label - The label/title of the KPI
 * @param {string|number} value - The main value to display
 * @param {string} subtext - Optional secondary text below value
 * @param {'up'|'down'} trend - Optional trend direction
 * @param {string} trendValue - Optional trend value (e.g., "12%")
 * @param {'blue'|'emerald'|'amber'|'rose'|'violet'|'slate'} color - The color theme for the icon badge
 * @param {function} onClick - Optional click handler
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
  
  return (
    <div 
      className={`bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 ${isClickable ? 'cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5' : ''}`}
      onClick={isClickable ? onClick : undefined}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${colorMapping[color]}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5 truncate">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-slate-800 truncate">{value}</p>
          {trend && trendValue && (
            <span className={`text-[10px] font-bold flex items-center ${trend === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {trendValue}
            </span>
          )}
        </div>
        {subtext && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{subtext}</p>}
      </div>
    </div>
  );
}

