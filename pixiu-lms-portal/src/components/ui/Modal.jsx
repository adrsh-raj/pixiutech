import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Reusable Modal Component
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true
}) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${sizeClasses[size]} overflow-hidden border border-slate-200/80 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        {(title || showCloseButton) && (
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
            {title && <h2 className="text-base font-bold text-slate-800">{title}</h2>}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-1.5 transition-all cursor-pointer ml-auto"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div className="overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
