"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import SettingsPanel from "@/components/SettingsPanel";
import ChatWindow from "@/components/ChatWindow";
import PhaseTracker from "@/components/PhaseTracker";
import InfoModal from "@/components/InfoModal";
import ThemeToggle from "@/components/ThemeToggle";
import type { ChatMessage, ConnectionResult, UsageInfo, SDLCPhase, LiveStatus, AIProvider, ModelOption, FileAttachment } from "@/lib/types";
import { parsePhaseGate, parseUserChoices, ANTHROPIC_MODELS, SDLC_PHASES, openRouterModelToOption } from "@/lib/types";
import { APP_NAME, APP_LOGO, SHOW_INFO_BUTTON } from "@/lib/branding";

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
  const [showSettings, setShowSettings] = useState(true);
  const [serverApiKeyConfigured, setServerApiKeyConfigured] = useState(false);
  const [serverOpenRouterKeyConfigured, setServerOpenRouterKeyConfigured] = useState(false);
  const [serverSnCredsConfigured, setServerSnCredsConfigured] = useState(false);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [rateLimitHit, setRateLimitHit] = useState(false);
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
  // Live status streaming (controlled via NEXT_PUBLIC_SHOW_LIVE_STATUS env)
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);
  const [streamingEnabled, setStreamingEnabled] = useState(true);
  // Agent activity log — accumulates liveStatus messages for streaming display
  const [activityLog, setActivityLog] = useState<{ message: string; phase: string; timestamp: number; toolName?: string; toolInput?: Record<string, unknown>; done?: boolean }[]>([]);
  // Dynamic example prompts from instance data
  const [instancePrompts, setInstancePrompts] = useState<{ icon: string; text: string; desc: string }[] | null>(null);
  // Persistent session ID for logging - generated once per page load
  const [clientSessionId] = useState(() => `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
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



  // Fetch server config on mount (API key + SN credentials)
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        setServerApiKeyConfigured(!!data.serverApiKeyConfigured);
        setServerOpenRouterKeyConfigured(!!data.serverOpenRouterKeyConfigured);
        if (data.usage) setUsage(data.usage);

        // Tool detail visibility
        if (typeof data.showToolDetails === "boolean") setShowToolDetails(data.showToolDetails);
        // Live status visibility (what the agent is doing)
        if (typeof data.showLiveStatus === "boolean") setStreamingEnabled(data.showLiveStatus);
        // User API key control
        if (typeof data.allowUserApiKeys === "boolean") setAllowUserApiKeys(data.allowUserApiKeys);

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
      const data: ConnectionResult = await res.json();
      if (data.success) {
        setConnected(true);
        setConnInfo(data);
        setShowSettings(false);

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
        }).catch(() => { /* non-critical */ });

        // Fetch instance-specific example prompts in background (non-blocking)
        fetch("/api/instance-prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instanceUrl: credentials.instanceUrl,
            username: credentials.username,
            password: credentials.password,
          }),
        })
          .then((r) => r.json())
          .then((d) => { if (d.prompts?.length) setInstancePrompts(d.prompts); })
          .catch(() => { /* non-critical — defaults will be used */ });
      } else {
        const errMsgs = [...messagesRef.current, { role: "system" as const, type: "error" as const, content: `Connection failed: ${data.message || "Unknown error"}`, timestamp: new Date().toISOString() }];
        messagesRef.current = errMsgs;
        setMessages(errMsgs);
      }
    } catch (err) {
      const errMsgs = [...messagesRef.current, { role: "system" as const, type: "error" as const, content: `Connection error: ${err instanceof Error ? err.message : String(err)}`, timestamp: new Date().toISOString() }];
      messagesRef.current = errMsgs;
      setMessages(errMsgs);
    } finally {
      setIsConnecting(false);
    }
  }, [credentials]);

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
          setLiveStatus({ message: "Starting...", phase: "thinking" });

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
              if (errorData.error === "anthropic_rate_limit") {
                if (allowUserApiKeys) {
                  setPendingRetry({ text, images, files });
                  setRateLimitHit(true);
                  setShowSettings(true);
                }
                setMessages((prev) => [
                  ...prev,
                  {
                    role: "system",
                    type: "error",
                    content: allowUserApiKeys
                      ? `**API rate limit hit** -- The server's Claude API key hit its token limit. Enter your own API key in Settings to continue. Your conversation is preserved and will auto-retry.`
                      : `**API rate limit hit** -- The server's Claude API key hit its token limit. Please try again later.`,
                    timestamp: new Date().toISOString(),
                  },
                ]);
              } else {
                // App-level rate limit (request count)
                setUsage(errorData.usage);
                if (allowUserApiKeys) {
                  setRateLimitHit(true);
                  setShowSettings(true);
                }
                setMessages((prev) => [
                  ...prev,
                  {
                    role: "system",
                    type: "error",
                    content: allowUserApiKeys
                      ? `**Rate limit reached** -- You've used all ${errorData.usage?.max ?? 10} free requests for this ${errorData.usage?.windowHours ?? 4}-hour window.\n\nTo continue chatting, **enter your own API key** in the Settings panel on the left. Your key is sent per-request over HTTPS and never stored.`
                      : `**Rate limit reached** -- You've used all ${errorData.usage?.max ?? 10} requests for this ${errorData.usage?.windowHours ?? 4}-hour window. Please try again later.`,
                    timestamp: new Date().toISOString(),
                  },
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
                        const entry = { message: event.toolName, phase: "tool", timestamp: Date.now(), toolName: event.toolName, toolInput, done: false };
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

          if (data.usage && data.usage.remaining > 0 && data.usage.remaining <= 2 && serverApiKeyConfigured && !credentials.claudeApiKey) {
            newMsgs.push({
              role: "system",
              type: "warning",
              content: allowUserApiKeys
                ? `⏳ **${data.usage.remaining} free request${data.usage.remaining === 1 ? "" : "s"} remaining** out of ${data.usage.max} per ${data.usage.windowHours} hours. Enter your own Claude API key in Settings to continue chatting with no limits.`
                : `⏳ **${data.usage.remaining} request${data.usage.remaining === 1 ? "" : "s"} remaining** out of ${data.usage.max} per ${data.usage.windowHours} hours.`,
              timestamp: new Date().toISOString(),
            });
          }
          // Update both state and ref together before potential auto-approve setTimeout
          const updatedMsgs = [...messagesRef.current, ...newMsgs];
          messagesRef.current = updatedMsgs;
          setMessages(updatedMsgs);

          // Auto-send "approved" for phases that don't require user sign-off
          if (isAutoApprove && phaseGate) {
            setTimeout(() => handleSendRef.current("approved"), 100);
          }
        } else if (res.status === 429) {
          if (data.error === "anthropic_rate_limit") {
            // Anthropic token limit
            if (allowUserApiKeys) {
              setPendingRetry({ text, images, files });
              setRateLimitHit(true);
              setShowSettings(true);
            }
            setMessages((prev) => [
              ...prev,
              {
                role: "system",
                type: "error",
                content: allowUserApiKeys
                  ? `🔑 **API rate limit hit** — The server's Claude API key hit its token limit. Enter your own API key in Settings to continue. Your conversation is preserved and will auto-retry.`
                  : `🔑 **API rate limit hit** — The server's Claude API key hit its token limit. Please try again later.`,
                timestamp: new Date().toISOString(),
              },
            ]);
          } else {
            // App-level rate limit (request count)
            setUsage(data.usage);
            if (allowUserApiKeys) {
              setRateLimitHit(true);
              setShowSettings(true);
            }
            setMessages((prev) => [
              ...prev,
              {
                role: "system",
                type: "error",
                content: allowUserApiKeys
                  ? `🚫 **Rate limit reached** — You've used all ${data.usage?.max ?? 10} free requests for this ${data.usage?.windowHours ?? 4}-hour window.\n\nTo continue chatting, **enter your own Claude API key** in the Settings panel on the left. Your key is sent per-request over HTTPS and never stored.`
                  : `🚫 **Rate limit reached** — You've used all ${data.usage?.max ?? 10} requests for this ${data.usage?.windowHours ?? 4}-hour window. Please try again later.`,
                timestamp: new Date().toISOString(),
              },
            ]);
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
    [credentials, isLoading, serverApiKeyConfigured, activeReqId, selectedModel, modelLocked, pendingRetry, allowUserApiKeys, streamingEnabled]
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
    messagesRef.current = [];
    setMessages([]);
    setActiveReqId(null);
    setCurrentPhase(null);
    setCompletedPhases([]);
    setModelLocked(false);
    setPendingRetry(null);
    setActivityLog([]);
  }, []);

  /** Disconnect and unlock fields so user can edit before reconnecting */
  const handleReconnect = useCallback(() => {
    setConnected(false);
    setConnInfo(null);
    setModelLocked(false);
    setInstancePrompts(null);
    // Keep credentials, messages, and chat state intact so user can modify fields and reconnect
  }, []);

  /** Download entire conversation as a markdown file with embedded images */
  const handleDownloadConversation = useCallback(() => {
    const lines: string[] = [];

    // Header
    const now = new Date();
    lines.push(`# ${APP_NAME} — Conversation Export`);
    lines.push("");
    lines.push(`**Date:** ${now.toLocaleString()}`);
    if (connected && connInfo?.userInfo) {
      lines.push(`**User:** ${connInfo.userInfo.name} (${credentials.username})`);
      lines.push(`**Instance:** ${credentials.instanceUrl}`);
    }
    const currentModels = aiProvider === "openrouter" ? openRouterModels : ANTHROPIC_MODELS;
    const modelLabel = currentModels.find((m) => m.key === selectedModel)?.label || selectedModel;
    lines.push(`**Model:** ${modelLabel}`);
    lines.push("");
    lines.push("---");
    lines.push("");

    for (const msg of messages) {
      if (msg.role === "system") {
        lines.push(`> **System:** ${msg.content}`);
        lines.push("");
      } else if (msg.role === "user") {
        lines.push("## 🧑 User");
        lines.push("");
        // Embedded images
        if (msg.images && msg.images.length > 0) {
          for (const img of msg.images) {
            lines.push(`![User attachment](${img})`);
            lines.push("");
          }
        }
        if (msg.content) {
          lines.push(msg.content);
          lines.push("");
        }
      } else {
        lines.push("## 🤖 Assistant");
        lines.push("");
        lines.push(msg.content);
        lines.push("");
        // Tool executions
        if (msg.toolExecutions && msg.toolExecutions.length > 0) {
          lines.push(`<details><summary>🔧 ${msg.toolExecutions.length} tool${msg.toolExecutions.length > 1 ? "s" : ""} executed</summary>`);
          lines.push("");
          for (const exec of msg.toolExecutions) {
            lines.push(`### ${exec.toolName} (${exec.durationMs}ms)`);
            lines.push("");
            lines.push("**Input:**");
            lines.push("```json");
            lines.push(JSON.stringify(exec.input, null, 2));
            lines.push("```");
            lines.push("**Output:**");
            lines.push("```json");
            lines.push(typeof exec.output === "string" ? exec.output : JSON.stringify(exec.output, null, 2));
            lines.push("```");
            lines.push("");
          }
          lines.push("</details>");
          lines.push("");
        }
      }
      lines.push("---");
      lines.push("");
    }

    const md = lines.join("\n");
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${APP_NAME.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-conversation-${now.toISOString().slice(0, 19).replace(/[T:]/g, "-")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [messages, connected, connInfo, credentials, selectedModel]);

  return (
    <div className="flex h-screen relative" style={{ background: "var(--surface-app)", color: "var(--text-primary)" }}>
      {/* Mobile backdrop */}
      {showSettings && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setShowSettings(false)}
        />
      )}

      {/* ═══ Left Sidebar — Navigation / Settings ═══ */}
      <aside
        className={`${
          showSettings ? "w-80 xl:w-[22rem] translate-x-0" : "w-0 -translate-x-full md:translate-x-0"
        } fixed md:static inset-y-0 left-0 z-40 md:z-auto transition-all duration-300 overflow-hidden flex-shrink-0`}
        style={{ background: "var(--surface-sidebar)", borderRight: "1px solid var(--border-default)" }}
      >
        <SettingsPanel
          credentials={credentials}
          setCredentials={setCredentials}
          connected={connected}
          connInfo={connInfo}
          isConnecting={isConnecting}
          onConnect={handleConnect}
          onReconnect={handleReconnect}
          serverApiKeyConfigured={serverApiKeyConfigured}
          serverOpenRouterKeyConfigured={serverOpenRouterKeyConfigured}
          serverSnCredsConfigured={serverSnCredsConfigured}
          usage={usage}
          rateLimitHit={rateLimitHit}
          onApiKeyProvided={() => {
            setRateLimitHit(false);
            if (pendingRetry) {
              const retry = pendingRetry;
              setPendingRetry(null);
              setTimeout(() => handleSendRef.current(retry.text, retry.images, retry.files), 150);
            }
          }}
          aiProvider={aiProvider}
          setAiProvider={setAiProvider}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          modelOptions={openRouterModels}
          modelsLoading={modelsLoading}
          modelLocked={modelLocked}
          allowUserApiKeys={allowUserApiKeys}
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            {/* App identity */}
            <Image src={APP_LOGO} alt={APP_NAME} width={32} height={32} className="rounded-md flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8" unoptimized />
            <div className="min-w-0">
              <h1 className="text-sm sm:text-[15px] font-semibold truncate" style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{APP_NAME}</h1>
            </div>

            {SHOW_INFO_BUTTON && (
              <button
                onClick={() => setShowInfo(true)}
                className="p-1.5 rounded-md transition-colors flex-shrink-0"
                style={{ color: "var(--text-disabled)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-elevated)"; e.currentTarget.style.color = "var(--color-info)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-disabled)"; }}
                title="About this app"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </button>
            )}

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
            <PhaseTracker currentPhase={currentPhase} completedPhases={completedPhases} reqId={activeReqId} />
            {messages.length > 0 && (
              <>
                <button
                  onClick={handleDownloadConversation}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors"
                  style={{ background: "var(--surface-secondary)", color: "var(--text-secondary)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-elevated)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "var(--surface-secondary)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                  title="Download conversation as Markdown"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  <span className="hidden sm:inline">Export</span>
                </button>
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
              </>
            )}
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
          instancePrompts={instancePrompts ?? undefined}
          activityLog={activityLog}
        />
      </main>

      {/* ═══ Right Panel — Metadata / Status (visible when connected + has context) ═══ */}
      {connected && (currentPhase || completedPhases.length > 0 || messages.length > 2) && (
        <aside
          className="hidden lg:flex flex-col w-72 xl:w-80 flex-shrink-0 overflow-y-auto"
          style={{ background: "var(--surface-primary)", borderLeft: "1px solid var(--border-default)" }}
        >
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


          </div>
        </aside>
      )}

      {/* Info modal */}
      <InfoModal open={showInfo} onClose={() => setShowInfo(false)} />
    </div>
  );
}
