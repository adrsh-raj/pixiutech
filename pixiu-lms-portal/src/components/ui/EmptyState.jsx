import { PackageOpen } from 'lucide-react';

export default function EmptyState({
  icon,
  title = 'Nothing here yet',
  description,
  action,
  className = '',
  compact = false,
}) {
  return (
    <div className={`${compact ? 'py-7 sm:py-8' : 'py-10 sm:py-14'} px-4 flex flex-col items-center justify-center text-center ${className}`}>
      <div className={`${compact ? 'w-12 h-12' : 'w-14 h-14 sm:w-16 sm:h-16'} rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4 shadow-sm border border-slate-200`}>
        {icon || <PackageOpen size={22} />}
      </div>
      <h3 className="font-black text-slate-700 text-sm sm:text-base">{title}</h3>
      {description && <p className="text-xs sm:text-sm text-slate-400 mt-1.5 max-w-md leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
