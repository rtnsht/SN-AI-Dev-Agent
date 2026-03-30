"use client";

import { useCallback, useEffect, useState } from "react";

import type { WorkspaceContextPayload } from "@/lib/types";

interface WorkspaceContextState {
  context: WorkspaceContextPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useWorkspaceContext(enabled = true): WorkspaceContextState {
  const [context, setContext] = useState<WorkspaceContextPayload | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setContext(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/workspace/context", {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      if (response.status === 401) {
        setContext(null);
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Failed to load workspace context");
      }

      const payload = (await response.json()) as WorkspaceContextPayload;
      setContext(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspace context");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    context,
    loading,
    error,
    refresh,
  };
}
