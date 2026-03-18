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
import ThemeToggle from "@/components/ThemeToggle";
import SuggestionPanel from "@/components/SuggestionPanel";
import type { ChatMessage, ConnectionResult, UsageInfo, TrialStatus, SDLCPhase, LiveStatus, AIProvider, ModelOption, FileAttachment, CategorizedPrompts } from "@/lib/types";
import { parsePhaseGate, parseUserChoices, ANTHROPIC_MODELS, SDLC_PHASES, openRouterModelToOption } from "@/lib/types";
import { APP_NAME, APP_LOGO, SHOW_INFO_BUTTON, CREATOR_NAME, CREATOR_LINKEDIN, FOOTER_TAGLINE, FOOTER_COPYRIGHT } from "@/lib/branding";
import { Menu, User } from "lucide-react";

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
} as const;

const ALL_SESSION_KEYS = Object.values(SK);

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
  if (lower.includes("enotfound"))
    return "Instance not found. Please check that the URL is correct (e.g., https://your-instance.service-now.com) and try again.";
  if (lower.includes("econnrefused"))
    return "Connection refused. The instance may be down or the URL may be incorrect. Please verify and try again.";
  if (lower.includes("etimedout") || lower.includes("econnaborted") || lower.includes("timeout"))
    return "Connection timed out. The instance may be hibernating or unreachable. Try opening it in your browser first, then reconnect.";
  if (lower.includes("econnreset") || lower.includes("socket hang up"))
    return "Connection was reset unexpectedly. Please try again.";
  if (lower.includes("login page") || lower.includes("redirect"))
    return "Authentication failed. The server redirected to a login page instead of responding to the API request. Please check your username and password, then reconnect.";
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

export default function Home() {
  const [credentials, setCredentials] = useState({
    instanceUrl: "",
    username: "",
    password: "",
    claudeApiKey: "",
    openRouterApiKey: "",
  });
  const [connected, setConnected] = useState(false);
  const [connInfo, setConnInfo] = useState<ConnectionResult | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [leftWidth, setLeftWidth] = useState(320);
  const [rightWidth, setRightWidth] = useState(288);
  const isResizingLeft = useRef(false);
  const isResizingRight = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [serverApiKeyConfigured, setServerApiKeyConfigured] = useState(false);
  const [serverOpenRouterKeyConfigured, setServerOpenRouterKeyConfigured] = useState(false);
  const [serverSnCredsConfigured, setServerSnCredsConfigured] = useState(false);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [rateLimitHit, setRateLimitHit] = useState(false);
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  // Pending retry — stores the failed message so it can be auto-retried after user provides an API key
  const [pendingRetry, setPendingRetry] = useState<{ text: string; images?: string[]; files?: FileAttachment[] } | null>(null);
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
  // Mobile two-step flow: 'hero' = landing page, 'connect' = full-screen connection panel
  const [mobileStep, setMobileStep] = useState<"hero" | "connect">("hero");
  // Logged-in webapp user info (name, role) from /api/auth/me
  const [appUser, setAppUser] = useState<{ name: string; email: string; role: string } | null>(null);
  // Profile dropdown
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
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

  // Keep messagesRef in sync with messages state (for use in callbacks that need latest messages)
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Clear connection error when user edits credentials
  useEffect(() => {
    setConnectionError(null);
  }, [credentials.instanceUrl, credentials.username, credentials.password]);

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
        const { instanceUrl, username } = JSON.parse(savedCreds);
        setCredentials((prev) => ({ ...prev, instanceUrl: instanceUrl || prev.instanceUrl, username: username || prev.username }));
      }

      // Restore model/provider
      const savedProvider = sessionStorage.getItem(SK.PROVIDER);
      if (savedProvider) setAiProvider(savedProvider as AIProvider);
      const savedModel = sessionStorage.getItem(SK.MODEL);
      if (savedModel) setSelectedModel(savedModel);
      const savedLocked = sessionStorage.getItem(SK.MODEL_LOCKED);
      if (savedLocked === "true") setModelLocked(true);

      // Restore SDLC phases
      const savedReqId = sessionStorage.getItem(SK.REQ_ID);
      if (savedReqId) setActiveReqId(savedReqId);
      const savedPhase = sessionStorage.getItem(SK.PHASE);
      if (savedPhase) setCurrentPhase(savedPhase as SDLCPhase);
      const savedCompleted = sessionStorage.getItem(SK.COMPLETED_PHASES);
      if (savedCompleted) setCompletedPhases(JSON.parse(savedCompleted));

      // Show settings panel so user can re-enter password
      setShowSettings(true);
      setSessionRestored(true);

      // Inject a restore notice
      const notice: ChatMessage = {
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

  // ── Fetch trial status ──
  useEffect(() => {
    fetch("/api/trial-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setTrialStatus(data); })
      .catch(() => {});
  }, []);

  // ── Fetch logged-in webapp user info ──
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setAppUser(data); })
      .catch(() => {});
  }, []);

  // ── Persist state to sessionStorage on change ──
  useEffect(() => {
    try { sessionStorage.setItem(SK.MESSAGES, JSON.stringify(stripHeavyData(messages))); } catch { /* quota */ }
  }, [messages]);
  useEffect(() => {
    try { if (connInfo) sessionStorage.setItem(SK.CONN_INFO, JSON.stringify(connInfo)); } catch { /* quota */ }
  }, [connInfo]);
  useEffect(() => {
    try { sessionStorage.setItem(SK.CREDS, JSON.stringify({ instanceUrl: credentials.instanceUrl, username: credentials.username })); } catch { /* quota */ }
  }, [credentials.instanceUrl, credentials.username]);
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

  // Reset model selection when switching providers
  useEffect(() => {
    if (modelLocked) return; // Don't reset if locked
    if (aiProvider === "anthropic") {
      setSelectedModel("sonnet-4");
    } else if (aiProvider === "openrouter" && openRouterModels.length > 0) {
      // Pick a good default - prefer Claude models on OpenRouter
      const claudeModel = openRouterModels.find(m => m.key.includes("claude"));
      setSelectedModel(claudeModel?.key || openRouterModels[0].key);
    }
  }, [aiProvider, modelLocked, openRouterModels]);

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    setConnectionError(null);
    try {
      const res = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceUrl: credentials.instanceUrl,
          username: credentials.username,
          password: credentials.password,
        }),
      });

      // Handle HTTP-level errors (e.g., 400, 500) before parsing JSON
      if (!res.ok) {
        let errorData: { message?: string } | null = null;
        try { errorData = await res.json(); } catch { /* response may not be JSON */ }
        const rawMsg = errorData?.message || `Server returned status ${res.status}`;
        const friendly = getFriendlyErrorMessage(rawMsg);
        setConnectionError(friendly);
        const errMsgs = [...messagesRef.current, { role: "system" as const, type: "error" as const, content: `Connection failed: ${friendly}`, timestamp: new Date().toISOString() }];
        messagesRef.current = errMsgs;
        setMessages(errMsgs);
        setIsConnecting(false);
        return;
      }

      const data: ConnectionResult = await res.json();

      // Handle no-roles: block connection and show error with reconnect guidance
      if (data.success && data.noRoles) {
        const noRolesMsg = "This user does not have any roles assigned on this instance. Please assign the required roles (e.g., admin, itil) and reconnect.";
        setConnectionError(noRolesMsg);
        const errMsgs = [...messagesRef.current, { role: "system" as const, type: "error" as const, content: `Connection failed: ${noRolesMsg}`, timestamp: new Date().toISOString() }];
        messagesRef.current = errMsgs;
        setMessages(errMsgs);
        setIsConnecting(false);
        return;
      }

      if (data.success) {
        setConnected(true);
        setConnInfo(data);
        setShowSettings(false);
        setMobileStep("hero"); // dismiss mobile full-screen connection panel

        // Inject system messages into chat
        const sysMsgs: ChatMessage[] = [];

        const instanceShort = credentials.instanceUrl.replace(/https?:\/\//, "").replace(/\/$/, "");
        sysMsgs.push({
          role: "system",
          type: "success",
          content: `Connected to **${instanceShort}** as **${data.userInfo?.name || credentials.username}**`,
          timestamp: new Date().toISOString(),
        });

        // Role check
        if (!data.hasAdmin && !data.hasSecurityAdmin) {
          sysMsgs.push({
            role: "system",
            type: "warning",
            content: `⚠️ **Limited Access** — User \`${credentials.username}\` does not have \`admin\` or \`security_admin\` roles. The agent will only be able to advise and operate based on the access this user has. Some operations (creating business rules, ACLs, modifying system tables) may fail due to insufficient permissions.`,
            timestamp: new Date().toISOString(),
          });
        } else if (!data.hasAdmin) {
          sysMsgs.push({
            role: "system",
            type: "warning",
            content: `⚠️ **Partial Access** — User \`${credentials.username}\` has \`security_admin\` but not \`admin\` role. Some configuration operations may be restricted.`,
            timestamp: new Date().toISOString(),
          });
        } else if (!data.hasSecurityAdmin) {
          sysMsgs.push({
            role: "system",
            type: "info",
            content: `ℹ️ User \`${credentials.username}\` has \`admin\` but not \`security_admin\` role. ACL and security policy modifications may require elevated privileges.`,
            timestamp: new Date().toISOString(),
          });
        } else {
          sysMsgs.push({
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

        // Log session start with connect metadata (non-blocking, fire-and-forget)
        fetch("/api/session-start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: clientSessionId,
            instanceUrl: credentials.instanceUrl,
            username: credentials.username,
            userFullName: data.userInfo?.name || "",
            model: selectedModel,
            aiProvider,
            hasAdmin: data.hasAdmin,
            hasSecurityAdmin: data.hasSecurityAdmin,
          }),
        }).catch((err) => { console.warn("[session-start] failed:", err); });

        // Fetch categorized instance prompts in background (non-blocking)
        const userContext = data.userInfo?.sysId
          ? {
              sysId: data.userInfo.sysId,
              roles: data.roles || [],
              assignmentGroups: data.userInfo.assignmentGroups || [],
            }
          : undefined;
        fetchCategorizedPromptsFromApi(credentials, userContext);
      } else {
        const rawMsg = data.message || "Unknown error";
        const friendly = getFriendlyErrorMessage(rawMsg);
        setConnectionError(friendly);
        const errMsgs = [...messagesRef.current, { role: "system" as const, type: "error" as const, content: `Connection failed: ${friendly}`, timestamp: new Date().toISOString() }];
        messagesRef.current = errMsgs;
        setMessages(errMsgs);
      }
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const friendly = getFriendlyErrorMessage(rawMsg);
      setConnectionError(friendly);
      const errMsgs = [...messagesRef.current, { role: "system" as const, type: "error" as const, content: `Connection failed: ${friendly}`, timestamp: new Date().toISOString() }];
      messagesRef.current = errMsgs;
      setMessages(errMsgs);
    } finally {
      setIsConnecting(false);
    }
  }, [credentials, clientSessionId]);

  const handleSend = useCallback(
    async (text: string, images?: string[], files?: FileAttachment[], hidden?: boolean) => {
      if ((!text.trim() && (!images || images.length === 0) && (!files || files.length === 0)) || isLoading) return;

      // Clear any pending retry — user is sending a new/retried message
      if (pendingRetry) setPendingRetry(null);

      const userMsg: ChatMessage = {
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
          setMessages((prev) => [...prev, { role: "system", type: "error", content: "Internal error: No messages to send. Please try again.", timestamp: new Date().toISOString() }]);
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
            body: JSON.stringify({ credentials, messages: apiMessages, model: modelId, aiProvider, sessionId: clientSessionId, phase: currentPhase }),
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
                  { role: "system", type: "error", content: errorData.message || "Free request limit reached. Sign up to continue.", timestamp: new Date().toISOString() },
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
                  { role: "system", type: "error", content: errorData.message || "Daily limit reached. Add your API key to continue.", timestamp: new Date().toISOString() },
                ]);
              } else if (errorData.error === "anthropic_rate_limit") {
                if (allowUserApiKeys) {
                  setPendingRetry({ text, images, files });
                  setShowApiKeyGate(true);
                }
                setMessages((prev) => [
                  ...prev,
                  {
                    role: "system",
                    type: "error",
                    content: allowUserApiKeys
                      ? `**API rate limit hit** -- The server's Claude API key hit its token limit. Add your own API key to continue.`
                      : `**API rate limit hit** -- Please try again later.`,
                    timestamp: new Date().toISOString(),
                  },
                ]);
              } else {
                // Generic rate limit
                setMessages((prev) => [
                  ...prev,
                  { role: "system", type: "error", content: errorData.message || "Rate limit reached. Please try again later.", timestamp: new Date().toISOString() },
                ]);
              }
            } else {
              setMessages((prev) => [...prev, { role: "system", type: "error", content: `Error: ${errorData.error || errorData.message || "Request failed"}`, timestamp: new Date().toISOString() }]);
            }

            setIsLoading(false);
            return;
          }

          const reader = res.body?.getReader();
          if (!reader) {
            setLiveStatus(null);
            setMessages((prev) => [...prev, { role: "system", type: "error", content: "Streaming not supported", timestamp: new Date().toISOString() }]);
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
                      // OpenRouter rate limit -- provide actionable guidance
                      if (typeof event.message === "string" && event.message.startsWith("openrouter_rate_limit|")) {
                        const parts = event.message.split("|");
                        const rateLimitedModel = parts[1] || "the selected model";
                        errorContent = `**Rate limited** -- The model \`${rateLimitedModel}\` is temporarily rate-limited by its upstream provider after multiple retry attempts.\n\n**What you can do:**\n- **Switch to a different model** from the model selector\n- **Wait a few minutes** and try again\n- **Add your own API key** on [OpenRouter](https://openrouter.ai/settings/integrations) for higher limits`;
                      }
                      setMessages((prev) => [...prev, { role: "system", type: "error", content: errorContent, timestamp: new Date().toISOString() }]);
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
            setMessages((prev) => [...prev, { role: "system", type: "error", content: "No response received from streaming API", timestamp: new Date().toISOString() }]);
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
          body: JSON.stringify({ credentials, messages: apiMessages, model: modelId, aiProvider, sessionId: clientSessionId, phase: currentPhase }),
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
            setMessages((prev) => [...prev, { role: "system", type: "error", content: data.message || "Free request limit reached. Sign up to continue.", timestamp: new Date().toISOString() }]);
          } else if (data.error === "apikey_required") {
            setPendingRetry({ text, images, files });
            setGateInfo((prev) => ({ ...prev, dailyUsed: data.dailyUsed ?? prev.dailyUsed, dailyLimit: data.dailyLimit ?? prev.dailyLimit }));
            setShowApiKeyGate(true);
            setMessages((prev) => [...prev, { role: "system", type: "error", content: data.message || "Daily limit reached. Add your API key to continue.", timestamp: new Date().toISOString() }]);
          } else if (data.error === "anthropic_rate_limit") {
            if (allowUserApiKeys) { setPendingRetry({ text, images, files }); setShowApiKeyGate(true); }
            setMessages((prev) => [...prev, { role: "system", type: "error", content: allowUserApiKeys ? "**API rate limit hit** -- Add your own API key to continue." : "**API rate limit hit** -- Please try again later.", timestamp: new Date().toISOString() }]);
          } else {
            setMessages((prev) => [...prev, { role: "system", type: "error", content: data.message || "Rate limit reached. Please try again later.", timestamp: new Date().toISOString() }]);
          }
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "system", type: "error", content: `Error: ${data.error}`, timestamp: new Date().toISOString() },
          ]);
        }
      } catch (err) {
        // Don't show error for user-initiated cancellation
        if (err instanceof DOMException && err.name === "AbortError") {
          setMessages((prev) => [
            ...prev,
            { role: "system", type: "info", content: "⏹ Request cancelled.", timestamp: new Date().toISOString() },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "system", type: "error", content: `Network error: ${err instanceof Error ? err.message : String(err)}`, timestamp: new Date().toISOString() },
          ]);
        }
      } finally {
        abortRef.current = null;
        setIsLoading(false);
      }
    },
    [credentials, isLoading, serverApiKeyConfigured, activeReqId, selectedModel, modelLocked, pendingRetry, allowUserApiKeys, streamingEnabled, currentPhase, clientSessionId]
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
        { role: "system" as const, type: "success" as const, content: `✅ **${phase.charAt(0).toUpperCase() + phase.slice(1)}** phase approved. Proceeding...`, timestamp: new Date().toISOString() },
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
    setModelLocked(false);
    setPendingRetry(null);
    setActivityLog([]);
    setTaskPlan(null);
    // Clear persisted session state
    ALL_SESSION_KEYS.forEach((k) => sessionStorage.removeItem(k));

    // Generate a fresh session ID for the new chat
    const newId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setClientSessionId(newId);
    try { sessionStorage.setItem(SK.SESSION_ID, newId); } catch { /* quota */ }
  }, [clientSessionId]);

  /** Fetch categorized prompts from the API (used on connect + auto-refresh) */
  const fetchCategorizedPromptsFromApi = useCallback(
    (creds: typeof credentials, userCtx?: { sysId: string; roles: string[]; assignmentGroups: { sysId: string; name: string }[] }) => {
      setPromptsRefreshing(true);
      fetch("/api/instance-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceUrl: creds.instanceUrl,
          username: creds.username,
          password: creds.password,
          userContext: userCtx,
        }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.prompts && typeof d.prompts === "object" && d.prompts.foryou) {
            setCategorizedPrompts(d.prompts);
            setPromptsLastRefreshed(Date.now());
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
    setConnected(false);
    setConnInfo(null);
    setModelLocked(false);
    setCategorizedPrompts(null);
    setPromptsLastRefreshed(null);
  }, []);


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
    credentials, setCredentials, connected, connInfo, isConnecting, connectionError,
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
        {/* Header bar */}
        <header
          className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-2.5 sm:py-3"
          style={{ background: "var(--surface-primary)", borderBottom: "1px solid var(--border-default)" }}
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Sidebar toggle */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-md transition-colors flex-shrink-0"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-elevated)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              title="Toggle settings (Cmd+1)"
            >
              <Menu className="w-5 h-5" strokeWidth={1.5} />
            </button>

            {/* App identity */}
            <Image src={APP_LOGO} alt={APP_NAME} width={32} height={32} className="rounded-md flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8" unoptimized />
            <div className="min-w-0">
              <h1 className="text-sm sm:text-[15px] font-semibold truncate" style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{APP_NAME}</h1>
            </div>

            {/* Dark/Light mode toggle */}
            <ThemeToggle />

            {/* Connection badge */}
            {connected && connInfo && (
              <span
                className="hidden sm:flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md"
                style={{ background: "rgba(56,201,118,0.08)", color: "var(--color-success)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--status-success)", animation: "statusPulse 2s ease-in-out infinite" }} />
                {connInfo.userInfo?.name || credentials.username} @ {credentials.instanceUrl.replace(/https?:\/\//, "").replace(/\.service-now\.com\/?$/, "")}
              </span>
            )}
            {connected && connInfo && (
              <span className="sm:hidden w-2 h-2 rounded-full flex-shrink-0" style={{ background: "var(--status-success)" }} title={`${connInfo.userInfo?.name || credentials.username} @ ${credentials.instanceUrl}`} />
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {SHOW_INFO_BUTTON && (
              <button
                onClick={() => setShowInfo(true)}
                className="flex items-center justify-center w-8 h-8 rounded-md transition-colors"
                style={{ color: "var(--text-secondary)" }}
                title="How SN AI Agent works"
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-secondary)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </button>
            )}
            <PhaseTracker currentPhase={currentPhase} completedPhases={completedPhases} reqId={activeReqId} />
            {messages.length > 0 && (
                <button
                  onClick={handleNewChat}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors"
                  style={{ background: "var(--surface-secondary)", color: "var(--text-secondary)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-elevated)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "var(--surface-secondary)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  <span className="hidden sm:inline">New Chat</span>
                </button>
            )}
            {/* Right panel toggle */}
            {connected && (
              <button
                onClick={() => setShowRightPanel(!showRightPanel)}
                className="p-2 rounded-md transition-colors flex-shrink-0"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-elevated)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                title={showRightPanel ? "Hide suggestions panel" : "Show suggestions panel"}
              >
                <Menu className="w-5 h-5" strokeWidth={1.5} />
              </button>
            )}
            {/* Profile avatar + dropdown */}
            <div ref={profileRef} className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center justify-center rounded-full transition-opacity hover:opacity-80"
                style={{ width: 30, height: 30, background: "var(--color-primary)", color: "#fff", fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}
                title={appUser?.name || "Profile"}
              >
                {appUser?.name ? appUser.name.charAt(0).toUpperCase() : (
                  <User className="w-4 h-4" strokeWidth={2} />
                )}
              </button>
              {profileOpen && (
                <div
                  className="absolute right-0 mt-1.5 rounded-lg overflow-hidden shadow-lg"
                  style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-default)", minWidth: 210, zIndex: 50 }}
                >
                  {/* User info */}
                  {appUser && (
                    <div className="px-3.5 py-3" style={{ borderBottom: "1px solid var(--border-default)" }}>
                      <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{appUser.name}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: "var(--text-disabled)" }}>{appUser.email}</div>
                    </div>
                  )}
                  {/* Menu items */}
                  <div className="py-1">
                    {appUser?.role === "admin" && (
                      <a
                        href="/admin"
                        className="flex items-center gap-2.5 px-3.5 py-2 text-[12px] transition-colors"
                        style={{ color: "var(--text-secondary)" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-secondary)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Admin Dashboard
                      </a>
                    )}
                    <button
                      onClick={() => { setProfileOpen(false); window.location.href = "/clearcache"; }}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-[12px] w-full transition-colors"
                      style={{ color: "var(--text-secondary)" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-secondary)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      Clear cache & refresh
                    </button>
                    <button
                      onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-[12px] w-full transition-colors"
                      style={{ color: "var(--text-secondary)" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-secondary)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ═══ Chat / Center content ═══ */}
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
              <Image src={APP_LOGO} alt={APP_NAME || "Logo"} width={36} height={36} className="rounded-[10px] mx-auto mb-2.5" style={{ objectFit: "contain" }} unoptimized />
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

      {/* Info modal */}
      <InfoModal open={showInfo} onClose={() => setShowInfo(false)} onTryPrompt={(text) => { setShowInfo(false); setTimeout(() => handleSendRef.current(text), 100); }} />
      <WelcomeModal open={showWelcome} onClose={dismissWelcome} />

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
        onClose={() => setShowApiKeyGate(false)}
        onKeyProvided={(provider, key) => {
          setShowApiKeyGate(false);
          if (provider === "anthropic") {
            setCredentials((prev) => ({ ...prev, claudeApiKey: key }));
          } else {
            setCredentials((prev) => ({ ...prev, openRouterApiKey: key }));
            setAiProvider("openrouter");
          }
          setRateLimitHit(false);
          // Auto-retry the pending message
          if (pendingRetry) {
            const retry = pendingRetry;
            setPendingRetry(null);
            setTimeout(() => handleSendRef.current(retry.text, retry.images, retry.files), 300);
          }
        }}
        dailyUsed={gateInfo.dailyUsed}
        dailyLimit={gateInfo.dailyLimit}
      />
    </div>
  );
}
