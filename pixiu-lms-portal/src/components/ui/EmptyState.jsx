/**
 * Reusable Empty State Component
 * 
 * @param {React.ReactNode} icon - Optional icon to display
 * @param {string} title - The main title
 * @param {string} description - Optional descriptive text
 * @param {React.ReactNode} action - Optional action button/element
 * @param {string} className - Optional extra classes
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = ''
}) {
  return (
    <div className={`py-12 flex flex-col items-center justify-center text-center ${className}`}>
      {icon && (
        <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4 shadow-sm border border-slate-200">
          {icon}
        </div>
      )}
      <h3 className="font-bold text-slate-600 text-base">{title}</h3>
      {description && (
        <p className="text-sm text-slate-400 mt-1.5 max-w-sm mx-auto">{description}</p>
      )}
      {action && (
        <div className="mt-6">
          {action}
        </div>
      )}
    </div>
  );
}

