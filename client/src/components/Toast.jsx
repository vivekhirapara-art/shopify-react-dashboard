import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  success: { Icon: CheckCircle2, bar: 'bg-emerald-500', border: 'border-emerald-500/30', icon: 'text-emerald-400' },
  error: { Icon: AlertCircle, bar: 'bg-red-500', border: 'border-red-500/30', icon: 'text-red-400' },
  warning: { Icon: AlertTriangle, bar: 'bg-amber-500', border: 'border-amber-500/30', icon: 'text-amber-400' },
  info: { Icon: Info, bar: 'bg-blue-500', border: 'border-blue-500/30', icon: 'text-blue-400' },
};

function ToastItem({ toast, onDismiss }) {
  const cfg = ICONS[toast.type] || ICONS.info;
  const { Icon } = cfg;
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const duration = toast.duration || 4000;
    const tick = () => {
      const left = Math.max(0, 100 - ((Date.now() - start) / duration) * 100);
      setProgress(left);
      if (left > 0) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div
      className={`toast-enter pointer-events-auto w-80 overflow-hidden rounded-2xl border bg-white/95 shadow-xl backdrop-blur-md dark:bg-slate-900/95 ${cfg.border}`}
      role="alert"
    >
      <div className="flex items-start gap-3 p-4">
        <Icon className={`h-5 w-5 shrink-0 ${cfg.icon}`} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 dark:text-slate-100">{toast.title}</p>
          {toast.message && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{toast.message}</p>}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="h-0.5 w-full bg-slate-200 dark:bg-slate-800">
        <div className={`h-full transition-all duration-100 ease-linear ${cfg.bar}`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(({ type = 'info', title, message, duration = 4000 }) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [{ id, type, title, message, duration }, ...prev].slice(0, 3));
    return id;
  }, []);

  const toast = useCallback(
    (type, title, message) => addToast({ type, title, message }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ addToast, toast, dismiss }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex flex-col gap-3">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
