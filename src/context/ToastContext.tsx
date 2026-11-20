import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react';
import { cn } from '../lib/cn';

export type ToastVariant = 'info' | 'demo' | 'warning' | 'success';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  pushToast: (toast: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-2), { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3400);
  }, []);

  return (
    <ToastContext.Provider value={{ pushToast, dismissToast }}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-20 right-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 md:bottom-6 md:right-6 pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border bg-[#202020] px-4 py-3 shadow-xl transition-all duration-200',
              toast.variant === 'demo' && 'border-[#96D2C5]/30',
              toast.variant === 'success' && 'border-[#96D2C5]/40',
              toast.variant === 'info' && 'border-white/10',
              toast.variant === 'warning' && 'border-[#F19A50]/40'
            )}
          >
            <div className="mt-0.5 shrink-0">
              {(toast.variant === 'demo' || toast.variant === 'success') && (
                <CheckCircle2 className="h-4 w-4 text-[#96D2C5]" />
              )}
              {toast.variant === 'info' && <Info className="h-4 w-4 text-[#A9C8E9]" />}
              {toast.variant === 'warning' && <AlertCircle className="h-4 w-4 text-[#F19A50]" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#F2F2F2]">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 text-xs text-[#A3A3A8]">{toast.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="rounded-md p-1 text-[#737378] transition-colors hover:bg-white/5 hover:text-[#F2F2F2]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
