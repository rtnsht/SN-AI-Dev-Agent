"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ChatMessage, FileAttachment, SDLCPhase } from "@/lib/types";
import type { ShareMetrics } from "@/lib/share-content";

const SHARE_CONNECTED_AT_KEY = "ai-share-connected-at";
const SHARE_PANEL_LINK_KEY = "ai-share-panel-link";
const SHARE_FINGERPRINT_KEY = "ai-share-fingerprint";

interface ActivityLogEntry {
  toolName?: string;
}

interface UseSharePromptArgs {
  connected: boolean;
  clientSessionId: string;
  messages: ChatMessage[];
  connectionError: string | null;
  rateLimitHit: boolean;
  pendingRetry: { text: string; images?: string[]; files?: FileAttachment[] } | null;
  completedPhases: SDLCPhase[];
  activityLog: ActivityLogEntry[];
}

interface UseSharePromptResult {
  showBanner: boolean;
  showModal: boolean;
  showPanelLink: boolean;
  fingerprint: string | null;
  sessionStats: ShareMetrics;
  markConnected: () => void;
  /** Clear share session timer when SN disconnects (avoids inflated duration after reconnect). */
  markDisconnected: () => void;
  openModalFromBanner: () => void;
  openModalFromPanel: () => void;
  dismissBanner: () => void;
  closeModal: () => void;
  onShared: (platform: "linkedin" | "x") => Promise<void>;
  resetSession: () => void;
}

function readSessionBool(key: string): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(key) === "true";
}

function readSessionNumber(key: string): number | null {
  if (typeof window === "undefined") return null;
  const value = sessionStorage.getItem(key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readLocalPromptCount(fingerprint: string | null): number {
  if (!fingerprint || typeof window === "undefined") return 0;
  const raw = localStorage.getItem(`share-prompt:${fingerprint}`);
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function writeLocalPromptCount(fingerprint: string | null, count: number): void {
  if (!fingerprint || typeof window === "undefined") return;
  localStorage.setItem(`share-prompt:${fingerprint}`, String(Math.max(0, Math.min(2, Math.round(count)))));
}

export function useSharePrompt({
  connected,
  clientSessionId,
  messages,
  connectionError,
  rateLimitHit,
  pendingRetry,
  completedPhases,
  activityLog,
}: UseSharePromptArgs): UseSharePromptResult {
  const [connectedAt, setConnectedAt] = useState<number | null>(() => readSessionNumber(SHARE_CONNECTED_AT_KEY));
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showPanelLink, setShowPanelLink] = useState(() => readSessionBool(SHARE_PANEL_LINK_KEY));
  const [fingerprint, setFingerprint] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(SHARE_FINGERPRINT_KEY);
  });
  const [clockTick, setClockTick] = useState(() => Date.now());

  const checkingRef = useRef(false);
  const lockRef = useRef(false);
  const dismissOnCloseRef = useRef(false);

  const assistantCount = useMemo(
    () => messages.filter((message) => message.role === "assistant" && !message.hidden).length,
    [messages]
  );
  const errorCount = useMemo(
    () => messages.filter((message) => message.type === "error").length,
    [messages]
  );
  const toolCount = useMemo(
    () => activityLog.filter((entry) => entry.toolName).length,
    [activityLog]
  );

  const sessionStats = useMemo<ShareMetrics>(() => {
    const durationMin = connectedAt ? Math.max(1, Math.round((clockTick - connectedAt) / 60_000)) : 1;
    return {
      durationMin,
      phaseCount: Math.max(1, completedPhases.length || 1),
      toolCount: Math.max(1, toolCount || 1),
      assistantCount: Math.max(1, assistantCount || 1),
      completedPhases,
    };
  }, [assistantCount, clockTick, completedPhases, connectedAt, toolCount]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (connectedAt) {
      sessionStorage.setItem(SHARE_CONNECTED_AT_KEY, String(connectedAt));
    } else {
      sessionStorage.removeItem(SHARE_CONNECTED_AT_KEY);
    }
  }, [connectedAt]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(SHARE_PANEL_LINK_KEY, String(showPanelLink));
  }, [showPanelLink]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (fingerprint) {
      sessionStorage.setItem(SHARE_FINGERPRINT_KEY, fingerprint);
    } else {
      sessionStorage.removeItem(SHARE_FINGERPRINT_KEY);
    }
  }, [fingerprint]);

  const trackAction = useCallback(
    async (action: "shown" | "dismissed" | "shared", platform?: "linkedin" | "x") => {
      const response = await fetch("/api/share-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: clientSessionId, action, platform }),
      });
      if (!response.ok) throw new Error(`share-tracking ${response.status}`);
      return response.json() as Promise<{ ok?: boolean; canShow?: boolean; fingerprint: string | null }>;
    },
    [clientSessionId]
  );

  const markConnected = useCallback(() => {
    setConnectedAt((prev) => prev ?? Date.now());
  }, []);

  const markDisconnected = useCallback(() => {
    setConnectedAt(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(SHARE_CONNECTED_AT_KEY);
    }
  }, []);

  const markPromptDismissed = useCallback(() => {
    lockRef.current = true;
    setShowBanner(false);
    setShowPanelLink(true);
    dismissOnCloseRef.current = false;
    const fp = fingerprint;
    if (fp) writeLocalPromptCount(fp, 2);
    void trackAction("dismissed")
      .then((data) => {
        if (data.fingerprint) {
          setFingerprint(data.fingerprint);
          writeLocalPromptCount(data.fingerprint, 2);
        }
      })
      .catch(() => {});
  }, [fingerprint, trackAction]);

  const openModalFromBanner = useCallback(() => {
    setShowBanner(false);
    setShowModal(true);
    dismissOnCloseRef.current = true;
  }, []);

  const openModalFromPanel = useCallback(() => {
    setShowModal(true);
    dismissOnCloseRef.current = false;
  }, []);

  const dismissBanner = useCallback(() => {
    markPromptDismissed();
  }, [markPromptDismissed]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    if (dismissOnCloseRef.current) {
      markPromptDismissed();
    }
  }, [markPromptDismissed]);

  const onShared = useCallback(
    async (platform: "linkedin" | "x") => {
      lockRef.current = true;
      setShowBanner(false);
      setShowModal(false);
      setShowPanelLink(true);
      dismissOnCloseRef.current = false;
      if (fingerprint) writeLocalPromptCount(fingerprint, 2);
      try {
        const data = await trackAction("shared", platform);
        if (data.fingerprint) {
          setFingerprint(data.fingerprint);
          writeLocalPromptCount(data.fingerprint, 2);
        }
      } catch {
        // Non-blocking: sharing should still work even if analytics tracking fails.
      }
    },
    [fingerprint, trackAction]
  );

  const resetSession = useCallback(() => {
    setConnectedAt(null);
    setShowBanner(false);
    setShowModal(false);
    setShowPanelLink(false);
    setFingerprint(null);
    setClockTick(Date.now());
    checkingRef.current = false;
    lockRef.current = false;
    dismissOnCloseRef.current = false;
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(SHARE_CONNECTED_AT_KEY);
      sessionStorage.removeItem(SHARE_PANEL_LINK_KEY);
      sessionStorage.removeItem(SHARE_FINGERPRINT_KEY);
    }
  }, []);

  useEffect(() => {
    if (!connected || !connectedAt || showBanner || showModal || showPanelLink || lockRef.current) return;

    const assistantMessages = Math.max(assistantCount, 1);
    const errorRatio = errorCount / assistantMessages;

    const tick = () => {
      setClockTick(Date.now());

      const durationMin = connectedAt ? Math.max(1, Math.round((Date.now() - connectedAt) / 60_000)) : 0;
      if (durationMin < 12) return;
      if (errorRatio >= 0.15) return;
      if (connectionError !== null) return;
      if (rateLimitHit) return;
      if (pendingRetry !== null) return;
      if (assistantCount < 3) return;
      if (completedPhases.length < 1) return;
      if (checkingRef.current) return;

      if (fingerprint && readLocalPromptCount(fingerprint) >= 2) {
        lockRef.current = true;
        return;
      }

      checkingRef.current = true;
      void trackAction("shown")
        .then((data) => {
          if (data.fingerprint) {
            setFingerprint(data.fingerprint);
          }

          if (!data.canShow) {
            if (data.fingerprint) writeLocalPromptCount(data.fingerprint, 2);
            lockRef.current = true;
            return;
          }

          if (data.fingerprint) {
            const nextCount = readLocalPromptCount(data.fingerprint) + 1;
            writeLocalPromptCount(data.fingerprint, nextCount);
          }
          setShowBanner(true);
        })
        .catch(() => {})
        .finally(() => {
          checkingRef.current = false;
        });
    };

    tick();
    const interval = window.setInterval(tick, 60_000);
    return () => window.clearInterval(interval);
  }, [
    assistantCount,
    completedPhases.length,
    connected,
    connectedAt,
    connectionError,
    errorCount,
    fingerprint,
    pendingRetry,
    rateLimitHit,
    showBanner,
    showModal,
    showPanelLink,
    trackAction,
  ]);

  return {
    showBanner,
    showModal,
    showPanelLink,
    fingerprint,
    sessionStats,
    markConnected,
    markDisconnected,
    openModalFromBanner,
    openModalFromPanel,
    dismissBanner,
    closeModal,
    onShared,
    resetSession,
  };
}
