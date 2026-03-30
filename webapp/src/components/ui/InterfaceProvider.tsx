'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface InterfaceTheme {
  mode: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  reducedMotion: boolean;
}

interface InterfaceContextType {
  theme: InterfaceTheme;
  setTheme: (theme: Partial<InterfaceTheme>) => void;
  resolvedMode: 'light' | 'dark';
}

const InterfaceContext = createContext<InterfaceContextType | null>(null);

const STORAGE_KEY = 'interface-theme';

const defaultTheme: InterfaceTheme = {
  mode: 'dark',
  fontSize: 'medium',
  reducedMotion: false,
};

export function InterfaceProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<InterfaceTheme>(() => {
    if (typeof window === 'undefined') return defaultTheme;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...defaultTheme, ...JSON.parse(stored) } : defaultTheme;
    } catch {
      return defaultTheme;
    }
  });

  const [resolvedMode, setResolvedMode] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const resolveMode = () => {
      if (theme.mode === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return theme.mode;
    };
    // Defer setState to avoid synchronous render cascade warning
    setTimeout(() => setResolvedMode(resolveMode()), 0);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (theme.mode === 'system') {
        setResolvedMode(mediaQuery.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme.mode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedMode);
    document.documentElement.classList.toggle('reduced-motion', theme.reducedMotion);

    const fontSizeClasses: Record<string, string> = {
      small: 'text-sm',
      medium: 'text-base',
      large: 'text-lg',
    };

    document.documentElement.classList.remove('text-sm', 'text-base', 'text-lg');
    document.documentElement.classList.add(fontSizeClasses[theme.fontSize]);
  }, [resolvedMode, theme]);

  const setTheme = (partial: Partial<InterfaceTheme>) => {
    setThemeState(prev => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <InterfaceContext.Provider value={{ theme, setTheme, resolvedMode }}>
      {children}
    </InterfaceContext.Provider>
  );
}

export function useInterface() {
  const context = useContext(InterfaceContext);
  if (!context) {
    throw new Error('useInterface must be used within InterfaceProvider');
  }
  return context;
}
