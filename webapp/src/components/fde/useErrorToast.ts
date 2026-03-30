'use client';

import { useState, useCallback } from 'react';

export interface Toast {
  id: string;
  message: string;
  type?: 'error' | 'warning' | 'info';
}

export function useErrorToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const addToast = useCallback((message: string, type: Toast['type'] = 'error') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);
  
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);
  
  return { toasts, addToast, removeToast };
}
