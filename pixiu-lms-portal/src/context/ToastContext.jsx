import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { CheckCircle2, AlertOctagon, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((type, message, title = '') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-4), { id, type, message, title }]);
    window.setTimeout(() => removeToast(id), 4500);
  }, [removeToast]);

  const toast = useMemo(() => ({
    success: (message, title = 'Success') => addToast('success', message, title),
    error: (message, title = 'Error') => addToast('error', message, title),
    warning: (message, title = 'Warning') => addToast('warning', message, title),
    info: (message, title = 'Notification') => addToast('info', message, title),
  }), [addToast]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="fixed inset-x-3 bottom-3 sm:inset-x-auto sm:right-5 sm:bottom-5 z-[80] flex flex-col gap-2.5 sm:max-w-sm sm:w-[calc(100vw-2.5rem)] pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border shadow-2xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-5 fade-in ${
              item.type === 'success'
                ? 'bg-slate-900/95 border-emerald-500/40 text-white shadow-emerald-950/40'
                : item.type === 'error'
                ? 'bg-slate-900/95 border-rose-500/40 text-white shadow-rose-950/40'
                : item.type === 'warning'
                ? 'bg-slate-900/95 border-amber-500/40 text-white shadow-amber-950/40'
                : 'bg-slate-900/95 border-blue-500/40 text-white shadow-blue-950/40'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {item.type === 'success' && <CheckCircle2 size={18} className="text-emerald-400" />}
              {item.type === 'error' && <AlertOctagon size={18} className="text-rose-400" />}
              {item.type === 'warning' && <AlertTriangle size={18} className="text-amber-400" />}
              {item.type === 'info' && <Info size={18} className="text-blue-400" />}
            </div>
            <div className="flex-1 min-w-0">
              {item.title && <h4 className="text-xs font-bold text-slate-100 tracking-tight">{item.title}</h4>}
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed break-words">{item.message}</p>
            </div>
            <button
              type="button"
              onClick={() => removeToast(item.id)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
