/**
 * Reusable Skeleton Loader Component
 * 
 * @param {'card'|'table'|'chart'|'text'|'kpi'} type - The layout type of the skeleton
 * @param {number} count - Number of skeleton items to render
 * @param {string} className - Optional extra classes for the container
 */
export default function SkeletonLoader({ type = 'text', count = 1, className = '' }) {
  const items = Array.from({ length: count }, (_, i) => i);

  const renderSkeleton = () => {
    switch (type) {
      case 'kpi':
        return (
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}>
            {items.map(i => (
              <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-200 animate-pulse shrink-0"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-200 rounded animate-pulse w-24"></div>
                  <div className="h-6 bg-slate-200 rounded animate-pulse w-16"></div>
                </div>
              </div>
            ))}
          </div>
        );

      case 'card':
        return (
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
            {items.map(i => (
              <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse shrink-0"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4"></div>
                    <div className="h-3 bg-slate-200 rounded animate-pulse w-1/2"></div>
                  </div>
                </div>
                <div className="space-y-2 pt-4">
                  <div className="h-3 bg-slate-200 rounded animate-pulse w-full"></div>
                  <div className="h-3 bg-slate-200 rounded animate-pulse w-5/6"></div>
                </div>
              </div>
            ))}
          </div>
        );

      case 'table':
        return (
          <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${className}`}>
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex gap-4">
              <div className="h-4 bg-slate-200 rounded animate-pulse w-1/4"></div>
              <div className="h-4 bg-slate-200 rounded animate-pulse w-1/4 hidden sm:block"></div>
              <div className="h-4 bg-slate-200 rounded animate-pulse w-1/4 hidden md:block"></div>
            </div>
            <div className="divide-y divide-slate-100">
              {items.map(i => (
                <div key={i} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex items-center gap-3 w-full sm:w-1/4">
                    <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse shrink-0"></div>
                    <div className="space-y-2 flex-1">
                      <div className="h-3 bg-slate-200 rounded animate-pulse w-full"></div>
                      <div className="h-2 bg-slate-200 rounded animate-pulse w-2/3"></div>
                    </div>
                  </div>
                  <div className="h-3 bg-slate-200 rounded animate-pulse w-1/4 hidden sm:block"></div>
                  <div className="h-3 bg-slate-200 rounded animate-pulse w-1/4 hidden md:block"></div>
                  <div className="h-8 bg-slate-200 rounded-lg animate-pulse w-20 ml-auto shrink-0"></div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'chart':
        return (
          <div className={`space-y-6 ${className}`}>
            {items.map(i => (
              <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="h-4 bg-slate-200 rounded animate-pulse w-48 mb-6"></div>
                <div className="h-64 bg-slate-100 rounded-lg animate-pulse w-full"></div>
              </div>
            ))}
          </div>
        );

      case 'text':
      default:
        return (
          <div className={`space-y-6 ${className}`}>
            {items.map(i => (
              <div key={i} className="space-y-3">
                <div className="h-4 bg-slate-200 rounded animate-pulse w-full"></div>
                <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4"></div>
                <div className="h-4 bg-slate-200 rounded animate-pulse w-1/2"></div>
              </div>
            ))}
          </div>
        );
    }
  };

  return renderSkeleton();
}

