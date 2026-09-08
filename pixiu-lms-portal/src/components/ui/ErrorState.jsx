import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function ErrorState({
  title = 'Unable to load this section',
  description = 'Something went wrong while contacting the server.',
  onRetry,
  className = '',
}) {
  return (
    <div className={`rounded-2xl border border-rose-200 bg-rose-50/70 p-6 sm:p-8 text-center ${className}`} role="alert">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-white text-rose-500 border border-rose-200 flex items-center justify-center shadow-sm">
        <AlertTriangle size={22} />
      </div>
      <h3 className="mt-4 text-base font-black text-slate-900">{title}</h3>
      <p className="mt-1.5 mx-auto max-w-lg text-sm leading-relaxed text-slate-600">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
        >
          <RefreshCw size={14} /> Try again
        </button>
      )}
    </div>
  );
}
