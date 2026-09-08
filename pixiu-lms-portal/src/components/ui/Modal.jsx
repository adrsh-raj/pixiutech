import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnBackdrop = true,
}) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl',
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-2.5 sm:p-5"
      onMouseDown={() => closeOnBackdrop && onClose?.()}
      role="presentation"
    >
      <div
        className={`w-full ${sizeClasses[size] || sizeClasses.md} max-h-[94dvh] sm:max-h-[90dvh] rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'pixiu-modal-title' : undefined}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {(title || showCloseButton) && (
          <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-100 flex items-center gap-3 shrink-0">
            {title && <h2 id="pixiu-modal-title" className="text-sm sm:text-base font-black text-slate-900 min-w-0 flex-1">{title}</h2>}
            {showCloseButton && (
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                className="shrink-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div className="overflow-y-auto overscroll-contain p-4 sm:p-6 min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
}
