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

/**
 * Manages all session-level state: messages, phases, SDD mode, session ID,
 * and sessionStorage persistence. Extracted from page.tsx for maintainability.
 */
export function useSessionState(): SessionState {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  const [activeReqId, setActiveReqId] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<SDLCPhase | null>(null);
  const [completedPhases, setCompletedPhases] = useState<SDLCPhase[]>([]);
  const [sddMode, setSddMode] = useState(false);
  const [modelLocked, setModelLocked] = useState(false);
  const [pendingRetry, setPendingRetry] = useState<{ text: string; images?: string[]; files?: FileAttachment[] } | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [taskPlan, setTaskPlan] = useState<TaskPlanState | null>(null);
  const [categorizedPrompts, setCategorizedPrompts] = useState<CategorizedPrompts | null>(null);
  const [seenSuggestionHashes, setSeenSuggestionHashes] = useState<string[]>([]);
  const [sessionRestored, setSessionRestored] = useState(false);
  const handleSendRef = useRef<(text: string, images?: string[], files?: FileAttachment[], hidden?: boolean) => void>(() => {});

  const [clientSessionId, setClientSessionId] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(SK.SESSION_ID);
      if (saved) return saved;
    }
    const id = `sess_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    if (typeof window !== "undefined") sessionStorage.setItem(SK.SESSION_ID, id);
    return id;
  });

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

  // Restore session from sessionStorage on mount
  useEffect(() => {
    try {
      const savedMessages = sessionStorage.getItem(SK.MESSAGES);
      if (!savedMessages) return;
      const parsed: ChatMessage[] = JSON.parse(savedMessages);
      if (!Array.isArray(parsed) || parsed.length === 0) return;

      messagesRef.current = parsed;
      setMessages(parsed);

      const savedReqId = sessionStorage.getItem(SK.REQ_ID);
      if (savedReqId) setActiveReqId(savedReqId);
      const savedPhase = sessionStorage.getItem(SK.PHASE);
      if (savedPhase) setCurrentPhase(savedPhase as SDLCPhase);
      const savedCompleted = sessionStorage.getItem(SK.COMPLETED_PHASES);
      if (savedCompleted) setCompletedPhases(JSON.parse(savedCompleted));
      const savedSddMode = sessionStorage.getItem(SK.SDD_MODE);
      if (savedSddMode === "true") setSddMode(true);
      const savedLocked = sessionStorage.getItem(SK.MODEL_LOCKED);
      if (savedLocked === "true") setModelLocked(true);

      const savedPrompts = sessionStorage.getItem(SK.CATEGORIZED_PROMPTS);
      if (savedPrompts) {
        try { setCategorizedPrompts(JSON.parse(savedPrompts)); } catch { /* corrupt */ }
      }
      const savedSeen = sessionStorage.getItem(SK.SEEN_SUGGESTIONS);
      if (savedSeen) {
        try { setSeenSuggestionHashes(JSON.parse(savedSeen)); } catch { /* corrupt */ }
      }

      setSessionRestored(true);

      const notice: ChatMessage = {
        role: "system",
        type: "info",
        content: "Previous session restored. Please reconnect to continue.",
        timestamp: new Date().toISOString(),
      };
      messagesRef.current = [...parsed, notice];
      setMessages((prev) => [...prev, notice]);
    } catch {
      // Corrupt storage — start fresh
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    ALL_SESSION_KEYS.forEach((k) => sessionStorage.removeItem(k));

    const newId = `sess_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
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
    handleNewChat,
    handleSendRef,
  };
}
