"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage, SDLCPhase, CategorizedPrompts, FileAttachment } from "@/lib/types";

/* ── Session persistence keys (sessionStorage) ──────────────── */
export const SK = {
  MESSAGES: "ai-messages",
  CONN_INFO: "ai-conn-info",
  CREDS: "ai-creds",
  PROVIDER: "ai-provider",
  MODEL: "ai-model",
  MODEL_LOCKED: "ai-model-locked",
  REQ_ID: "ai-req-id",
  PHASE: "ai-phase",
  COMPLETED_PHASES: "ai-completed-phases",
  SESSION_ID: "ai-session-id",
  CATEGORIZED_PROMPTS: "ai-categorized-prompts",
  SEEN_SUGGESTIONS: "ai-seen-suggestions",
  SDD_MODE: "ai-sdd-mode",
} as const;

export const ALL_SESSION_KEYS = Object.values(SK);

function genSessionId(): string {
  return `sess_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

function genMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Strip heavy base64 data from messages before storing */
function stripHeavyData(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => ({
    ...m,
    images: m.images?.length ? m.images.map(() => "[image]") : undefined,
    files: m.files?.length
      ? m.files.map((f) => ({ ...f, data: "" }))
      : undefined,
  }));
}

export interface SessionState {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  messagesRef: React.MutableRefObject<ChatMessage[]>;
  activeReqId: string | null;
  setActiveReqId: React.Dispatch<React.SetStateAction<string | null>>;
  currentPhase: SDLCPhase | null;
  setCurrentPhase: React.Dispatch<React.SetStateAction<SDLCPhase | null>>;
  completedPhases: SDLCPhase[];
  setCompletedPhases: React.Dispatch<React.SetStateAction<SDLCPhase[]>>;
  sddMode: boolean;
  setSddMode: React.Dispatch<React.SetStateAction<boolean>>;
  clientSessionId: string;
  setClientSessionId: React.Dispatch<React.SetStateAction<string>>;
  modelLocked: boolean;
  setModelLocked: React.Dispatch<React.SetStateAction<boolean>>;
  pendingRetry: { text: string; images?: string[]; files?: FileAttachment[] } | null;
  setPendingRetry: React.Dispatch<React.SetStateAction<{ text: string; images?: string[]; files?: FileAttachment[] } | null>>;
  activityLog: ActivityLogEntry[];
  setActivityLog: React.Dispatch<React.SetStateAction<ActivityLogEntry[]>>;
  taskPlan: TaskPlanState | null;
  setTaskPlan: React.Dispatch<React.SetStateAction<TaskPlanState | null>>;
  categorizedPrompts: CategorizedPrompts | null;
  setCategorizedPrompts: React.Dispatch<React.SetStateAction<CategorizedPrompts | null>>;
  seenSuggestionHashes: string[];
  setSeenSuggestionHashes: React.Dispatch<React.SetStateAction<string[]>>;
  sessionRestored: boolean;
  setSessionRestored: React.Dispatch<React.SetStateAction<boolean>>;
  handleNewChat: () => void;
  handleSendRef: React.MutableRefObject<(text: string, images?: string[], files?: FileAttachment[], hidden?: boolean) => void>;
}

export interface ActivityLogEntry {
  message: string;
  phase: string;
  timestamp: number;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  done?: boolean;
  taskId?: number;
  taskName?: string;
}

export interface TaskPlanState {
  analysis: string;
  tasks: {
    id: number;
    name: string;
    type: string;
    tools: { name: string; args: Record<string, unknown> }[];
  }[];
}

interface InitialSessionSnapshot {
  messages: ChatMessage[];
  activeReqId: string | null;
  currentPhase: SDLCPhase | null;
  completedPhases: SDLCPhase[];
  sddMode: boolean;
  categorizedPrompts: CategorizedPrompts | null;
  seenSuggestionHashes: string[];
  sessionRestored: boolean;
  clientSessionId: string;
}

let sessionSnapshotCache: InitialSessionSnapshot | null = null;

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function getStoredSessionId() {
  if (typeof window === "undefined") return genSessionId();

  const saved = window.sessionStorage.getItem(SK.SESSION_ID);
  if (saved) return saved;

  const id = genSessionId();
  window.sessionStorage.setItem(SK.SESSION_ID, id);
  return id;
}

function getInitialSessionSnapshot(): InitialSessionSnapshot {
  const clientSessionId = getStoredSessionId();

  if (typeof window === "undefined") {
    return {
      messages: [],
      activeReqId: null,
      currentPhase: null,
      completedPhases: [],
      sddMode: false,
      categorizedPrompts: null,
      seenSuggestionHashes: [],
      sessionRestored: false,
      clientSessionId,
    };
  }

  const parsedMessages = readJson<ChatMessage[]>(SK.MESSAGES);
  const hasRestoredMessages = Array.isArray(parsedMessages) && parsedMessages.length > 0;
  const restoredMessages = hasRestoredMessages
    ? [
        ...parsedMessages,
        {
          id: genMessageId(),
          role: "system" as const,
          type: "info" as const,
          content: "Previous session restored. Please connect to continue.",
          timestamp: new Date().toISOString(),
        },
      ]
    : [];

  return {
    messages: restoredMessages,
    activeReqId: window.sessionStorage.getItem(SK.REQ_ID),
    currentPhase: (window.sessionStorage.getItem(SK.PHASE) as SDLCPhase | null) || null,
    completedPhases: readJson<SDLCPhase[]>(SK.COMPLETED_PHASES) ?? [],
    sddMode: window.sessionStorage.getItem(SK.SDD_MODE) === "true",
    categorizedPrompts: readJson<CategorizedPrompts>(SK.CATEGORIZED_PROMPTS),
    seenSuggestionHashes: readJson<string[]>(SK.SEEN_SUGGESTIONS) ?? [],
    sessionRestored: hasRestoredMessages,
    clientSessionId,
  };
}

function getCachedInitialSessionSnapshot() {
  if (!sessionSnapshotCache) {
    sessionSnapshotCache = getInitialSessionSnapshot();
  }

  return sessionSnapshotCache;
}

/**
 * Manages all session-level state: messages, phases, SDD mode, session ID,
 * and sessionStorage persistence. Extracted from page.tsx for maintainability.
 */
export function useSessionState(): SessionState {
  const [messages, setMessages] = useState<ChatMessage[]>(() => getCachedInitialSessionSnapshot().messages);
  const messagesRef = useRef<ChatMessage[]>(getCachedInitialSessionSnapshot().messages);
  const [activeReqId, setActiveReqId] = useState<string | null>(() => getCachedInitialSessionSnapshot().activeReqId);
  const [currentPhase, setCurrentPhase] = useState<SDLCPhase | null>(() => getCachedInitialSessionSnapshot().currentPhase);
  const [completedPhases, setCompletedPhases] = useState<SDLCPhase[]>(() => getCachedInitialSessionSnapshot().completedPhases);
  const [sddMode, setSddMode] = useState(() => getCachedInitialSessionSnapshot().sddMode);
  const [modelLocked, setModelLocked] = useState(false);
  const [pendingRetry, setPendingRetry] = useState<{ text: string; images?: string[]; files?: FileAttachment[] } | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [taskPlan, setTaskPlan] = useState<TaskPlanState | null>(null);
  const [categorizedPrompts, setCategorizedPrompts] = useState<CategorizedPrompts | null>(() => getCachedInitialSessionSnapshot().categorizedPrompts);
  const [seenSuggestionHashes, setSeenSuggestionHashes] = useState<string[]>(() => getCachedInitialSessionSnapshot().seenSuggestionHashes);
  const [sessionRestored, setSessionRestored] = useState(() => getCachedInitialSessionSnapshot().sessionRestored);
  const handleSendRef = useRef<(text: string, images?: string[], files?: FileAttachment[], hidden?: boolean) => void>(() => {});
  const [clientSessionId, setClientSessionId] = useState(() => getCachedInitialSessionSnapshot().clientSessionId);

  // Keep messagesRef in sync
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Finalize session on page unload
  useEffect(() => {
    const endSession = () => {
      if (clientSessionId) {
        navigator.sendBeacon(
          "/api/session-end",
          new Blob([JSON.stringify({ sessionId: clientSessionId })], { type: "application/json" })
        );
      }
    };
    window.addEventListener("beforeunload", endSession);
    return () => window.removeEventListener("beforeunload", endSession);
  }, [clientSessionId]);

  // Persist state to sessionStorage on change
  useEffect(() => {
    try { sessionStorage.setItem(SK.MESSAGES, JSON.stringify(stripHeavyData(messages))); } catch { /* quota */ }
  }, [messages]);
  useEffect(() => {
    try { if (activeReqId) sessionStorage.setItem(SK.REQ_ID, activeReqId); else sessionStorage.removeItem(SK.REQ_ID); } catch { /* quota */ }
  }, [activeReqId]);
  useEffect(() => {
    try { if (currentPhase) sessionStorage.setItem(SK.PHASE, currentPhase); else sessionStorage.removeItem(SK.PHASE); } catch { /* quota */ }
  }, [currentPhase]);
  useEffect(() => {
    try { sessionStorage.setItem(SK.COMPLETED_PHASES, JSON.stringify(completedPhases)); } catch { /* quota */ }
  }, [completedPhases]);
  useEffect(() => {
    try { sessionStorage.setItem(SK.SDD_MODE, String(sddMode)); } catch { /* quota */ }
  }, [sddMode]);
  useEffect(() => {
    try { sessionStorage.setItem(SK.MODEL_LOCKED, String(modelLocked)); } catch { /* quota */ }
  }, [modelLocked]);

  const handleNewChat = useCallback(() => {
    if (clientSessionId) {
      fetch("/api/session-end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: clientSessionId }),
      }).catch(() => {});
    }

    messagesRef.current = [];
    setMessages([]);
    setActiveReqId(null);
    setCurrentPhase(null);
    setCompletedPhases([]);
    setSddMode(false);
    setModelLocked(false);
    setPendingRetry(null);
    setActivityLog([]);
    setTaskPlan(null);
    setCategorizedPrompts(null);
    setSeenSuggestionHashes([]);
    setSessionRestored(false);
    ALL_SESSION_KEYS.forEach((k) => sessionStorage.removeItem(k));
    sessionSnapshotCache = null;

    const newId = genSessionId();
    setClientSessionId(newId);
    try { sessionStorage.setItem(SK.SESSION_ID, newId); } catch { /* quota */ }
  }, [clientSessionId]);

  return {
    messages, setMessages, messagesRef,
    activeReqId, setActiveReqId,
    currentPhase, setCurrentPhase,
    completedPhases, setCompletedPhases,
    sddMode, setSddMode,
    clientSessionId, setClientSessionId,
    modelLocked, setModelLocked,
    pendingRetry, setPendingRetry,
    activityLog, setActivityLog,
    taskPlan, setTaskPlan,
    categorizedPrompts, setCategorizedPrompts,
    seenSuggestionHashes, setSeenSuggestionHashes,
    sessionRestored,
    setSessionRestored,
    handleNewChat,
    handleSendRef,
  };
}
