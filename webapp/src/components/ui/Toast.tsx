'use client';

import { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export interface ToastProps {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  onClose: (id: string) => void;
  duration?: number;
}

const TOAST_STYLES: Record<string, { bg: string; icon: React.ReactNode }> = {
  info: { bg: 'bg-blue-600', icon: <Info className="w-5 h-5" /> },
  success: { bg: 'bg-green-600', icon: <CheckCircle className="w-5 h-5" /> },
  warning: { bg: 'bg-amber-600', icon: <AlertTriangle className="w-5 h-5" /> },
  error: { bg: 'bg-red-600', icon: <AlertCircle className="w-5 h-5" /> },
};

export function Toast({ id, message, type = 'info', onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const style = TOAST_STYLES[type];

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-center gap-3 px-4 py-3 ${style.bg} text-white rounded-lg shadow-lg`}
    >
      {style.icon}
      <span className="flex-1 text-sm">{message}</span>
      <button
        onClick={() => onClose(id)}
        className="p-1 hover:bg-white/20 rounded"
        aria-label="Close toast"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
