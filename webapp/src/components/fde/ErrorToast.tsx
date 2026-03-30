'use client';

import { useEffect, useState } from 'react';
import { X, AlertCircle, Info } from 'lucide-react';

export interface ErrorToastProps {
  id: string;
  message: string;
  type?: 'error' | 'warning' | 'info';
  onClose: (id: string) => void;
}

export function ErrorToast({ id, message, type = 'error', onClose }: ErrorToastProps) {
  const bgColor = type === 'error' ? 'bg-red-600' : type === 'warning' ? 'bg-amber-500' : 'bg-blue-500';
  const Icon = type === 'error' ? X : type === 'warning' ? AlertCircle : Info;
  
  useEffect(() => {
    const timer = setTimeout(() => onClose(id), 8000);
    return () => clearTimeout(timer);
  }, [id, onClose]);
  
  return (
    <div 
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 ${bgColor} text-white px-4 py-3 rounded shadow-lg flex items-center gap-3 max-w-md`}
      role="alert"
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      aria-label={`${type} notification`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
      <span className="flex-1 text-sm">{message}</span>
      <button 
        onClick={() => onClose(id)} 
        className="p-1 hover:bg-white/20 rounded focus:outline-none focus:ring-2 focus:ring-white/50"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
