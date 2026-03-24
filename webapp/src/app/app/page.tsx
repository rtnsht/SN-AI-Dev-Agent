"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import SettingsPanel from "@/components/SettingsPanel";
import ChatWindow from "@/components/ChatWindow";
import PhaseTracker from "@/components/PhaseTracker";
import InfoModal from "@/components/InfoModal";
import WelcomeModal from "@/components/WelcomeModal";
import SignupGateModal from "@/components/SignupGateModal";
import APIKeyGateModal from "@/components/APIKeyGateModal";
import ConnectModal from "@/components/ConnectModal";
import ThemeToggle from "@/components/ThemeToggle";
import SuggestionPanel from "@/components/SuggestionPanel";
import ShareBanner from "@/components/ShareBanner";
import SharePromptModal from "@/components/SharePromptModal";
import type { ChatMessage, ConnectionResult, UsageInfo, TrialStatus, SDLCPhase, LiveStatus, AIProvider, ModelOption, FileAttachment, CategorizedPrompts, Credentials, QueuedMessage } from "@/lib/types";
import { parsePhaseGate, parseUserChoices, ANTHROPIC_MODELS, SDLC_PHASES } from "@/lib/types";
import { APP_NAME, APP_LOGO, SHOW_INFO_BUTTON, CREATOR_NAME, CREATOR_LINKEDIN, FOOTER_TAGLINE, FOOTER_COPYRIGHT, CHANGELOG_URL } from "@/lib/branding";
import { dispatch as dispatchSlashCommand, type CommandContext } from "@/lib/slash-commands";
import { useSharePrompt } from "@/hooks/useSharePrompt";
import {
  buildServiceNowAuthorizationUrl,
  createPkcePair,
  normalizeServiceNowAuthMethod,
} from "@/lib/servicenow-auth";
import Link from "next/link";
import { User, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Sparkles, MessageSquare, Info, Plus, RotateCcw, Share2 } from "lucide-react";
import FeedbackFAB from "@/components/FeedbackFAB";


/* ── Session persistence keys (sessionStorage) ──────────────── */
const SK = {
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

const ALL_SESSION_KEYS = Object.values(SK);

/** Generate a stable unique message ID */
function genMsgId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Strip heavy base64 data from messages before storing (images + file data) */
function stripHeavyData(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => ({
    ...m,
    images: m.images?.length ? m.images.map(() => "[image]") : undefined,
    files: m.files?.length
      ? m.files.map((f) => ({ ...f, data: "" }))
      : undefined,
  }));
}

/** Map raw connection errors to user-friendly messages */
function getFriendlyErrorMessage(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("oauth") || lower.includes("browser-assisted") || lower.includes("browser session") || lower.includes("popup"))
    return raw;
  if (lower.includes("enotfound"))
    return "Instance not found. Please check that the URL is correct (e.g., https://your-instance.service-now.com) and try again.";
  if (lower.includes("econnrefused"))
    return "Connection refused. The instance may be down or the URL may be incorrect. Please verify and try again.";
  if (lower.includes("etimedout") || lower.includes("econnaborted") || lower.includes("timeout"))
    return "Connection timed out. The instance may be hibernating or unreachable. Try opening it in your browser first, then reconnect.";
  if (lower.includes("econnreset") || lower.includes("socket hang up"))
    return "Connection was reset unexpectedly. Please try again.";
  if (lower.includes("sso") || lower.includes("mfa"))
    return raw;
  if (lower.includes("login page") || lower.includes("redirect"))
    return "Authentication failed. The instance redirected to a login page instead of responding to the API request. If this instance uses SSO or MFA, switch the auth method to OAuth Authorization Code or Browser Session and try again.";
  if (lower.includes("user") && lower.includes("not found"))
    return "The username was not found on this instance. Please check the username and reconnect with valid credentials.";
  if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("invalid user") || lower.includes("invalid password"))
    return "Authentication failed. Please check your username and password, then reconnect.";
  if (lower.includes("403") || lower.includes("forbidden"))
    return "Access denied. This user may not have REST API access on this instance. Please verify the user's permissions and reconnect.";
  if (lower.includes("404"))
    return "Instance API endpoint not found. Please verify the instance URL is correct and try again.";
  if (lower.includes("no roles") || lower.includes("does not have any roles"))
    return "This user does not have any roles assigned on the instance. Please assign the required roles (e.g., admin, itil) and reconnect.";
  if (lower.includes("missing required fields") || lower.includes("please provide"))
    return raw;
  if (
    lower.includes("certificate") ||
    lower.includes("ssl") ||
    lower.includes("cert") ||
    lower.includes("tls") ||
    lower.includes("x509") ||
    lower.includes("err_tls") ||
    lower.includes("altname_invalid") ||
    lower.includes("self signed")
  )
    return "SSL/certificate error. The instance may have an invalid or expired certificate. Please verify and try again.";
  if (lower.includes("networkerror") || lower.includes("network error") || lower.includes("failed to fetch"))
    return "Network error. Please check your internet connection and try again.";
  return "Connection failed. Please verify your settings and try again.";
}

function getPostBrowserSessionValidationMessage(raw: string): string {
  const friendly = getFriendlyErrorMessage(raw);
  const lower = friendly.toLowerCase();

  if (
    lower.includes("no roles") ||
    lower.includes("does not have any roles") ||
    (lower.includes("user") && lower.includes("not found"))
  ) {
    return friendly;
  }

  return `Browser sign-in completed, but the captured ServiceNow session could not be validated for API access. This instance may require OAuth Sign-In for REST API calls.\n\n${friendly}`;
}

export default function Home() {
  const [credentials, setCredentials] = useState<Credentials>({
    instanceUrl: "",
    username: "",
    password: "",
    claudeApiKey: "",
    openRouterApiKey: "",
    snAuthType: "basic",
    clientId: "",
    clientSecret: "",
    accessToken: "",
    refreshToken: "",
    sessionCookies: [],
  });
  const [connected, setConnected] = useState(false);
  const [connInfo, setConnInfo] = useState<ConnectionResult | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingLabel, setConnectingLabel] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [leftWidth, setLeftWidth] = useState(320);
  const [rightWidth, setRightWidth] = useState(374);
  const [showRelease, setShowRelease] = useState(false);
  const releaseRef = useRef<HTMLDivElement>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [changelogEntries, setChangelogEntries] = useState<{ id: string; title: string; status: string; category?: string; description?: string; created_at: string }[]>([]);
  const [currentRelease, setCurrentRelease] = useState<{ version: string; title: string; release_date: string } | null>(null);
  const isResizingLeft = useRef(false);
  const isResizingRight = useRef(false);
  const rafRef = useRef<number | null>(null);
  /** True after we auto-enter focus mode once; prevents re-entry when user exits while conditions still hold */
  const focusModeAutoTriggeredRef = useRef(false);
  const [serverApiKeyConfigured, setServerApiKeyConfigured] = useState(false);
  const [serverOpenRouterKeyConfigured, setServerOpenRouterKeyConfigured] = useState(false);
  const [serverSnCredsConfigured, setServerSnCredsConfigured] = useState(false);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [rateLimitHit, setRateLimitHit] = useState(false);
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  // Pending retry — stores the failed message so it can be auto-retried after user provides an API key
  const [pendingRetry, setPendingRetry] = useState<{ text: string; images?: string[]; files?: FileAttachment[] } | null>(null);
  // Message queue — stores messages typed while AI is processing, drained sequentially when AI finishes
  const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([]);
  // AI Provider selection
  const [aiProvider, setAiProvider] = useState<AIProvider>("anthropic");
  // Model selection — locked after first message sent
  const [selectedModel, setSelectedModel] = useState<string>("sonnet-4");
  const [modelLocked, setModelLocked] = useState(false);
  // OpenRouter models
  const [openRouterModels, setOpenRouterModels] = useState<ModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  // SDLC phase tracking
  const [activeReqId, setActiveReqId] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<SDLCPhase | null>(null);
  const [completedPhases, setCompletedPhases] = useState<SDLCPhase[]>([]);
  // SDD (Spec-Driven Development) mode — when active, enforces phase gates
  const [sddMode, setSddMode] = useState(false);
  // Tool execution detail visibility (from env via /api/config)
  const [showToolDetails, setShowToolDetails] = useState(true);
  // Whether users are allowed to provide their own Claude API key
  const [allowUserApiKeys, setAllowUserApiKeys] = useState(true);
  // Info modal
  const [showInfo, setShowInfo] = useState(false);
  // Welcome modal (first-time user experience)
  const [showWelcome, setShowWelcome] = useState(false);
  // Gate modals (3-tier access system)
  const [showSignupGate, setShowSignupGate] = useState(false);
  const [showApiKeyGate, setShowApiKeyGate] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [gateInfo, setGateInfo] = useState<{ dailyUsed: number; dailyLimit: number; authDailyLimit: number }>({ dailyUsed: 0, dailyLimit: 10, authDailyLimit: 20 });
  // Whether current user is authenticated (set from /api/config)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // Live status streaming (controlled via NEXT_PUBLIC_SHOW_LIVE_STATUS env)
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);
  const [streamingEnabled, setStreamingEnabled] = useState(true);
  // Agent activity log — accumulates liveStatus messages for streaming display
  const [activityLog, setActivityLog] = useState<{ message: string; phase: string; timestamp: number; toolName?: string; toolInput?: Record<string, unknown>; done?: boolean; taskId?: number; taskName?: string }[]>([]);
  // Task planner state — structured plan for current request
  const [taskPlan, setTaskPlan] = useState<{ analysis: string; tasks: { id: number; name: string; type: string; tools: { name: string; args: Record<string, unknown> }[] }[] } | null>(null);
  // Dynamic categorized prompts from instance data (all 4 tabs)
  const [categorizedPrompts, setCategorizedPrompts] = useState<CategorizedPrompts | null>(null);
  const [promptsRefreshing, setPromptsRefreshing] = useState(false);
  const [promptsLastRefreshed, setPromptsLastRefreshed] = useState<number | null>(null);
  const [seenSuggestionHashes, setSeenSuggestionHashes] = useState<string[]>([]);
  // Mobile two-step flow: 'hero' = landing page, 'connect' = full-screen connection panel
  const [mobileStep, setMobileStep] = useState<"hero" | "connect">("hero");
  // Logged-in webapp user info (name, role) from /api/auth/me
  const [appUser, setAppUser] = useState<{ name: string; email: string; role: string } | null>(null);
  // Profile dropdown
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  // Sign-in modal (when user is not authenticated)
  const [showSignInModal, setShowSignInModal] = useState(false);
  // Persistent session ID for logging — survives refresh via sessionStorage
  const [clientSessionId, setClientSessionId] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(SK.SESSION_ID);
      if (saved) return saved;
    }
    const id = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    if (typeof window !== "undefined") sessionStorage.setItem(SK.SESSION_ID, id);
    return id;
  });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Ref to always access the latest handleSend (avoids stale closure in handleApprove setTimeout)
  const handleSendRef = useRef<(text: string, images?: string[], files?: FileAttachment[], hidden?: boolean) => void>(() => {});
  // Ref to always have access to the latest messages (avoids race conditions with React batching)
  const messagesRef = useRef<ChatMessage[]>([]);
  // Avoid duplicate /api/session-start posts for the same clientSessionId
  const trackedSessionStartIdRef = useRef<string | null>(null);

  // Keep messagesRef in sync with messages state (for use in callbacks that need latest messages)
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const {
    showBanner: showShareBanner,
    showModal: showShareModal,
    showPanelLink: showSharePanelLink,
    sessionStats: shareSessionStats,
    generatedCards: shareGeneratedCards,
    shareImageLoading,
    markConnected: markShareConnected,
    markDisconnected: markShareDisconnected,
    openModalFromBanner: openShareModalFromBanner,
    openModalFromPanel: openShareModalFromPanel,
    dismissBanner: dismissShareBanner,
    closeModal: closeShareModal,
    onShared: onSharePromptShared,
    resetSession: resetSharePromptSession,
  } = useSharePrompt({
    connected,
    clientSessionId,
    messages,
    connectionError,
    rateLimitHit,
    pendingRetry,
    completedPhases,
    activityLog,
  });

  // Clear connection error when user edits credentials
  useEffect(() => {
    setConnectionError(null);
  }, [
    credentials.instanceUrl,
    credentials.username,
    credentials.password,
    credentials.snAuthType,
    credentials.clientId,
    credentials.clientSecret,
  ]);

  // Accumulate liveStatus changes into the activity log (skip tool events — handled directly in stream parser)
  useEffect(() => {
    if (liveStatus && liveStatus.phase !== "tool") {
      setActivityLog((prev) => {
        // Avoid duplicate consecutive messages
        if (prev.length > 0 && prev[prev.length - 1].message === liveStatus.message) return prev;
        const entry = { message: liveStatus.message, phase: liveStatus.phase, timestamp: Date.now() };
        // Keep last 100 entries to avoid unbounded growth
        const updated = [...prev, entry];
        return updated.length > 100 ? updated.slice(-100) : updated;
      });
    }
  }, [liveStatus]);

  // ── beforeunload warning — prevent accidental data loss ──
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (messages.length > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [messages.length]);

  // ── Finalize session on page unload (best-effort via sendBeacon) ──
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

  // ── Restore session from sessionStorage on mount ──
  const [sessionRestored, setSessionRestored] = useState(false);
  useEffect(() => {
    try {
      const savedMessages = sessionStorage.getItem(SK.MESSAGES);
      if (!savedMessages) return;
      const parsed: ChatMessage[] = JSON.parse(savedMessages);
      if (!Array.isArray(parsed) || parsed.length === 0) return;

      // Restore messages
      messagesRef.current = parsed;
      setMessages(parsed);

      // Restore connection metadata (not connected — user must re-auth)
      const savedConnInfo = sessionStorage.getItem(SK.CONN_INFO);
      if (savedConnInfo) setConnInfo(JSON.parse(savedConnInfo));

      // Restore credentials (instanceUrl + username only)
      const savedCreds = sessionStorage.getItem(SK.CREDS);
      if (savedCreds) {
        const { instanceUrl, username, snAuthType, clientId } = JSON.parse(savedCreds);
        setCredentials((prev) => ({
          ...prev,
          instanceUrl: instanceUrl || prev.instanceUrl,
          username: username || prev.username,
          snAuthType: snAuthType || prev.snAuthType,
          clientId: clientId || prev.clientId,
        }));
      }

      // Restore model/provider (but NOT modelLocked — let user change before reconnecting)
      const savedProvider = sessionStorage.getItem(SK.PROVIDER);
      if (savedProvider) setAiProvider(savedProvider as AIProvider);
      const savedModel = sessionStorage.getItem(SK.MODEL);
      if (savedModel) setSelectedModel(savedModel);

      // Restore SDLC phases
      const savedReqId = sessionStorage.getItem(SK.REQ_ID);
      if (savedReqId) setActiveReqId(savedReqId);
      const savedPhase = sessionStorage.getItem(SK.PHASE);
      if (savedPhase) setCurrentPhase(savedPhase as SDLCPhase);
      const savedCompleted = sessionStorage.getItem(SK.COMPLETED_PHASES);
      if (savedCompleted) setCompletedPhases(JSON.parse(savedCompleted));
      const savedSddMode = sessionStorage.getItem(SK.SDD_MODE);
      if (savedSddMode === "true") setSddMode(true);

      // Restore cached suggestions
      const savedPrompts = sessionStorage.getItem(SK.CATEGORIZED_PROMPTS);
      if (savedPrompts) {
        try { setCategorizedPrompts(JSON.parse(savedPrompts)); } catch { /* corrupt */ }
      }
      const savedSeen = sessionStorage.getItem(SK.SEEN_SUGGESTIONS);
      if (savedSeen) {
        try { setSeenSuggestionHashes(JSON.parse(savedSeen)); } catch { /* corrupt */ }
      }

      // Show settings panel so user can re-enter password
      setShowSettings(true);
      setSessionRestored(true);

      // Inject a restore notice
      const notice: ChatMessage = {
        id: genMsgId(),
        role: "system",
        type: "info",
        content: "Previous session restored. Please reconnect to continue.",
        timestamp: new Date().toISOString(),
      };
      messagesRef.current = [...parsed, notice];
      setMessages((prev) => [...prev, notice]);
    } catch {
      // Corrupt storage — ignore and start fresh
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Focus Mode: auto-collapse sidebars when deep in conversation (one-shot auto-enter only) ──
  useEffect(() => {
    if (focusModeAutoTriggeredRef.current) return;
    const msgCount = messages.filter((m) => m.role !== "system").length;
    if (connected && msgCount >= 10 && currentPhase === "implementation") {
      focusModeAutoTriggeredRef.current = true;
      setFocusMode(true);
      setShowSettings(false);
      setShowRightPanel(false);
    }
  }, [messages, connected, currentPhase]);

  // ── Welcome modal for first-time users ──
  useEffect(() => {
    if (!localStorage.getItem("sn-welcome-dismissed")) {
      setShowWelcome(true);
    }
  }, []);

  const dismissWelcome = useCallback(() => {
    setShowWelcome(false);
    localStorage.setItem("sn-welcome-dismissed", "true");
  }, []);

  const refreshAppUser = useCallback(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setAppUser(data && data.email ? data : null))
      .catch(() => setAppUser(null));
  }, []);

  // ── Fetch trial status ──
  useEffect(() => {
    fetch("/api/trial-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setTrialStatus(data); })
      .catch(() => {});
  }, []);

  // ── Fetch logged-in webapp user info only for authenticated users ──
  useEffect(() => {
    if (!isAuthenticated) {
      setAppUser(null);
      return;
    }
    refreshAppUser();
  }, [isAuthenticated, refreshAppUser]);

  // ── Persist state to sessionStorage on change ──
  useEffect(() => {
    try { sessionStorage.setItem(SK.MESSAGES, JSON.stringify(stripHeavyData(messages))); } catch { /* quota */ }
  }, [messages]);
  useEffect(() => {
    try { if (connInfo) sessionStorage.setItem(SK.CONN_INFO, JSON.stringify(connInfo)); } catch { /* quota */ }
  }, [connInfo]);
  useEffect(() => {
    try {
      sessionStorage.setItem(SK.CREDS, JSON.stringify({
        instanceUrl: credentials.instanceUrl,
        username: credentials.username,
        snAuthType: credentials.snAuthType,
        clientId: credentials.clientId,
      }));
    } catch { /* quota */ }
  }, [credentials.instanceUrl, credentials.username, credentials.snAuthType, credentials.clientId]);
  useEffect(() => { try { sessionStorage.setItem(SK.PROVIDER, aiProvider); } catch { /* quota */ } }, [aiProvider]);
  useEffect(() => { try { sessionStorage.setItem(SK.MODEL, selectedModel); } catch { /* quota */ } }, [selectedModel]);
  useEffect(() => { try { sessionStorage.setItem(SK.MODEL_LOCKED, String(modelLocked)); } catch { /* quota */ } }, [modelLocked]);
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

  // Close profile dropdown on outside click or Escape
  useEffect(() => {
    if (!profileOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setProfileOpen(false); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleKey); };
  }, [profileOpen]);

  useEffect(() => {
    if (!showRelease) return;
    fetch("/api/changelog")
      .then((r) => (r.ok ? r.json() : { currentRelease: null, entries: [] }))
      .then((d) => {
        setChangelogEntries(Array.isArray(d.entries) ? d.entries : []);
        setCurrentRelease(d.currentRelease ?? null);
      })
      .catch(() => { setChangelogEntries([]); setCurrentRelease(null); });
    const handleClick = (e: MouseEvent) => {
      if (releaseRef.current && !releaseRef.current.contains(e.target as Node)) setShowRelease(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowRelease(false); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleKey); };
  }, [showRelease]);

  // Fetch server config on mount (API key + SN credentials)
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        setServerApiKeyConfigured(!!data.serverApiKeyConfigured);
        setServerOpenRouterKeyConfigured(!!data.serverOpenRouterKeyConfigured);

        // 3-tier access info
        if (typeof data.isAuthenticated === "boolean") setIsAuthenticated(data.isAuthenticated);
        if (data.accessStatus) {
          setGateInfo((prev) => ({
            ...prev,
            dailyUsed: data.accessStatus.dailyUsed ?? prev.dailyUsed,
            dailyLimit: data.accessStatus.dailyLimit ?? prev.dailyLimit,
          }));
        }
        if (data.tierLimits) {
          setGateInfo((prev) => ({
            ...prev,
            authDailyLimit: data.tierLimits.authDailyLimit ?? prev.authDailyLimit,
          }));
        }

        // Tool detail visibility
        if (typeof data.showToolDetails === "boolean") setShowToolDetails(data.showToolDetails);
        // Live status visibility (what the agent is doing)
        if (typeof data.showLiveStatus === "boolean") setStreamingEnabled(data.showLiveStatus);
        // User API key control
        if (typeof data.allowUserApiKeys === "boolean") setAllowUserApiKeys(data.allowUserApiKeys);

        // Seed usage display from access status when server API keys are in use
        if (data.accessStatus && (data.serverApiKeyConfigured || data.serverOpenRouterKeyConfigured)) {
          const dailyUsed = data.accessStatus.dailyUsed ?? 0;
          const dailyLimit = data.accessStatus.dailyLimit ?? 0;
          if (dailyLimit > 0) {
            setUsage({
              used: dailyUsed,
              max: dailyLimit,
              remaining: Math.max(0, dailyLimit - dailyUsed),
              resetsAt: null,
              windowHours: 24,
              anonUsed: data.accessStatus.anonUsed ?? 0,
              authUsed: data.accessStatus.authUsed ?? 0,
              isAuthenticated: !!data.isAuthenticated,
            });
          }
        }

        // Pre-populate ServiceNow credentials if server-provided
        if (data.serverSnCredsConfigured && data.serverSnCredentials) {
          setServerSnCredsConfigured(true);
          setCredentials((prev) => ({
            ...prev,
            instanceUrl: data.serverSnCredentials.instanceUrl || prev.instanceUrl,
            username: data.serverSnCredentials.username || prev.username,
            // Password stays empty — API routes fall back to env var
          }));
        }
      })
      .catch(() => {}); // ignore — default to false
  }, []);

  // Sync usage bar from 429 error response data
  const syncUsageFrom429 = useCallback((errorData: { dailyUsed?: number; dailyLimit?: number; anonUsed?: number; authUsed?: number }) => {
    const dailyUsed = errorData.dailyUsed ?? 0;
    const dailyLimit = errorData.dailyLimit ?? 0;
    if (dailyLimit > 0) {
      setUsage((prev) => ({
        used: dailyUsed,
        max: dailyLimit,
        remaining: Math.max(0, dailyLimit - dailyUsed),
        resetsAt: prev?.resetsAt ?? null,
        windowHours: prev?.windowHours ?? 24,
        anonUsed: errorData.anonUsed ?? prev?.anonUsed ?? 0,
        authUsed: errorData.authUsed ?? prev?.authUsed ?? 0,
        isAuthenticated: prev?.isAuthenticated,
      }));
    }
  }, []);

  // Refresh usage counts from the server (called by refresh icon in SettingsPanel)
  const refreshUsage = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (credentials.instanceUrl) params.set("instanceUrl", credentials.instanceUrl);
      const res = await fetch(`/api/trial-status?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      const dailyUsed = data.dailyUsed ?? 0;
      const dailyLimit = data.dailyLimit ?? 0;
      if (dailyLimit > 0) {
        setUsage({
          used: dailyUsed,
          max: dailyLimit,
          remaining: Math.max(0, dailyLimit - dailyUsed),
          resetsAt: null,
          windowHours: 24,
          anonUsed: data.anonUsed ?? 0,
          authUsed: data.authUsed ?? 0,
          isAuthenticated: !!data.isAuthenticated,
        });
      }
    } catch { /* non-fatal */ }
  }, [credentials.instanceUrl]);

  // Fetch OpenRouter models when provider changes to openrouter
  useEffect(() => {
    if (aiProvider !== "openrouter") return;
    if (openRouterModels.length > 0) return; // Already loaded

    const fetchModels = async () => {
      setModelsLoading(true);
      try {
        const headers: HeadersInit = {};
        if (credentials.openRouterApiKey) {
          headers["x-openrouter-key"] = credentials.openRouterApiKey;
        }
        const res = await fetch("/api/openrouter-models", { headers });
        if (res.ok) {
          const data = await res.json();
          // Convert to ModelOption format
          const models: ModelOption[] = data.models.map((m: { id: string; name: string; summary?: string; contextLength?: number }) => ({
            key: m.id,
            label: m.name,
            modelId: m.id,
            description: m.summary || `${Math.round((m.contextLength || 0) / 1000)}K context`,
            provider: "openrouter" as const,
          }));
          setOpenRouterModels(models);
          // Select first model if none selected for openrouter
          if (models.length > 0 && !models.find(m => m.key === selectedModel)) {
            setSelectedModel(models[0].key);
          }
        }
      } catch (err) {
        console.error("Failed to fetch OpenRouter models:", err);
      } finally {
        setModelsLoading(false);
      }
    };

    fetchModels();
  }, [aiProvider, credentials.openRouterApiKey, openRouterModels.length, selectedModel]);

  // Reset model selection when switching providers (preserves valid restored/user-selected models)
  useEffect(() => {
    if (modelLocked) return;
    if (aiProvider === "anthropic") {
      setSelectedModel(prev => {
        if (ANTHROPIC_MODELS.some(m => m.key === prev)) return prev;
        return "sonnet-4";
      });
    } else if (aiProvider === "openrouter" && openRouterModels.length > 0) {
      setSelectedModel(prev => {
        if (openRouterModels.some(m => m.key === prev)) return prev;
        const claudeModel = openRouterModels.find(m => m.key.includes("claude"));
        return claudeModel?.key || openRouterModels[0].key;
      });
    }
  }, [aiProvider, modelLocked, openRouterModels]);

  const completeAuthorizationCodeSignIn = useCallback(async (): Promise<Credentials> => {
    const instanceUrl = credentials.instanceUrl.trim();
    const clientId = credentials.clientId?.trim() || "";

    if (!instanceUrl || !clientId) {
      throw new Error("OAuth Authorization Code requires the instance URL and client ID.");
    }

    const redirectUri = `${window.location.origin}/sn-oauth/callback`;
    const { verifier, challenge } = await createPkcePair();
    const state = `sn_oauth_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const authUrl = buildServiceNowAuthorizationUrl({
      instanceUrl,
      clientId,
      redirectUri,
      state,
      codeChallenge: challenge,
    });

    const popup = window.open(authUrl, "sn-oauth-login", "width=560,height=760,resizable,scrollbars");
    if (!popup) {
      throw new Error("The ServiceNow OAuth sign-in popup was blocked. Allow popups and try again.");
    }

    const authCode = await new Promise<string>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("Timed out waiting for ServiceNow OAuth sign-in."));
      }, 180000);

      const closedCheck = window.setInterval(() => {
        if (popup.closed) {
          cleanup();
          reject(new Error("The ServiceNow OAuth sign-in window was closed before completing sign-in."));
        }
      }, 500);

      const onMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) {
          return;
        }

        const data = event.data as {
          type?: string;
          state?: string | null;
          code?: string | null;
          error?: string | null;
          errorDescription?: string | null;
        };

        if (data.type !== "sn-oauth-callback") {
          return;
        }

        if (data.state !== state) {
          cleanup();
          reject(new Error("The ServiceNow OAuth callback state did not match the active sign-in attempt."));
          return;
        }

        if (data.error) {
          cleanup();
          reject(new Error(data.errorDescription || data.error));
          return;
        }

        if (!data.code) {
          cleanup();
          reject(new Error("ServiceNow OAuth sign-in completed without an authorization code."));
          return;
        }

        cleanup();
        resolve(data.code);
      };

      const cleanup = () => {
        window.clearTimeout(timeout);
        window.clearInterval(closedCheck);
        window.removeEventListener("message", onMessage);
        popup.close();
      };

      window.addEventListener("message", onMessage);
    });

    const exchangeResponse = await fetch("/api/sn-oauth/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instanceUrl,
        clientId,
        clientSecret: credentials.clientSecret,
        code: authCode,
        codeVerifier: verifier,
        redirectUri,
      }),
    });

    const exchangeData = await exchangeResponse.json().catch(() => ({ success: false, message: "OAuth exchange failed." }));
    if (!exchangeResponse.ok || !exchangeData.success || !exchangeData.accessToken) {
      throw new Error(exchangeData.message || "ServiceNow OAuth exchange failed.");
    }

    const nextCredentials: Credentials = {
      ...credentials,
      snAuthType: "oauth_authorization_code",
      accessToken: exchangeData.accessToken,
      refreshToken: exchangeData.refreshToken || "",
    };

    setCredentials(nextCredentials);
    return nextCredentials;
  }, [credentials]);

  const completeBrowserSessionSignIn = useCallback(async (): Promise<Credentials> => {
    try {
      const response = await fetch("/api/browser-session-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceUrl: credentials.instanceUrl,
          username: credentials.username,
          password: credentials.password,
        }),
      });
      const data = await response.json().catch(() => ({ success: false, message: "Browser-assisted sign-in failed." }));
      if (!response.ok || !data.success || !Array.isArray(data.sessionCookies) || data.sessionCookies.length === 0) {
        throw new Error(data.message || "Browser-assisted sign-in failed.");
      }

      const nextCredentials: Credentials = {
        ...credentials,
        snAuthType: "session",
        sessionCookies: data.sessionCookies,
        sessionToken: data.sessionToken || "",
        accessToken: "",
        refreshToken: "",
      };

      setCredentials(nextCredentials);

      // Attach the browser-proxied validation result if the server ran it.
      // This lets handleConnect skip the separate /api/test-connection call.
      if (data.validationResult) {
        (nextCredentials as Credentials & { _browserValidation?: unknown })._browserValidation = data.validationResult;
      }

      return nextCredentials;
    } catch (error) {
      throw error;
    }
  }, [credentials]);

  const startTrackedSession = useCallback((sessionId: string, sessionCredentials: Credentials, connectionData: ConnectionResult) => {
    fetch("/api/session-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        instanceUrl: sessionCredentials.instanceUrl,
        username: sessionCredentials.username,
        userFullName: connectionData.userInfo?.name || "",
        model: (aiProvider === "openrouter" ? openRouterModels : ANTHROPIC_MODELS)
          .find((m) => m.key === selectedModel)?.modelId || selectedModel,
        aiProvider,
        hasAdmin: connectionData.hasAdmin,
        hasSecurityAdmin: connectionData.hasSecurityAdmin,
        authType: sessionCredentials.snAuthType,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          console.warn("[session-start] non-OK:", res.status, errText.slice(0, 200));
        }
      })
      .catch((err) => { console.warn("[session-start] failed:", err); });
  }, [aiProvider, openRouterModels, selectedModel]);

  // Log a session row in Supabase for each browser chat session id (incl. New Chat), without double-posting on reconnect churn.
  useEffect(() => {
    if (!connected || !connInfo || !clientSessionId) return;
    if (trackedSessionStartIdRef.current === clientSessionId) return;
    trackedSessionStartIdRef.current = clientSessionId;
    startTrackedSession(clientSessionId, credentials, connInfo);
  }, [connected, connInfo, clientSessionId, credentials, startTrackedSession]);

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    setConnectingLabel("Connecting...");
    setConnectionError(null);
    let browserSessionBootstrapped = false;
    try {
      const authType = normalizeServiceNowAuthMethod(credentials.snAuthType);
      let effectiveCredentials: Credentials = { ...credentials, snAuthType: authType };
      browserSessionBootstrapped = authType === "session" && Array.isArray(effectiveCredentials.sessionCookies) && effectiveCredentials.sessionCookies.length > 0;

      if (authType === "oauth_authorization_code" && !effectiveCredentials.accessToken) {
        effectiveCredentials = await completeAuthorizationCodeSignIn();
      } else if (authType === "session" && (!effectiveCredentials.sessionCookies || effectiveCredentials.sessionCookies.length === 0)) {
        setConnectingLabel("Waiting for browser sign-in...");
        effectiveCredentials = await completeBrowserSessionSignIn();
        browserSessionBootstrapped = true;
      }

      setConnectingLabel(authType === "session" ? "Validating ServiceNow session..." : "Connecting...");

      // If browser-proxied validation already ran inside the Playwright browser,
      // use that result directly instead of calling /api/test-connection (which
      // would fail because ServiceNow sessions are bound to the browser process).
      const browserValidation = (effectiveCredentials as Credentials & { _browserValidation?: ConnectionResult })._browserValidation;
      let data: ConnectionResult;

      if (browserSessionBootstrapped && browserValidation && browserValidation.success) {
        data = {
          ...browserValidation,
          message: browserValidation.message || `Connected to ${effectiveCredentials.instanceUrl}`,
          authType: "session",
        };
      } else {
        const res = await fetch("/api/test-connection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instanceUrl: effectiveCredentials.instanceUrl,
            username: effectiveCredentials.username,
            password: effectiveCredentials.password,
            snAuthType: effectiveCredentials.snAuthType,
            clientId: effectiveCredentials.clientId,
            clientSecret: effectiveCredentials.clientSecret,
            accessToken: effectiveCredentials.accessToken,
            refreshToken: effectiveCredentials.refreshToken,
            sessionCookies: effectiveCredentials.sessionCookies,
            sessionToken: effectiveCredentials.sessionToken,
          }),
        });

        // Handle HTTP-level errors (e.g., 400, 500) before parsing JSON
        if (!res.ok) {
          let errorData: { message?: string } | null = null;
          try { errorData = await res.json(); } catch { /* response may not be JSON */ }
          const rawMsg = errorData?.message || `Server returned status ${res.status}`;
          const friendly = browserSessionBootstrapped
            ? getPostBrowserSessionValidationMessage(rawMsg)
            : getFriendlyErrorMessage(rawMsg);
          setConnectionError(friendly);
          const errMsgs = [...messagesRef.current, { id: genMsgId(), role: "system" as const, type: "error" as const, content: `Connection failed: ${friendly}`, timestamp: new Date().toISOString() }];
          messagesRef.current = errMsgs;
          setMessages(errMsgs);
          setIsConnecting(false);
          return;
        }

        data = await res.json();
      }

      // Handle no-roles: block connection and show error with reconnect guidance
      if (data.success && data.noRoles) {
        const noRolesMsg = "This user does not have any roles assigned on this instance. Please assign the required roles (e.g., admin, itil) and reconnect.";
        setConnectionError(noRolesMsg);
        const errMsgs = [...messagesRef.current, { id: genMsgId(), role: "system" as const, type: "error" as const, content: `Connection failed: ${noRolesMsg}`, timestamp: new Date().toISOString() }];
        messagesRef.current = errMsgs;
        setMessages(errMsgs);
        setIsConnecting(false);
        return;
      }

      if (data.success) {
        setCredentials(effectiveCredentials);
        setConnected(true);
        setConnInfo(data);
        setShowSettings(false);
        setMobileStep("hero"); // dismiss mobile full-screen connection panel
        markShareConnected();

        // Inject system messages into chat
        const sysMsgs: ChatMessage[] = [];

        const instanceShort = effectiveCredentials.instanceUrl.replace(/https?:\/\//, "").replace(/\/$/, "");
        sysMsgs.push({
          id: genMsgId(),
          role: "system",
          type: "success",
          content: `Connected to **${instanceShort}** as **${data.userInfo?.name || effectiveCredentials.username || "authenticated user"}**`,
          timestamp: new Date().toISOString(),
        });

        // Role check
        if (!data.hasAdmin && !data.hasSecurityAdmin) {
          sysMsgs.push({
            id: genMsgId(),
            role: "system",
            type: "warning",
            content: `⚠️ **Limited Access** — User \`${effectiveCredentials.username || "authenticated user"}\` does not have \`admin\` or \`security_admin\` roles. The agent will only be able to advise and operate based on the access this user has. Some operations (creating business rules, ACLs, modifying system tables) may fail due to insufficient permissions.`,
            timestamp: new Date().toISOString(),
          });
        } else if (!data.hasAdmin) {
          sysMsgs.push({
            id: genMsgId(),
            role: "system",
            type: "warning",
            content: `⚠️ **Partial Access** — User \`${effectiveCredentials.username || "authenticated user"}\` has \`security_admin\` but not \`admin\` role. Some configuration operations may be restricted.`,
            timestamp: new Date().toISOString(),
          });
        } else if (!data.hasSecurityAdmin) {
          sysMsgs.push({
            id: genMsgId(),
            role: "system",
            type: "info",
            content: `ℹ️ User \`${effectiveCredentials.username || "authenticated user"}\` has \`admin\` but not \`security_admin\` role. ACL and security policy modifications may require elevated privileges.`,
            timestamp: new Date().toISOString(),
          });
        } else {
          sysMsgs.push({
            id: genMsgId(),
            role: "system",
            type: "success",
            content: `✅ Full access — User has both \`admin\` and \`security_admin\` roles.`,
            timestamp: new Date().toISOString(),
          });
        }

        const newMsgs = [...messagesRef.current, ...sysMsgs];
        messagesRef.current = newMsgs;
        setMessages(newMsgs);
        setTimeout(() => inputRef.current?.focus(), 100);

        // Fetch categorized instance prompts in background (non-blocking)
        const userContext = data.userInfo?.sysId
          ? {
              sysId: data.userInfo.sysId,
              roles: data.roles || [],
              assignmentGroups: data.userInfo.assignmentGroups || [],
            }
          : undefined;
        fetchCategorizedPromptsFromApi(effectiveCredentials, userContext);
      } else {
        const rawMsg = data.message || "Unknown error";
        const friendly = browserSessionBootstrapped
          ? getPostBrowserSessionValidationMessage(rawMsg)
          : getFriendlyErrorMessage(rawMsg);
        setConnectionError(friendly);
        const errMsgs = [...messagesRef.current, { id: genMsgId(), role: "system" as const, type: "error" as const, content: `Connection failed: ${friendly}`, timestamp: new Date().toISOString() }];
        messagesRef.current = errMsgs;
        setMessages(errMsgs);
      }
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const friendly = browserSessionBootstrapped
        ? getPostBrowserSessionValidationMessage(rawMsg)
        : getFriendlyErrorMessage(rawMsg);
      setConnectionError(friendly);
      const errMsgs = [...messagesRef.current, { id: genMsgId(), role: "system" as const, type: "error" as const, content: `Connection failed: ${friendly}`, timestamp: new Date().toISOString() }];
      messagesRef.current = errMsgs;
      setMessages(errMsgs);
    } finally {
      setIsConnecting(false);
      setConnectingLabel(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchCategorizedPromptsFromApi is stable ([] deps) but declared after this hook
  }, [credentials, clientSessionId, aiProvider, openRouterModels, selectedModel, completeAuthorizationCodeSignIn, completeBrowserSessionSignIn, markShareConnected]);

  const handleSend = useCallback(
    async (text: string, images?: string[], files?: FileAttachment[], hidden?: boolean) => {
      if (!text.trim() && (!images || images.length === 0) && (!files || files.length === 0)) return;

      // Queue message if AI is currently processing (unless it's an internal auto-resume)
      if (isLoading && !hidden) {
        const queuedMsg: QueuedMessage = { id: genMsgId(), text, images, files, timestamp: new Date().toISOString() };
        setMessageQueue(prev => [...prev, queuedMsg]);
        const displayMsg: ChatMessage = {
          id: queuedMsg.id,
          role: "user",
          content: text,
          queued: true,
          timestamp: queuedMsg.timestamp,
          ...(images?.length ? { images } : {}),
          ...(files?.length ? { files } : {}),
        };
        const updated = [...messagesRef.current, displayMsg];
        messagesRef.current = updated;
        setMessages(updated);
        return;
      }

      // Slash command dispatch — intercept before sending to API
      if (text.trim().startsWith("/") && !hidden) {
        const cmdCtx: CommandContext = {
          currentPhase,
          sddMode,
          connected,
          sessionId: clientSessionId,
          activeReqId,
          assistantMessageCount: messagesRef.current.filter(m => m.role === "assistant" && !m.hidden).length,
          completedPhases,
        };
        const result = dispatchSlashCommand(text.trim(), cmdCtx);
        if (result.type === "state_update") {
          const u = result.updates;
          if (u.sddMode !== undefined) setSddMode(u.sddMode);
          if (u.currentPhase !== undefined) setCurrentPhase(u.currentPhase);
          if (u.completedPhases !== undefined) setCompletedPhases(u.completedPhases);
          const label = u.sddMode ? "SDD mode activated. Phase gates are now enforced." : "Freeform mode. Phase gates disabled.";
          const sysMsg: ChatMessage = { id: genMsgId(), role: "system", type: u.sddMode ? "success" : "info", content: label, timestamp: new Date().toISOString() };
          const updated = [...messagesRef.current, sysMsg];
          messagesRef.current = updated;
          setMessages(updated);
          return;
        }
        if (result.type === "system_message") {
          const sysMsg: ChatMessage = { id: genMsgId(), role: "system", type: result.messageType === "warning" ? "warning" : result.messageType === "success" ? "success" : "info", content: result.content, timestamp: new Date().toISOString() };
          const updated = [...messagesRef.current, sysMsg];
          messagesRef.current = updated;
          setMessages(updated);
          return;
        }
        if (result.type === "action") {
          if (result.action === "new_chat") handleNewChat();
          if (result.action === "open_share_modal") openShareModalFromPanel();
          return;
        }
        // "passthrough" — not a recognized command, send as normal message
      }

      // Clear any pending retry — user is sending a new/retried message
      if (pendingRetry) setPendingRetry(null);

      const userMsg: ChatMessage = {
        id: genMsgId(),
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
        ...(images?.length ? { images } : {}),
        ...(files?.length ? { files } : {}),
        ...(hidden ? { hidden: true } : {}),
      };

      // Build new messages array from the ref (always has latest due to useEffect sync)
      // This avoids race conditions with React's state batching
      const newMessages = [...messagesRef.current, userMsg];

      // Update state and ref together
      setMessages(newMessages);
      messagesRef.current = newMessages;

      setIsLoading(true);
      setActivityLog([]);
      setTaskPlan(null);
      // Lock model selection after first message
      if (!modelLocked) setModelLocked(true);

      try {
        // Only send user/assistant messages to the API (not system messages)
        const apiMessages = newMessages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role,
            content: m.content,
            ...(m.timestamp ? { timestamp: m.timestamp } : {}),
            ...(m.images?.length ? { images: m.images } : {}),
            ...(m.files?.length ? { files: m.files } : {}),
          }));

        // Safety check: ensure we have messages to send
        if (apiMessages.length === 0) {
          console.error("[handleSend] No user/assistant messages to send. Messages:", newMessages);
          setMessages((prev) => [...prev, { id: genMsgId(), role: "system", type: "error", content: "Internal error: No messages to send. Please try again.", timestamp: new Date().toISOString() }]);
          setIsLoading(false);
          return;
        }

        // Create an AbortController so the user can cancel
        const controller = new AbortController();
        abortRef.current = controller;

        // Get the model ID based on provider
        const currentModels = aiProvider === "openrouter" ? openRouterModels : ANTHROPIC_MODELS;
        const modelId = currentModels.find((m) => m.key === selectedModel)?.modelId || selectedModel;

        // Use streaming API when enabled for live status updates
        if (streamingEnabled) {
          setLiveStatus({ message: "Analyzing your request...", phase: "thinking" });

          const res = await fetch("/api/chat-stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credentials, messages: apiMessages, model: modelId, aiProvider, sessionId: clientSessionId, phase: currentPhase, sddMode }),
            signal: controller.signal,
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
            setLiveStatus(null);

            if (res.status === 429) {
              syncUsageFrom429(errorData);
              if (errorData.error === "signup_required") {
                // Anonymous user hit daily limit — show signup gate
                setPendingRetry({ text, images, files });
                setGateInfo((prev) => ({
                  ...prev,
                  dailyUsed: errorData.dailyUsed ?? prev.dailyUsed,
                  dailyLimit: errorData.dailyLimit ?? prev.dailyLimit,
                }));
                setShowSignupGate(true);
                setMessages((prev) => [
                  ...prev,
                  { id: genMsgId(), role: "system", type: "error", content: errorData.message || "Free request limit reached. Sign up to continue.", timestamp: new Date().toISOString() },
                ]);
              } else if (errorData.error === "apikey_required") {
                // Authenticated user hit daily limit — show API key gate
                setPendingRetry({ text, images, files });
                setGateInfo((prev) => ({
                  ...prev,
                  dailyUsed: errorData.dailyUsed ?? prev.dailyUsed,
                  dailyLimit: errorData.dailyLimit ?? prev.dailyLimit,
                }));
                setShowApiKeyGate(true);
                setMessages((prev) => [
                  ...prev,
                  { id: genMsgId(), role: "system", type: "error", content: errorData.message || "Daily limit reached. Add your API key to continue.", timestamp: new Date().toISOString() },
                ]);
              } else if (errorData.error === "anthropic_rate_limit" || errorData.code === "provider_rate_limit" || errorData.code === "provider_billing" || errorData.code === "provider_auth") {
                const isServerKey = errorData.usedServerKey !== false;
                if (allowUserApiKeys && isServerKey) {
                  setPendingRetry({ text, images, files });
                  setProviderError(errorData.code || errorData.error);
                  setShowApiKeyGate(true);
                }
                setMessages((prev) => [
                  ...prev,
                  {
                    id: genMsgId(),
                    role: "system",
                    type: "error",
                    content: (allowUserApiKeys && isServerKey)
                      ? `**Shared key limit hit** -- The app's server key is temporarily limited. Switch to BYOK (Bring Your Own Key) to continue.`
                      : errorData.code === "provider_auth"
                        ? `**API key error** -- Check your API key in Settings.`
                        : `**API rate limit hit** -- Please try again later.`,
                    timestamp: new Date().toISOString(),
                  },
                ]);
              } else {
                // Generic rate limit
                setMessages((prev) => [
                  ...prev,
                  { id: genMsgId(), role: "system", type: "error", content: errorData.message || "Rate limit reached. Please try again later.", timestamp: new Date().toISOString() },
                ]);
              }
            } else {
              setMessages((prev) => [...prev, { id: genMsgId(), role: "system", type: "error", content: `Error: ${errorData.error || errorData.message || "Request failed"}`, timestamp: new Date().toISOString() }]);
            }

            setIsLoading(false);
            return;
          }

          const reader = res.body?.getReader();
          if (!reader) {
            setLiveStatus(null);
            setMessages((prev) => [...prev, { id: genMsgId(), role: "system", type: "error", content: "Streaming not supported", timestamp: new Date().toISOString() }]);
            setIsLoading(false);
            return;
          }

          const decoder = new TextDecoder();
          let buffer = "";
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let finalData: any = null;

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  try {
                    const event = JSON.parse(line.slice(6));
                    if (event.type === "status") {
                      setLiveStatus({ message: event.message, phase: event.phase || "thinking" });
                    } else if (event.type === "tool_start") {
                      // Parse input if it's a string (OpenRouter sends stringified JSON)
                      let toolInput: Record<string, unknown> | undefined;
                      try {
                        toolInput = typeof event.input === "string" ? JSON.parse(event.input) : (event.input as Record<string, unknown>);
                      } catch { toolInput = undefined; }
                      setLiveStatus({ message: `Executing: ${event.toolName}`, phase: "tool", toolName: event.toolName });
                      setActivityLog((prev) => {
                        // Only store display-relevant fields to keep state lightweight
                        const displayInput = toolInput ? { name: toolInput.name, table: toolInput.table, query: toolInput.query, encoded_query: toolInput.encoded_query, data: toolInput.data } as Record<string, unknown> : undefined;
                        const entry = { message: event.toolName, phase: "tool", timestamp: Date.now(), toolName: event.toolName, toolInput: displayInput, done: false };
                        const updated = [...prev, entry];
                        return updated.length > 100 ? updated.slice(-100) : updated;
                      });
                    } else if (event.type === "tool_end") {
                      setLiveStatus({ message: `${event.toolName} completed`, phase: "tool", toolName: event.toolName });
                      // Mark matching tool_start entry as done
                      setActivityLog((prev) => {
                        const updated = [...prev];
                        for (let i = updated.length - 1; i >= 0; i--) {
                          if (updated[i].toolName === event.toolName && !updated[i].done) {
                            updated[i] = { ...updated[i], done: true };
                            break;
                          }
                        }
                        return updated;
                      });
                    } else if (event.type === "plan") {
                      // Task planner produced a structured plan
                      setTaskPlan(event.plan);
                      setLiveStatus({ message: "Executing plan...", phase: "thinking" });
                    } else if (event.type === "task_start") {
                      setLiveStatus({ message: `Task: ${event.taskName}`, phase: "tool" });
                      setActivityLog((prev) => {
                        const entry = { message: event.taskName, phase: "task" as string, timestamp: Date.now(), taskId: event.taskId, taskName: event.taskName, done: false };
                        const updated = [...prev, entry];
                        return updated.length > 100 ? updated.slice(-100) : updated;
                      });
                    } else if (event.type === "task_complete") {
                      // Mark task entry as done in activity log
                      setActivityLog((prev) => {
                        const updated = [...prev];
                        for (let i = updated.length - 1; i >= 0; i--) {
                          if (updated[i].taskId === event.taskId && !updated[i].done) {
                            updated[i] = { ...updated[i], done: true };
                            break;
                          }
                        }
                        return updated;
                      });
                    } else if (event.type === "done") {
                      finalData = { reply: event.reply, toolExecutions: event.toolExecutions };
                    } else if (event.type === "max_rounds_reached") {
                      // Check if this is a lightweight phase that should NOT auto-resume
                      // (e.g., scope_selection — auto-resuming just creates cascading loops)
                      const noAutoResumePhases = new Set(["scope_selection"]);
                      const eventPhase = (event as { phase?: string }).phase;
                      const shouldAutoResume = !eventPhase || !noAutoResumePhases.has(eventPhase);

                      // Add partial reply as assistant msg
                      const partialMsg: ChatMessage = {
                        id: genMsgId(),
                        role: "assistant",
                        content: event.reply,
                        toolExecutions: event.toolExecutions,
                        timestamp: new Date().toISOString(),
                      };
                      const updatedMsgs = [...messagesRef.current, partialMsg];
                      messagesRef.current = updatedMsgs;
                      setMessages(updatedMsgs);

                      if (!shouldAutoResume) {
                        // Don't auto-resume — show actionable error instead of cascading loops
                        setLiveStatus(null);
                        setMessages((prev) => [...prev, {
                          id: genMsgId(),
                          role: "system",
                          type: "error",
                          content: `**Phase stalled**: The AI could not complete the \`${eventPhase}\` phase within the round limit. This usually means it needs guidance to proceed.\n\n**Try**: Tell the AI what to do next, e.g. "Emit the phase gate and proceed to implementation."`,
                          timestamp: new Date().toISOString(),
                        }]);
                        setIsLoading(false);
                        return;
                      }

                      // Show countdown timer
                      const delayMs = event.resumeAfterMs || 5000;
                      const steps = Math.ceil(delayMs / 1000);
                      for (let s = steps; s > 0; s--) {
                        setLiveStatus({ message: `Round limit reached. Resuming in ${s}s...`, phase: "thinking" });
                        await new Promise((r) => setTimeout(r, 1000));
                      }
                      setLiveStatus({ message: "Resuming...", phase: "thinking" });

                      // Auto-send a "continue" message to resume from the same point (hidden from chat UI)
                      setTimeout(() => handleSendRef.current("Continue from where you left off. Complete the remaining work.", undefined, undefined, true), 200);
                      return; // Exit the current stream processing
                    } else if (event.type === "error") {
                      setLiveStatus(null);
                      let errorContent = `Error: ${event.message}`;
                      const msg = typeof event.message === "string" ? event.message : "";
                      // Detect provider errors forwarded from sn-engine via SSE
                      const isProviderRateLimit = msg.includes("Rate limit exceeded after retries") || msg.startsWith("openrouter_rate_limit|");
                      const isProviderAuth = msg.includes("authentication failed") || msg.includes("invalid") && msg.includes("api key");
                      if (isProviderRateLimit || isProviderAuth) {
                        const hasUserKey = aiProvider === "openrouter" ? !!credentials.openRouterApiKey : !!credentials.claudeApiKey;
                        const isServerKey = !hasUserKey;
                        if (allowUserApiKeys && isServerKey) {
                          setPendingRetry({ text, images, files });
                          setProviderError(isProviderAuth ? "provider_auth" : "provider_rate_limit");
                          setShowApiKeyGate(true);
                        }
                      }
                      if (msg.startsWith("openrouter_rate_limit|")) {
                        const parts = msg.split("|");
                        const rateLimitedModel = parts[1] || "the selected model";
                        errorContent = `**Rate limited** -- The model \`${rateLimitedModel}\` is temporarily rate-limited by its upstream provider after multiple retry attempts.\n\n**What you can do:**\n- **Switch to a different model** from the model selector\n- **Wait a few minutes** and try again\n- **Use BYOK** (Bring Your Own Key) from [OpenRouter](https://openrouter.ai/settings/integrations) for higher limits`;
                      } else if (isProviderRateLimit) {
                        errorContent = allowUserApiKeys ? "**Shared key limit hit** -- Switch to BYOK (Bring Your Own Key) to continue." : "**API rate limit hit** -- Please try again later.";
                      } else if (isProviderAuth) {
                        errorContent = "**API key error** -- Check your API key in Settings.";
                      }
                      setMessages((prev) => [...prev, { id: genMsgId(), role: "system", type: "error", content: errorContent, timestamp: new Date().toISOString() }]);
                      setIsLoading(false);
                      return;
                    }
                  } catch {
                    // Ignore parse errors for incomplete chunks
                  }
                }
              }
            }
          } finally {
            reader.releaseLock();
          }

          setLiveStatus(null);

          if (!finalData) {
            setMessages((prev) => [...prev, { id: genMsgId(), role: "system", type: "error", content: "No response received from streaming API", timestamp: new Date().toISOString() }]);
            setIsLoading(false);
            return;
          }

          // Process the final response (same logic as non-streaming)
          const data = finalData;

          // Continue with the same response processing logic below...
          // (phaseGate detection, assistant message creation, etc.)

          // Detect phase gate in response
          const phaseGate = parsePhaseGate(data.reply || "");
          const reqMatch = (data.reply || "").match(/REQ-(\d{3})/);
          if (reqMatch && !activeReqId) setActiveReqId(reqMatch[0]);

          const phaseInfo = phaseGate ? SDLC_PHASES.find((p) => p.key === phaseGate) : null;
          const isAutoApprove = phaseInfo ? !phaseInfo.requiresApproval : false;

          if (phaseGate) {
            const nextPhaseMap: Record<string, SDLCPhase> = { spec: "design", design: "scope_selection", scope_selection: "implementation", implementation: "testing", testing: "deployment" };
            if (isAutoApprove) {
              setCompletedPhases((prev) => (prev.includes(phaseGate) ? prev : [...prev, phaseGate]));
              const next = nextPhaseMap[phaseGate];
              if (next) setCurrentPhase(next);
            } else {
              setCurrentPhase(phaseGate);
            }
          }

          const assistantMsg: ChatMessage = {
            id: genMsgId(),
            role: "assistant",
            content: data.reply,
            toolExecutions: data.toolExecutions,
            timestamp: new Date().toISOString(),
            phaseGate: phaseGate || undefined,
            approved: isAutoApprove && phaseGate ? true : undefined,
            autoApproved: isAutoApprove && phaseGate ? true : undefined,
          };

          const updatedMsgs = [...messagesRef.current, assistantMsg];
          messagesRef.current = updatedMsgs;
          setMessages(updatedMsgs);

          if (isAutoApprove && phaseGate) {
            setTimeout(() => handleSendRef.current("approved"), 100);
          }

          setIsLoading(false);
          return;
        }

        // Non-streaming fallback
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credentials, messages: apiMessages, model: modelId, aiProvider, sessionId: clientSessionId, phase: currentPhase, sddMode }),
          signal: controller.signal,
        });

        const data = await res.json();

        if (res.ok) {
          // Update usage counter from response
          if (data.usage) setUsage(data.usage);

          // Detect phase gate in response
          const phaseGate = parsePhaseGate(data.reply || "");

          // Detect requirement ID from response (e.g., REQ-003)
          const reqMatch = (data.reply || "").match(/REQ-(\d{3})/);
          if (reqMatch && !activeReqId) {
            setActiveReqId(reqMatch[0]);
          }

          // Track current phase based on gate
          const phaseInfo = phaseGate ? SDLC_PHASES.find((p) => p.key === phaseGate) : null;
          const isAutoApprove = phaseInfo ? !phaseInfo.requiresApproval : false;

          if (phaseGate) {
            const nextPhaseMap: Record<string, SDLCPhase> = {
              spec: "design",
              design: "scope_selection",
              scope_selection: "implementation",
              implementation: "testing",
              testing: "deployment",
            };

            if (isAutoApprove) {
              // Auto-proceed: mark phase completed immediately and advance
              setCompletedPhases((prev) => (prev.includes(phaseGate) ? prev : [...prev, phaseGate]));
              const next = nextPhaseMap[phaseGate];
              if (next) setCurrentPhase(next);
            } else {
              // Manual approval required: set as current and wait for user click
              setCurrentPhase(phaseGate);
            }
          }

          // Build assistant message with phase gate info
          const assistantMsg: ChatMessage = {
            id: genMsgId(),
            role: "assistant",
            content: data.reply,
            toolExecutions: data.toolExecutions,
            timestamp: new Date().toISOString(),
            phaseGate: phaseGate || undefined,
            // Auto-approve gates that don't require user sign-off
            approved: isAutoApprove && phaseGate ? true : undefined,
            autoApproved: isAutoApprove && phaseGate ? true : undefined,
          };

          const newMsgs: ChatMessage[] = [assistantMsg];

          // Inject auto-approved system message for auto-proceed phases
          if (isAutoApprove && phaseGate) {
            newMsgs.push({
              id: genMsgId(),
              role: "system",
              type: "info",
              content: `⚡ **${phaseGate.charAt(0).toUpperCase() + phaseGate.slice(1)}** phase auto-approved (no sign-off required). Proceeding...`,
              timestamp: new Date().toISOString(),
            });
          }

          // Low remaining requests warning is now handled by the 3-tier gate modals
          // Update both state and ref together before potential auto-approve setTimeout
          const updatedMsgs = [...messagesRef.current, ...newMsgs];
          messagesRef.current = updatedMsgs;
          setMessages(updatedMsgs);

          // Auto-send "approved" for phases that don't require user sign-off
          if (isAutoApprove && phaseGate) {
            setTimeout(() => handleSendRef.current("approved"), 100);
          }
        } else if (res.status === 429) {
          syncUsageFrom429(data);
          if (data.error === "signup_required") {
            setPendingRetry({ text, images, files });
            setGateInfo((prev) => ({ ...prev, dailyUsed: data.dailyUsed ?? prev.dailyUsed, dailyLimit: data.dailyLimit ?? prev.dailyLimit }));
            setShowSignupGate(true);
            setMessages((prev) => [...prev, { id: genMsgId(), role: "system", type: "error", content: data.message || "Free request limit reached. Sign up to continue.", timestamp: new Date().toISOString() }]);
          } else if (data.error === "apikey_required") {
            setPendingRetry({ text, images, files });
            setGateInfo((prev) => ({ ...prev, dailyUsed: data.dailyUsed ?? prev.dailyUsed, dailyLimit: data.dailyLimit ?? prev.dailyLimit }));
            setShowApiKeyGate(true);
            setMessages((prev) => [...prev, { id: genMsgId(), role: "system", type: "error", content: data.message || "Daily limit reached. Switch to BYOK (Bring Your Own Key) to continue.", timestamp: new Date().toISOString() }]);
          } else if (data.error === "anthropic_rate_limit" || data.code === "provider_rate_limit" || data.code === "provider_billing" || data.code === "provider_auth") {
            const isServerKey = data.usedServerKey !== false;
            if (allowUserApiKeys && isServerKey) { setPendingRetry({ text, images, files }); setProviderError(data.code || data.error); setShowApiKeyGate(true); }
            setMessages((prev) => [...prev, { id: genMsgId(), role: "system", type: "error", content: (allowUserApiKeys && isServerKey)
              ? "**Shared key limit hit** -- Switch to BYOK (Bring Your Own Key) to continue."
              : data.code === "provider_auth"
                ? "**API key error** -- Check your API key in Settings."
                : "**API rate limit hit** -- Please try again later.", timestamp: new Date().toISOString() }]);
          } else {
            setMessages((prev) => [...prev, { id: genMsgId(), role: "system", type: "error", content: data.message || "Rate limit reached. Please try again later.", timestamp: new Date().toISOString() }]);
          }
        } else {
          setMessages((prev) => [
            ...prev,
            { id: genMsgId(), role: "system", type: "error", content: `Error: ${data.error}`, timestamp: new Date().toISOString() },
          ]);
        }
      } catch (err) {
        // Don't show error for user-initiated cancellation
        if (err instanceof DOMException && err.name === "AbortError") {
          setMessages((prev) => [
            ...prev,
            { id: genMsgId(), role: "system", type: "info", content: "⏹ Request cancelled.", timestamp: new Date().toISOString() },
          ]);
        } else {
          const errMsg = err instanceof Error ? err.message : String(err);
          const lowerErr = errMsg.toLowerCase();
          const isNetworkTimeout = lowerErr.includes("networkerror") || lowerErr.includes("network error") || lowerErr.includes("failed to fetch") || lowerErr.includes("load failed") || lowerErr.includes("terminated");
          const displayMsg = isNetworkTimeout
            ? "Connection lost — the server may still be processing. This can happen during long operations. Please wait a moment and try again."
            : `Unexpected error: ${errMsg}`;
          setMessages((prev) => [
            ...prev,
            { id: genMsgId(), role: "system", type: "error", content: displayMsg, timestamp: new Date().toISOString() },
          ]);
        }
      } finally {
        abortRef.current = null;
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [credentials, isLoading, serverApiKeyConfigured, activeReqId, selectedModel, modelLocked, pendingRetry, allowUserApiKeys, streamingEnabled, currentPhase, clientSessionId, aiProvider, openRouterModels, sddMode, connected]
  );

  // Keep ref updated with latest handleSend to avoid stale closures in setTimeout callbacks
  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  /** Cancel an in-flight request */
  const handleCancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  // Drain the message queue when AI finishes processing
  useEffect(() => {
    if (!isLoading && messageQueue.length > 0) {
      const [next, ...rest] = messageQueue;
      setMessageQueue(rest);
      setMessages(prev => prev.map(m => m.id === next.id ? { ...m, queued: false } : m));
      messagesRef.current = messagesRef.current.map(m => m.id === next.id ? { ...m, queued: false } : m);
      const contextHint = "[This message was typed while the AI was responding]\n\n";
      setTimeout(() => handleSendRef.current(`${contextHint}${next.text}`, next.images, next.files, false), 300);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  /** Remove a queued message by ID */
  const handleDequeueMessage = useCallback((id: string) => {
    setMessageQueue(prev => prev.filter(m => m.id !== id));
    setMessages(prev => prev.filter(m => !(m.id === id && m.queued)));
    messagesRef.current = messagesRef.current.filter(m => !(m.id === id && m.queued));
  }, []);

  /** Clear all queued messages */
  const handleClearQueue = useCallback(() => {
    const queuedIds = new Set(messageQueue.map(m => m.id));
    setMessageQueue([]);
    setMessages(prev => prev.filter(m => !queuedIds.has(m.id ?? "")));
    messagesRef.current = messagesRef.current.filter(m => !queuedIds.has(m.id ?? ""));
  }, [messageQueue]);

  /** Handle phase gate approval — mark the message as approved and send "approved" to continue */
  const handleApprove = useCallback(
    (phase: SDLCPhase) => {
      // Mark the gate message as approved and update messagesRef immediately
      const updatedMessages = messagesRef.current.map((m) =>
        m.phaseGate === phase && !m.approved ? { ...m, approved: true } : m
      );
      messagesRef.current = updatedMessages;
      setMessages(updatedMessages);

      // Track completed phase and advance to next
      setCompletedPhases((prev) => (prev.includes(phase) ? prev : [...prev, phase]));
      const nextPhaseMap: Record<string, SDLCPhase> = {
        spec: "design",
        design: "scope_selection",
        scope_selection: "implementation",
        implementation: "testing",
        testing: "deployment",
      };
      const next = nextPhaseMap[phase];
      if (next) setCurrentPhase(next);

      // Send approval message to continue the conversation
      const approvalMsg = `approved`;
      // Inject system confirmation and update messagesRef immediately
      const withSystemMsg = [
        ...messagesRef.current,
        { id: genMsgId(), role: "system" as const, type: "success" as const, content: `✅ **${phase.charAt(0).toUpperCase() + phase.slice(1)}** phase approved. Proceeding...`, timestamp: new Date().toISOString() },
      ];
      messagesRef.current = withSystemMsg;
      setMessages(withSystemMsg);

      // Trigger the next message (use ref to get latest handleSend, avoiding stale closure)
      setTimeout(() => handleSendRef.current(approvalMsg), 100);
    },
    [] // No dependencies needed - we use handleSendRef which always has the latest
  );

  /** Handle interactive choice selection — mark the message as answered and send the choice */
  const handleChoiceSelect = useCallback(
    (choiceKey: string) => {
      // Find the last assistant message with unanswered choices and mark it
      const updated = [...messagesRef.current];
      let choiceLabel = choiceKey; // fallback to key if label not found
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].role === "assistant" && parseUserChoices(updated[i].content) && !updated[i].choicesAnswered) {
          // Extract the label for the selected choice key
          const choicesBlock = parseUserChoices(updated[i].content);
          if (choicesBlock) {
            const selected = choicesBlock.choices.find(c => c.key === choiceKey);
            if (selected) {
              choiceLabel = selected.label;
            }
          }
          updated[i] = { ...updated[i], choicesAnswered: true };
          break;
        }
      }
      messagesRef.current = updated;
      setMessages(updated);

      // Send the choice label as user message (display-friendly) but include key for AI processing
      setTimeout(() => handleSendRef.current(choiceLabel !== choiceKey ? `${choiceLabel}` : choiceKey), 50);
    },
    [] // Uses refs — no stale closure risk
  );

  const handleNewChat = useCallback(() => {
    resetSharePromptSession();
    // Finalize the old session (best-effort, non-blocking)
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
    setFocusMode(false);
    focusModeAutoTriggeredRef.current = false;
    setModelLocked(false);
    setPendingRetry(null);
    setProviderError(null);
    setShowApiKeyGate(false);
    setActivityLog([]);
    setTaskPlan(null);
    // Clear persisted session state
    ALL_SESSION_KEYS.forEach((k) => sessionStorage.removeItem(k));

    // Generate a fresh session ID for the new chat
    const newId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setClientSessionId(newId);
    try { sessionStorage.setItem(SK.SESSION_ID, newId); } catch { /* quota */ }
  }, [clientSessionId, resetSharePromptSession]);

  const handlePhaseClick = useCallback((phase: SDLCPhase) => {
    const el = document.querySelector(`[data-phase-divider="${phase}"]`) || document.querySelector(`[data-phase="${phase}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  /** Fetch categorized prompts from the API (used on connect + auto-refresh) */
  const fetchCategorizedPromptsFromApi = useCallback(
    (creds: typeof credentials, userCtx?: { sysId: string; roles: string[]; assignmentGroups: { sysId: string; name: string }[] }) => {
      setPromptsRefreshing(true);
      const currentSeen = (() => { try { const raw = sessionStorage.getItem(SK.SEEN_SUGGESTIONS); return raw ? JSON.parse(raw) : []; } catch { return []; } })();
      fetch("/api/instance-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceUrl: creds.instanceUrl,
          username: creds.username,
          password: creds.password,
          snAuthType: creds.snAuthType,
          clientId: creds.clientId,
          clientSecret: creds.clientSecret,
          accessToken: creds.accessToken,
          refreshToken: creds.refreshToken,
          sessionCookies: creds.sessionCookies,
          userContext: userCtx,
          seenHashes: currentSeen,
        }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.prompts && typeof d.prompts === "object" && d.prompts.foryou) {
            setCategorizedPrompts(d.prompts);
            setPromptsLastRefreshed(Date.now());
            if (d.promptHashes) {
              setSeenSuggestionHashes((prev) => {
                const merged = [...prev, ...d.promptHashes.filter((h: string) => !prev.includes(h))];
                const trimmed = merged.length > 200 ? merged.slice(merged.length - 200) : merged;
                try { sessionStorage.setItem(SK.SEEN_SUGGESTIONS, JSON.stringify(trimmed)); } catch { /* quota */ }
                return trimmed;
              });
            }
            try { sessionStorage.setItem(SK.CATEGORIZED_PROMPTS, JSON.stringify(d.prompts)); } catch { /* quota */ }
          }
        })
        .catch(() => { /* non-critical */ })
        .finally(() => setPromptsRefreshing(false));
    },
    []
  );

  // Auto-refresh prompts every 5 minutes while connected
  useEffect(() => {
    if (!connected || !connInfo) return;
    const userCtx = connInfo.userInfo?.sysId
      ? { sysId: connInfo.userInfo.sysId, roles: connInfo.roles || [], assignmentGroups: connInfo.userInfo.assignmentGroups || [] }
      : undefined;
    const interval = setInterval(() => {
      fetchCategorizedPromptsFromApi(credentials, userCtx);
    }, 300_000); // 5 min
    return () => clearInterval(interval);
  }, [connected, connInfo, credentials, fetchCategorizedPromptsFromApi]);

  /** Manual refresh trigger for the SuggestionPanel */
  const handleRefreshPrompts = useCallback(() => {
    if (!connected || !connInfo) return;
    const userCtx = connInfo.userInfo?.sysId
      ? { sysId: connInfo.userInfo.sysId, roles: connInfo.roles || [], assignmentGroups: connInfo.userInfo.assignmentGroups || [] }
      : undefined;
    fetchCategorizedPromptsFromApi(credentials, userCtx);
  }, [connected, connInfo, credentials, fetchCategorizedPromptsFromApi]);

  /** Click a sidebar suggestion -> populate chat input (user sends manually) */
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const handlePopulateInput = useCallback((prompt: string) => {
    setPendingPrompt(prompt);
  }, []);
  const clearPendingPrompt = useCallback(() => {
    setPendingPrompt(null);
  }, []);

  /** Disconnect and unlock fields so user can edit before reconnecting */
  const handleReconnect = useCallback(() => {
    const authType = normalizeServiceNowAuthMethod(credentials.snAuthType);
    trackedSessionStartIdRef.current = null;
    markShareDisconnected();
    setConnected(false);
    setConnInfo(null);
    setConnectingLabel(null);
    setModelLocked(false);
    setCategorizedPrompts(null);
    setPromptsLastRefreshed(null);
    setSeenSuggestionHashes([]);
    if (authType === "session") {
      setCredentials((prev) => ({ ...prev, sessionCookies: [] }));
    } else if (authType === "oauth_authorization_code") {
      setCredentials((prev) => ({ ...prev, accessToken: "", refreshToken: "" }));
    }
    try { sessionStorage.removeItem(SK.SEEN_SUGGESTIONS); sessionStorage.removeItem(SK.CATEGORIZED_PROMPTS); } catch { /* ok */ }
  }, [credentials.snAuthType, markShareDisconnected]);


  /** Sidebar resize handlers (mouse + touch) */
  useEffect(() => {
    const handleMove = (clientX: number) => {
      if (!isResizingLeft.current && !isResizingRight.current) return;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (isResizingLeft.current) setLeftWidth(Math.min(Math.max(clientX, 240), 480));
        if (isResizingRight.current) setRightWidth(Math.min(Math.max(window.innerWidth - clientX, 240), 480));
      });
    };
    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const handleTouchMove = (e: TouchEvent) => { if (e.touches[0]) handleMove(e.touches[0].clientX); };
    const handleEnd = () => {
      isResizingLeft.current = false;
      isResizingRight.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleEnd);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, []);

  const startResizeLeft = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isResizingLeft.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const startResizeRight = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isResizingRight.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  /** Shared SettingsPanel props (reused for sidebar + mobile full-screen) */
  const settingsPanelProps = {
    credentials, setCredentials, connected, connInfo, isConnecting, connectingLabel, connectionError,
    onConnect: handleConnect, onReconnect: handleReconnect,
    serverApiKeyConfigured, serverOpenRouterKeyConfigured, serverSnCredsConfigured,
    usage, rateLimitHit, trialStatus, onRefreshUsage: refreshUsage,
    onApiKeyProvided: () => {
      setRateLimitHit(false);
      if (pendingRetry) {
        const retry = pendingRetry;
        setPendingRetry(null);
        setTimeout(() => handleSendRef.current(retry.text, retry.images, retry.files), 150);
      }
    },
    aiProvider, setAiProvider, selectedModel, setSelectedModel,
    modelOptions: openRouterModels, modelsLoading, modelLocked, allowUserApiKeys,
  };

  return (
    <div className="flex h-screen relative" style={{ background: "var(--surface-app)", color: "var(--text-primary)" }}>

      {/* ═══ Mobile full-screen connection panel (< sm, step 2) ═══ */}
      <div
        className={`sm:hidden fixed inset-0 z-50 mobile-connect-panel ${mobileStep === "connect" && !connected ? "mobile-connect-panel-visible" : ""}`}
        style={{ background: "var(--surface-sidebar)" }}
      >
        <SettingsPanel {...settingsPanelProps} onBack={() => setMobileStep("hero")} />
      </div>

      {/* Mobile backdrop (for sidebar toggle on md screens — unchanged) */}
      {showSettings && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 hidden sm:block md:hidden"
          onClick={() => setShowSettings(false)}
        />
      )}

      {/* ═══ Left Sidebar — Navigation / Settings (sm+ only) ═══ */}
      <aside
        className={`hidden sm:flex ${
          showSettings ? "translate-x-0" : "!w-0 -translate-x-full md:translate-x-0"
        } fixed md:static inset-y-0 left-0 z-40 md:z-auto transition-all duration-300 overflow-hidden flex-shrink-0`}
        style={{ background: "var(--surface-sidebar)", borderRight: "1px solid var(--border-default)", width: showSettings ? leftWidth : 0 }}
      >
        <div className="flex-1 overflow-hidden">
          <SettingsPanel {...settingsPanelProps} />
        </div>
        {/* Resize handle */}
        <div
          className="sidebar-resize-handle"
          onMouseDown={startResizeLeft}
          onTouchStart={startResizeLeft}
        />
      </aside>

      {/* ═══ Center Panel — Primary Context ═══ */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* ═══ Header Bar ═══ */}
        <header
          className="app-header flex items-center justify-between gap-2 px-4 sm:px-5 py-2 sm:py-2.5"
          style={{ background: "var(--surface-primary)", borderBottom: "1px solid var(--border-default)" }}
        >
          {/* Left zone: sidebar toggle + logo (Home) + app name */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => {
                setFocusMode(false);
                setShowSettings(!showSettings);
              }}
              className="header-btn flex-shrink-0"
              title={showSettings ? "Collapse settings panel" : "Expand settings panel"}
            >
              {showSettings ? <PanelLeftClose className="w-5 h-5" strokeWidth={1.5} /> : <PanelLeftOpen className="w-5 h-5" strokeWidth={1.5} />}
            </button>

            <Link href="/" className="flex items-center gap-2 sm:gap-2.5 min-w-0 hover:opacity-80 transition-opacity" title="Home">
              {APP_LOGO && (
                <Image src={APP_LOGO} alt={APP_NAME} width={32} height={32} className="rounded-full flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8" unoptimized priority />
              )}
              <h1 className="hidden sm:block text-sm sm:text-[15px] font-semibold truncate" style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{APP_NAME}</h1>
            </Link>
          </div>

          {/* Right zone: about + release + feedback + theme + new chat + profile + right-panel toggle */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            {/* About / Info */}
            {SHOW_INFO_BUTTON && (
              <button
                onClick={() => setShowInfo(true)}
                className="header-nav-btn"
                title="About"
              >
                <Info className="w-4 h-4" strokeWidth={1.5} />
                <span className="hidden md:inline">About</span>
              </button>
            )}

            {/* Release / Changelog */}
            <div ref={releaseRef} className="relative">
              <button
                onClick={() => setShowRelease(!showRelease)}
                className="header-nav-btn"
                title="What's new"
              >
                <Sparkles className="w-4 h-4" strokeWidth={1.5} />
                <span className="hidden md:inline">Release</span>
              </button>
              {showRelease && (() => {
                const released = changelogEntries.filter(e => e.status === "released");
                const upcoming = changelogEntries.filter(e => e.status === "upcoming" || e.status === "planned");
                const CATEGORY_ORDER = ["added", "improved", "fixed", "security", "removed", "deprecated"] as const;
                const categoryLabel: Record<string, string> = { added: "Added", improved: "Improved", fixed: "Fixed", security: "Security", removed: "Removed", deprecated: "Deprecated" };
                const categoryDot: Record<string, string> = { added: "var(--color-success)", improved: "var(--color-primary)", fixed: "var(--color-warning, #f59e0b)", security: "var(--color-accent)", removed: "var(--text-disabled)", deprecated: "var(--text-disabled)" };
                const groupByCategory = (items: typeof released) => {
                  const groups: Record<string, typeof released> = {};
                  for (const item of items) {
                    const cat = item.category || "added";
                    if (!groups[cat]) groups[cat] = [];
                    groups[cat].push(item);
                  }
                  return groups;
                };
                const releasedGroups = groupByCategory(released);
                const sortedCategories = CATEGORY_ORDER.filter(c => releasedGroups[c]);
                return (
                  <div
                    className="release-dropdown absolute right-0 mt-1.5 rounded-lg overflow-hidden"
                    style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-default)", width: 340, zIndex: 50, boxShadow: "var(--shadow-lg)" }}
                  >
                    <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-default)" }}>
                      <div className="flex items-center justify-between">
                        <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>What&apos;s New</div>
                        {currentRelease && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--surface-secondary)", color: "var(--text-secondary)" }}>
                            v{currentRelease.version}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] mt-0.5" style={{ color: "var(--text-disabled)" }}>
                        {currentRelease ? (() => { const [y, m, d] = currentRelease.release_date.split("-").map(Number); return `${currentRelease.title} \u00b7 ${new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`; })() : "Latest updates and upcoming features"}
                      </div>
                    </div>
                    <div className="p-3 space-y-3 max-h-[380px] overflow-y-auto">
                      {changelogEntries.length === 0 ? (
                        <div className="text-center py-4 text-[11px]" style={{ color: "var(--text-disabled)" }}>No updates available</div>
                      ) : (
                        <>
                          {sortedCategories.map(cat => {
                            const items = releasedGroups[cat];
                            return (
                            <div key={cat} className="space-y-1.5">
                              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-disabled)" }}>
                                {categoryLabel[cat] || cat}
                              </div>
                              <div className="space-y-1">
                                {items.slice(0, 8).map(entry => (
                                  <div key={entry.id} className="flex items-start gap-2 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                                    <span className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ background: categoryDot[cat] || "var(--color-success)" }} />
                                    <span>{entry.title}</span>
                                  </div>
                                ))}
                                {items.length > 8 && (
                                  <div className="text-[10px] pl-3.5" style={{ color: "var(--text-disabled)" }}>+{items.length - 8} more</div>
                                )}
                              </div>
                            </div>
                            );
                          })}
                          {upcoming.length > 0 && (
                            <>
                              {released.length > 0 && <div style={{ borderTop: "1px solid var(--border-default)", margin: "0 -12px", padding: "0" }} />}
                              <div className="space-y-1.5">
                                <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-disabled)" }}>Coming Soon</div>
                                <div className="space-y-1">
                                  {upcoming.map(entry => (
                                    <div key={entry.id} className="flex items-start gap-2 text-[12px]" style={{ color: "var(--text-disabled)" }}>
                                      <span className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ background: "var(--status-progress)" }} />
                                      {entry.title}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                    {CHANGELOG_URL && (
                      <div className="px-3 pb-3 pt-1">
                        <a
                          href={CHANGELOG_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-[11px] font-medium transition-colors"
                          style={{ color: "var(--color-primary)" }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = "0.8"; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          View full changelog
                        </a>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Feedback */}
            <button
              onClick={() => setShowFeedback(true)}
              className="header-nav-btn"
              title="Send feedback"
            >
              <MessageSquare className="w-4 h-4" strokeWidth={1.5} />
              <span className="hidden md:inline">Feedback</span>
            </button>

            {/* Clear Cache */}
            <button
              onClick={() => { window.location.href = "/clearcache"; }}
              className="header-nav-btn"
              title="Clear cache & refresh"
            >
              <RotateCcw className="w-4 h-4" strokeWidth={1.5} />
              <span className="hidden md:inline">Clear Cache</span>
            </button>

            {/* Separator */}
            <div className="hidden sm:block w-px h-5 mx-0.5" style={{ background: "var(--border-default)" }} />

            {/* Theme toggle */}
            <ThemeToggle />

            {/* New Chat */}
            {messages.length > 0 && (
              <button
                onClick={handleNewChat}
                className="header-nav-btn flex-shrink-0"
                title="New Chat"
              >
                <Plus className="w-4 h-4" strokeWidth={1.5} />
                <span className="hidden md:inline">New</span>
              </button>
            )}

            {/* Profile / Sign In */}
            {!appUser ? (
              <button
                type="button"
                onClick={() => setShowSignInModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-md transition-colors"
                style={{ color: "var(--text-primary)", background: "var(--surface-secondary)", border: "1px solid var(--border-default)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-elevated)"; e.currentTarget.style.borderColor = "var(--border-emphasis)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "var(--surface-secondary)"; e.currentTarget.style.borderColor = "var(--border-default)"; }}
                aria-label="Sign in"
              >
                <User className="w-4 h-4" strokeWidth={1.5} />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            ) : (
              <div ref={profileRef} className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center justify-center rounded-full transition-opacity hover:opacity-80"
                  style={{ width: 28, height: 28, background: "var(--color-primary)", color: "#fff", fontSize: 12, fontWeight: 600, letterSpacing: "-0.01em" }}
                  title={appUser?.name || "Profile"}
                >
                  {appUser?.name ? appUser.name.charAt(0).toUpperCase() : (
                    <User className="w-3.5 h-3.5" strokeWidth={2} />
                  )}
                </button>
                {profileOpen && (
                  <div
                    className="absolute right-0 mt-1.5 rounded-lg overflow-hidden"
                    style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-default)", minWidth: 200, zIndex: 50, boxShadow: "var(--shadow-lg)" }}
                  >
                    {appUser && (
                      <div className="px-3.5 py-2.5" style={{ borderBottom: "1px solid var(--border-default)" }}>
                        <div className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>{appUser.name}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: "var(--text-disabled)" }}>{appUser.email}</div>
                      </div>
                    )}
                    <div className="py-1">
                      {appUser?.role === "admin" && (
                        <a href="/admin" className="header-dropdown-item">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          Admin Dashboard
                        </a>
                      )}
                      <button onClick={() => { setProfileOpen(false); window.location.href = "/clearcache"; }} className="header-dropdown-item w-full">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Clear cache
                      </button>
                      <div style={{ borderTop: "1px solid var(--border-subtle)", margin: "2px 0" }} />
                      <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/"; }} className="header-dropdown-item w-full">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Right panel toggle */}
            <button
              onClick={() => {
                setFocusMode(false);
                setShowRightPanel(!showRightPanel);
              }}
              className="header-btn flex-shrink-0"
              title={showRightPanel ? "Collapse right panel" : "Expand right panel"}
            >
              {showRightPanel ? <PanelRightClose className="w-5 h-5" strokeWidth={1.5} /> : <PanelRightOpen className="w-5 h-5" strokeWidth={1.5} />}
            </button>
          </div>
        </header>

        {/* ═══ Subheader: PhaseTracker + connection indicator (only when SDD active) ═══ */}
        {activeReqId && currentPhase && (
          <div
            className="app-subheader flex items-center justify-between gap-2 px-4 sm:px-5 py-1.5"
            style={{ background: "var(--surface-secondary)", borderBottom: "1px solid var(--border-default)" }}
          >
            <PhaseTracker currentPhase={currentPhase} completedPhases={completedPhases} reqId={activeReqId} onPhaseClick={handlePhaseClick} />
            {connected && connInfo && (
              <span
                className="hidden sm:flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
                style={{
                  background: "color-mix(in srgb, var(--color-success) 8%, transparent)",
                  color: "var(--color-success)",
                }}
              >
                <span className="w-1 h-1 rounded-full" style={{ background: "var(--status-success)" }} />
                {credentials.instanceUrl.replace(/https?:\/\//, "").replace(/\.service-now\.com\/?$/, "")}
              </span>
            )}
          </div>
        )}

        {/* ═══ Chat / Center content ═══ */}
        {showShareBanner && (
          <div className="flex-shrink-0 px-3 pt-3 sm:px-4 sm:pt-3">
            <ShareBanner
              stats={shareSessionStats}
              onShare={openShareModalFromBanner}
              onDismiss={dismissShareBanner}
            />
          </div>
        )}
        <ChatWindow
          messages={messages}
          isLoading={isLoading}
          onSend={handleSend}
          onCancel={handleCancel}
          onApprove={handleApprove}
          onChoiceSelect={handleChoiceSelect}
          connected={connected}
          inputRef={inputRef}
          showToolDetails={showToolDetails}
          liveStatus={liveStatus}
          userName={connInfo?.userInfo?.name}
          categorizedPrompts={categorizedPrompts ?? undefined}
          activityLog={activityLog}
          taskPlan={taskPlan}
          onGetStarted={() => setMobileStep("connect")}
          pendingPrompt={pendingPrompt}
          onPendingPromptConsumed={clearPendingPrompt}
          sddMode={sddMode}
          currentPhase={currentPhase}
          queueLength={messageQueue.length}
          onDequeue={handleDequeueMessage}
          onClearQueue={handleClearQueue}
          onSddModeChange={(active, phase) => {
            setSddMode(active);
            setCurrentPhase(phase);
            if (!active) setCompletedPhases([]);
          }}
          activeReqId={activeReqId}
          clientSessionId={clientSessionId}
          completedPhases={completedPhases}
        />
      </main>

      {/* Right panel backdrop (sm–lg overlay) */}
      {connected && showRightPanel && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 hidden sm:block lg:hidden"
          onClick={() => setShowRightPanel(false)}
        />
      )}

      {/* ═══ Right Panel — Metadata / Status / Suggestions (visible when connected) ═══ */}
      {connected && (
        <aside
          className={`hidden sm:flex ${
            showRightPanel ? "translate-x-0" : "!w-0 translate-x-full lg:translate-x-0"
          } fixed lg:static inset-y-0 right-0 z-40 lg:z-auto transition-all duration-300 overflow-hidden flex-shrink-0`}
          style={{ background: "var(--surface-primary)", borderLeft: "1px solid var(--border-default)", width: showRightPanel ? rightWidth : 0 }}
        >
          {/* Resize handle */}
          <div
            className="sidebar-resize-handle sidebar-resize-handle-left"
            onMouseDown={startResizeRight}
            onTouchStart={startResizeRight}
          />
          <div className="flex-1 flex flex-col overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Connection info */}
            {connInfo && (
              <div>
                <div className="sidebar-group-label">Connection</div>
                <div className="mt-2 space-y-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: "var(--status-success)" }} />
                    <span>{connInfo.userInfo?.name || credentials.username}</span>
                  </div>
                  <div className="flex items-center gap-2" style={{ color: "var(--text-disabled)" }}>
                    <span className="font-mono text-[10px]">{credentials.instanceUrl.replace(/https?:\/\//, "").replace(/\/$/, "")}</span>
                  </div>
                  {connInfo.roles && (
                    <div className="flex items-center gap-2" style={{ color: "var(--text-disabled)" }}>
                      <span>{connInfo.roles.length} role{connInfo.roles.length !== 1 ? "s" : ""}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(showSharePanelLink || shareGeneratedCards.length > 0) && (
              <div>
                <div className="sidebar-group-label">Share</div>
                <button
                  type="button"
                  onClick={openShareModalFromPanel}
                  className="mt-2 w-full flex items-center justify-center gap-2 rounded-md px-3 py-2 text-[11px] font-medium transition-colors"
                  style={{
                    background: "color-mix(in srgb, var(--surface-secondary) 92%, transparent)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                >
                  <Share2 className="w-3.5 h-3.5" strokeWidth={1.8} />
                  Let others see what you built
                </button>

                {shareGeneratedCards.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                      Session highlights
                    </div>
                    {shareGeneratedCards.slice(-3).map((card, idx) => (
                      <button
                        key={`${card.phase}-${idx}`}
                        type="button"
                        onClick={openShareModalFromPanel}
                        className="w-full rounded-lg overflow-hidden transition-opacity hover:opacity-90"
                        style={{ border: "1px solid var(--border-default)" }}
                      >
                        <img
                          src={card.imageUrl}
                          alt={`Share card for ${card.phase} phase`}
                          className="w-full h-auto block"
                        />
                        <div
                          className="flex items-center justify-between px-2.5 py-1.5 text-[10px]"
                          style={{ background: "var(--surface-secondary)", color: "var(--text-secondary)" }}
                        >
                          <span className="font-medium capitalize">{card.phase}</span>
                          <span>{new Date(card.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Suggestion panel */}
            <SuggestionPanel
              prompts={categorizedPrompts}
              onSuggestionClick={handlePopulateInput}
              onRefresh={handleRefreshPrompts}
              isRefreshing={promptsRefreshing}
              lastRefreshed={promptsLastRefreshed}
            />
          </div>

          {/* Sidebar branding (footer-style) */}
          <div className="flex-1" />
          <div className="p-4 pt-6 text-center" style={{ borderTop: "1px solid var(--border-default)" }}>
            {APP_LOGO && (
              <Image src={APP_LOGO} alt={APP_NAME || "Logo"} width={36} height={36} className="rounded-full mx-auto mb-2.5" style={{ objectFit: "contain" }} unoptimized />
            )}
            {APP_NAME && (
              <div className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{APP_NAME}</div>
            )}
            <div className="text-[13px] mb-1.5" style={{ color: "var(--text-secondary)" }}>
              {FOOTER_TAGLINE}
            </div>
            <div className="text-xs mb-5" style={{ color: "var(--text-disabled)" }}>
              {CREATOR_LINKEDIN ? (
                <a
                  href={CREATOR_LINKEDIN}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 transition-colors"
                  style={{ color: "var(--text-secondary)", textDecoration: "none" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--color-primary)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--text-secondary)")}
                >
                  by {CREATOR_NAME}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
              ) : (
                <span>by {CREATOR_NAME}</span>
              )}
            </div>
            <div className="mx-auto mb-3" style={{ width: 40, height: 1, background: "var(--border-default)" }} />
            <div className="text-[11px]" style={{ color: "var(--text-disabled)" }}>
              &copy; {new Date().getFullYear()} {FOOTER_COPYRIGHT}
            </div>
          </div>
          </div>
        </aside>
      )}

      {/* Aria live region for streaming status */}
      <div aria-live="polite" aria-atomic="true" className="live-status">
        {isLoading ? "AI is responding..." : ""}
      </div>

      {/* Focus Mode exit button — visible whenever focus mode is on (sidebars may be opened manually) */}
      {focusMode && (
        <button
          className="focus-mode-exit"
          onClick={() => { setFocusMode(false); setShowSettings(true); setShowRightPanel(true); }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
          Exit Focus Mode
        </button>
      )}

      {/* Info modal */}
      <InfoModal open={showInfo} onClose={() => setShowInfo(false)} onTryPrompt={(text) => { setShowInfo(false); setTimeout(() => handleSendRef.current(text), 100); }} />
      <WelcomeModal open={showWelcome} onClose={dismissWelcome} />
      <SharePromptModal
        open={showShareModal}
        sessionId={clientSessionId}
        stats={shareSessionStats}
        preGeneratedImageUrl={shareGeneratedCards.length > 0 ? shareGeneratedCards[shareGeneratedCards.length - 1].imageUrl : null}
        backgroundImageLoading={shareImageLoading}
        onClose={closeShareModal}
        onShared={onSharePromptShared}
      />

      {/* Feedback (header-triggered, no floating button) */}
      <FeedbackFAB hideButton externalOpen={showFeedback} onExternalClose={() => setShowFeedback(false)} />

      {/* Sign-in modal (when user is not authenticated) */}
      <ConnectModal
        open={showSignInModal}
        onClose={() => {
          setShowSignInModal(false);
          fetch("/api/config")
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              const authenticated = !!data?.isAuthenticated;
              setIsAuthenticated(authenticated);
              if (!authenticated) {
                setAppUser(null);
              } else {
                refreshAppUser();
              }
            })
            .catch(() => {
              setIsAuthenticated(false);
              setAppUser(null);
            });
        }}
      />

      {/* Gate modals (3-tier access) */}
      <SignupGateModal
        open={showSignupGate}
        onClose={() => setShowSignupGate(false)}
        dailyUsed={gateInfo.dailyUsed}
        dailyLimit={gateInfo.dailyLimit}
        authDailyLimit={gateInfo.authDailyLimit}
      />
      <APIKeyGateModal
        open={showApiKeyGate}
        onClose={() => { setShowApiKeyGate(false); setProviderError(null); }}
        onKeyProvided={(provider, key) => {
          setShowApiKeyGate(false);
          setProviderError(null);
          if (provider === "anthropic") {
            setCredentials((prev) => ({ ...prev, claudeApiKey: key }));
          } else {
            setCredentials((prev) => ({ ...prev, openRouterApiKey: key }));
            setAiProvider("openrouter");
          }
          setRateLimitHit(false);
          if (typeof window !== "undefined") localStorage.setItem("keyMode", "byok");
          if (pendingRetry) {
            const retry = pendingRetry;
            setPendingRetry(null);
            setTimeout(() => handleSendRef.current(retry.text, retry.images, retry.files), 300);
          }
        }}
        dailyUsed={gateInfo.dailyUsed}
        dailyLimit={gateInfo.dailyLimit}
        providerError={providerError}
      />
    </div>
  );
}
