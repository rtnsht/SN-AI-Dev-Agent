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

export interface ShareCard {
  phase: string;
  imageUrl: string;
  timestamp: string;
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
  generatedCards: ShareCard[];
  shareImageLoading: boolean;
  markConnected: () => void;
  markDisconnected: () => void;
  openModalFromBanner: () => void;
  openModalFromPanel: () => void;
  dismissBanner: () => void;
  closeModal: () => void;
  onShared: (platform: "linkedin" | "x") => Promise<void>;
  resetSession: () => void;
  generateShareImage: () => Promise<ShareCard | null>;
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
  const [generatedCards, setGeneratedCards] = useState<ShareCard[]>([]);
  const [shareImageLoading, setShareImageLoading] = useState(false);

  const checkingRef = useRef(false);
  const lockRef = useRef(false);
  const dismissOnCloseRef = useRef(false);
  const lastGenPhaseCountRef = useRef(0);

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
        // Non-blocking
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
    setGeneratedCards([]);
    setShareImageLoading(false);
    checkingRef.current = false;
    lockRef.current = false;
    dismissOnCloseRef.current = false;
    lastGenPhaseCountRef.current = 0;
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(SHARE_CONNECTED_AT_KEY);
      sessionStorage.removeItem(SHARE_PANEL_LINK_KEY);
      sessionStorage.removeItem(SHARE_FINGERPRINT_KEY);
    }
  }, []);

  const generateShareImage = useCallback(async (): Promise<ShareCard | null> => {
    if (shareImageLoading) return null;
    setShareImageLoading(true);

    try {
      const currentStats = {
        ...sessionStats,
        durationMin: connectedAt ? Math.max(1, Math.round((Date.now() - connectedAt) / 60_000)) : 1,
      };

      const response = await fetch("/api/share-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: clientSessionId,
          durationMin: currentStats.durationMin,
          phaseCount: currentStats.phaseCount,
          toolCount: currentStats.toolCount,
          assistantCount: currentStats.assistantCount,
          tag: currentStats.aiTag || "",
        }),
      });

      if (!response.ok) {
        console.error("[share-prompt] Image generation failed:", response.status);
        return null;
      }

      const data = await response.json();

      if (data.fallback) {
        // Server couldn't generate an image; the modal will use a CSS fallback
        return null;
      }

      if (data.imageBase64 && data.mimeType) {
        const blob = new Blob(
          [Uint8Array.from(atob(data.imageBase64), c => c.charCodeAt(0))],
          { type: data.mimeType },
        );
        const imageUrl = URL.createObjectURL(blob);
        const latestPhase = completedPhases.length > 0
          ? completedPhases[completedPhases.length - 1]
          : "session";

        const card: ShareCard = {
          phase: latestPhase,
          imageUrl,
          timestamp: new Date().toISOString(),
        };

        setGeneratedCards(prev => [...prev, card]);
        return card;
      }

      return null;
    } catch (err) {
      console.error("[share-prompt] Image generation error:", err);
      return null;
    } finally {
      setShareImageLoading(false);
    }
  }, [clientSessionId, completedPhases, connectedAt, sessionStats, shareImageLoading]);

  // Phase-based share prompt: trigger when a new phase is completed
  useEffect(() => {
    if (!connected || !connectedAt) return;

    const phaseCount = completedPhases.length;
    if (phaseCount <= lastGenPhaseCountRef.current) return;
    lastGenPhaseCountRef.current = phaseCount;

    const assistantMessages = Math.max(assistantCount, 1);
    const errorRatio = errorCount / assistantMessages;
    if (errorRatio >= 0.15) return;
    if (connectionError !== null) return;
    if (rateLimitHit) return;
    if (pendingRetry !== null) return;
    if (assistantCount < 3) return;

    // Show the banner on phase completion
    if (!showBanner && !showModal && !lockRef.current) {
      if (fingerprint && readLocalPromptCount(fingerprint) >= 2) {
        lockRef.current = true;
        return;
      }

      checkingRef.current = true;
      void trackAction("shown")
        .then((data) => {
          if (data.fingerprint) setFingerprint(data.fingerprint);
          if (!data.canShow) {
            if (data.fingerprint) writeLocalPromptCount(data.fingerprint, 2);
            lockRef.current = true;
            return;
          }
          if (data.fingerprint) {
            writeLocalPromptCount(data.fingerprint, readLocalPromptCount(data.fingerprint) + 1);
          }
          setShowBanner(true);
          setShowPanelLink(true);
        })
        .catch(() => {})
        .finally(() => { checkingRef.current = false; });
    }

    // Generate a share image in the background (non-blocking, skip if we already have one)
    if (generatedCards.length === 0) {
      void generateShareImage();
    }
  }, [
    assistantCount,
    completedPhases,
    connected,
    connectedAt,
    connectionError,
    errorCount,
    fingerprint,
    generateShareImage,
    generatedCards,
    pendingRetry,
    rateLimitHit,
    showBanner,
    showModal,
    trackAction,
  ]);

  // Keep clock ticking for duration stat
  useEffect(() => {
    if (!connected || !connectedAt) return;
    const interval = window.setInterval(() => setClockTick(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, [connected, connectedAt]);

  return {
    showBanner,
    showModal,
    showPanelLink,
    fingerprint,
    sessionStats,
    generatedCards,
    shareImageLoading,
    markConnected,
    markDisconnected,
    openModalFromBanner,
    openModalFromPanel,
    dismissBanner,
    closeModal,
    onShared,
    resetSession,
    generateShareImage,
  };
}
