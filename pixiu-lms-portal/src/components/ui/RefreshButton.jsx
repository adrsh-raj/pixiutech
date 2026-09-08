import { RefreshCw } from 'lucide-react';
import { useState } from 'react';

export default function RefreshButton({ onRefresh, loading = false, label = 'Refresh', className = '' }) {
  const [localLoading, setLocalLoading] = useState(false);
  const busy = loading || localLoading;

  const handleClick = async () => {
    if (busy || typeof onRefresh !== 'function') return;
    setLocalLoading(true);
    try {
      await onRefresh();
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label={busy ? `${label}ing` : label}
      title={busy ? `${label}ing…` : label}
      className={`inline-flex min-w-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
      <span className="hidden sm:inline">{busy ? 'Refreshing…' : label}</span>
    </button>
  );
}
