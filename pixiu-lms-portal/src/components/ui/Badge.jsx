const variantClasses = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200'
};

const dotColors = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-blue-500',
  neutral: 'bg-slate-500'
};

const sizeClasses = {
  sm: 'text-[10px] px-2 py-0.5',
  md: 'text-xs px-2.5 py-1'
};

/**
 * Reusable Status Badge Component
 * 
 * @param {'success'|'warning'|'danger'|'info'|'neutral'} variant - The visual style variant
 * @param {React.ReactNode} children - Badge content
 * @param {'sm'|'md'} size - The size of the badge
 * @param {boolean} dot - Whether to show an animated pulse dot
 * @param {string} className - Optional extra classes
 */
export default function Badge({
  variant = 'neutral',
  children,
  size = 'sm',
  dot = false,
  className = ''
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wider border ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}>
      {dot && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColors[variant]}`}></span>
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotColors[variant]}`}></span>
        </span>
      )}
      {children}
    </span>
  );
}

