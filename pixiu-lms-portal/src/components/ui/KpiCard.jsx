import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

const colorMapping = {
  blue: { icon: 'bg-[#F0F7F5] text-[#27786D] border-[#D8E8E3]' },
  emerald: { icon: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  amber: { icon: 'bg-amber-50 text-amber-700 border-amber-200' },
  rose: { icon: 'bg-rose-50 text-rose-700 border-rose-200' },
  violet: { icon: 'bg-[#F6F2E9] text-[#806936] border-[#E0D2B9]' },
  slate: { icon: 'bg-slate-100 text-slate-600 border-slate-200' }
};

export default function KpiCard({ icon, label, value, subtext, trend, trendValue, color = 'blue', onClick }) {
  const isClickable = typeof onClick === 'function';
  const theme = colorMapping[color] || colorMapping.blue;
  return (
    <div className={'relative bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ' + (isClickable ? 'cursor-pointer hover:border-slate-300 hover:shadow-md transition-shadow duration-150' : '')} onClick={isClickable ? onClick : undefined} role={isClickable ? 'button' : undefined} tabIndex={isClickable ? 0 : undefined} onKeyDown={isClickable ? (event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick?.(); } }) : undefined}>
      <div className="p-5 sm:p-6 flex items-center gap-4">
        <div className={'w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ' + theme.icon}>{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-slate-600 font-semibold uppercase tracking-wider mb-1 truncate">{label}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-extrabold text-slate-900 tracking-tight truncate">{value}</p>
            {trend && trendValue && <span className={'text-[10px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-md ' + (trend === 'up' ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50')}>
              {trend === 'up' ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{trendValue}
            </span>}
          </div>
          {subtext && <p className="text-[11px] text-slate-600 mt-0.5 truncate">{subtext}</p>}
        </div>
      </div>
    </div>
  );
}
