import { AlertTriangle, X } from 'lucide-react';
import { useEffect } from 'react';

export default function ConfirmDialog({
  isOpen,
  title = 'Confirm action',
  description = 'This action cannot be undone.',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !loading) onCancel?.();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, loading, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-950/55  p-3 sm:p-5" role="presentation" onMouseDown={() => !loading && onCancel?.()}>
      <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-2xl overflow-hidden" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" onMouseDown={(event) => event.stopPropagation()}>
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${destructive ? 'bg-rose-50 text-rose-600' : 'bg-[#F0F7F5] text-[#27786D]'}`}>
              <AlertTriangle size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="confirm-dialog-title" className="text-base font-black text-slate-900">{title}</h2>
              <p id="confirm-dialog-description" className="mt-1.5 text-sm leading-relaxed text-slate-500">{description}</p>
            </div>
            <button type="button" onClick={onCancel} disabled={loading} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40" aria-label="Close confirmation dialog">
              <X size={17} />
            </button>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
            <button type="button" onClick={onCancel} disabled={loading} className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{cancelLabel}</button>
            <button type="button" onClick={onConfirm} disabled={loading} className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 ${destructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-slate-800'}`}>
              {loading ? 'Working…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
