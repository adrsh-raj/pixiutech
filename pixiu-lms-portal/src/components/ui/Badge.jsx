const variantClasses = {
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200', warning: 'bg-amber-50 text-amber-800 border-amber-200', danger: 'bg-rose-50 text-rose-800 border-rose-200', info: 'bg-[#F0F7F5] text-[#215F55] border-[#BEDBD5]', neutral: 'bg-slate-100 text-slate-700 border-slate-200'
};
const dotColors = { success: 'bg-emerald-500', warning: 'bg-amber-500', danger: 'bg-rose-500', info: 'bg-[#27786D]', neutral: 'bg-slate-500' };
const sizeClasses = { sm: 'text-[10px] px-2 py-0.5', md: 'text-xs px-2.5 py-1' };
export default function Badge({ variant = 'neutral', children, size = 'sm', dot = false, className = '' }) {
  return <span className={'inline-flex items-center gap-1.5 rounded-md font-semibold uppercase tracking-wider border ' + variantClasses[variant] + ' ' + sizeClasses[size] + ' ' + className}>{dot && <span className={'inline-flex rounded-full h-1.5 w-1.5 shrink-0 ' + dotColors[variant]} aria-hidden="true" />}{children}</span>;
}
