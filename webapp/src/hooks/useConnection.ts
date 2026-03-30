'use client';

import { useState, useCallback } from 'react';
import type { ConnectionResult } from '@/lib/types';

export interface UseConnectionOptions {
  autoFetch?: boolean;
}

export interface UseConnectionReturn {
  connection: ConnectionResult | null;
  isLoading: boolean;
  error: string | null;
  connect: (credentials: { instanceUrl: string; username: string; password: string }) => Promise<void>;
  disconnect: () => void;
  refresh: () => Promise<void>;
}

export function useConnection(options: UseConnectionOptions = {}): UseConnectionReturn {
  // autoFetch is available for future use but not currently implemented
  void options.autoFetch;
  const [connection, setConnection] = useState<ConnectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async (credentials: { instanceUrl: string; username: string; password: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Connection failed');
      }
      setConnection(data);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Connection failed';
      setError(errorMessage);
      setConnection(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setConnection(null);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!connection) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/connect/test', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Refresh failed');
      }
      setConnection(prev => (prev ? { ...prev, ...data } : data));
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Refresh failed';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [connection]);

  return { connection, isLoading, error, connect, disconnect, refresh };
}
