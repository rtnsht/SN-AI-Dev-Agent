"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import SettingsPanel from "@/components/SettingsPanel";
import ChatWindow from "@/components/ChatWindow";
import PhaseTracker from "@/components/PhaseTracker";
import type { ChatMessage, ConnectionResult, UsageInfo, SDLCPhase } from "@/lib/types";
import { parsePhaseGate } from "@/lib/types";

export default function Home() {
  const [credentials, setCredentials] = useState({
    instanceUrl: "",
    username: "",
    password: "",
    claudeApiKey: "",
  });
  const [connected, setConnected] = useState(false);
  const [connInfo, setConnInfo] = useState<ConnectionResult | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [serverApiKeyConfigured, setServerApiKeyConfigured] = useState(false);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [rateLimitHit, setRateLimitHit] = useState(false);
  // SDLC phase tracking
  const [activeReqId, setActiveReqId] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<SDLCPhase | null>(null);
  const [completedPhases, setCompletedPhases] = useState<SDLCPhase[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch server config on mount (is a server-side API key configured?)
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        setServerApiKeyConfigured(!!data.serverApiKeyConfigured);
        if (data.usage) setUsage(data.usage);
      })
      .catch(() => {}); // ignore — default to false
  }, []);

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
        });

        // Role check
        if (!data.hasAdmin && !data.hasSecurityAdmin) {
          sysMsgs.push({
            role: "system",
            type: "warning",
            content: `⚠️ **Limited Access** — User \`${credentials.username}\` does not have \`admin\` or \`security_admin\` roles. The agent will only be able to advise and operate based on the access this user has. Some operations (creating business rules, ACLs, modifying system tables) may fail due to insufficient permissions.`,
          });
        } else if (!data.hasAdmin) {
          sysMsgs.push({
            role: "system",
            type: "warning",
            content: `⚠️ **Partial Access** — User \`${credentials.username}\` has \`security_admin\` but not \`admin\` role. Some configuration operations may be restricted.`,
          });
        } else if (!data.hasSecurityAdmin) {
          sysMsgs.push({
            role: "system",
            type: "info",
            content: `ℹ️ User \`${credentials.username}\` has \`admin\` but not \`security_admin\` role. ACL and security policy modifications may require elevated privileges.`,
          });
        } else {
          sysMsgs.push({
            role: "system",
            type: "success",
            content: `✅ Full access — User has both \`admin\` and \`security_admin\` roles.`,
          });
        }

        setMessages((prev) => [...prev, ...sysMsgs]);
        setTimeout(() => inputRef.current?.focus(), 100);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "system", type: "error", content: `Connection failed: ${data.message || "Unknown error"}` },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "system", type: "error", content: `Connection error: ${err instanceof Error ? err.message : String(err)}` },
      ]);
    } finally {
      setIsConnecting(false);
    }
  }, [credentials]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: ChatMessage = { role: "user", content: text };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setIsLoading(true);

      try {
        // Only send user/assistant messages to the API (not system messages)
        const apiMessages = newMessages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credentials, messages: apiMessages }),
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
          if (phaseGate) {
            const nextPhaseMap: Record<string, SDLCPhase> = {
              spec: "design",
              design: "implementation",
              implementation: "testing",
              testing: "deployment",
            };
            // Current phase is the one in the gate (waiting for approval)
            setCurrentPhase(phaseGate);
          }

          // Build assistant message with phase gate info
          const assistantMsg: ChatMessage = {
            role: "assistant",
            content: data.reply,
            toolExecutions: data.toolExecutions,
            phaseGate: phaseGate || undefined,
          };

          const newMsgs: ChatMessage[] = [assistantMsg];
          if (data.usage && data.usage.remaining > 0 && data.usage.remaining <= 2 && serverApiKeyConfigured && !credentials.claudeApiKey) {
            newMsgs.push({
              role: "system",
              type: "warning",
              content: `⏳ **${data.usage.remaining} free request${data.usage.remaining === 1 ? "" : "s"} remaining** out of ${data.usage.max} per ${data.usage.windowHours} hours. Enter your own Claude API key in Settings to continue chatting with no limits.`,
            });
          }
          setMessages((prev) => [...prev, ...newMsgs]);
        } else if (res.status === 429) {
          // Rate limit hit
          setUsage(data.usage);
          setRateLimitHit(true);
          setShowSettings(true); // open sidebar so user can enter key
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              type: "error",
              content: `🚫 **Rate limit reached** — You've used all ${data.usage?.max ?? 10} free requests for this ${data.usage?.windowHours ?? 4}-hour window.\n\nTo continue chatting, **enter your own Claude API key** in the Settings panel on the left. Your key is sent per-request over HTTPS and never stored.`,
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "system", type: "error", content: `Error: ${data.error}` },
          ]);
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { role: "system", type: "error", content: `Network error: ${err instanceof Error ? err.message : String(err)}` },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, credentials, isLoading, serverApiKeyConfigured, activeReqId]
  );

  /** Handle phase gate approval — mark the message as approved and send "approved" to continue */
  const handleApprove = useCallback(
    (phase: SDLCPhase) => {
      // Mark the gate message as approved
      setMessages((prev) =>
        prev.map((m) =>
          m.phaseGate === phase && !m.approved ? { ...m, approved: true } : m
        )
      );

      // Track completed phase and advance to next
      setCompletedPhases((prev) => (prev.includes(phase) ? prev : [...prev, phase]));
      const nextPhaseMap: Record<string, SDLCPhase> = {
        spec: "design",
        design: "implementation",
        implementation: "testing",
        testing: "deployment",
      };
      const next = nextPhaseMap[phase];
      if (next) setCurrentPhase(next);

      // Send approval message to continue the conversation
      const approvalMsg = `approved`;
      // Inject system confirmation
      setMessages((prev) => [
        ...prev,
        { role: "system", type: "success", content: `✅ **${phase.charAt(0).toUpperCase() + phase.slice(1)}** phase approved. Proceeding...` },
      ]);

      // Trigger the next message
      setTimeout(() => handleSend(approvalMsg), 100);
    },
    [handleSend]
  );

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setActiveReqId(null);
    setCurrentPhase(null);
    setCompletedPhases([]);
  }, []);

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <aside
        className={`${
          showSettings ? "w-80" : "w-0"
        } transition-all duration-300 overflow-hidden border-r border-gray-800 bg-gray-900 flex-shrink-0`}
      >
        <SettingsPanel
          credentials={credentials}
          setCredentials={setCredentials}
          connected={connected}
          connInfo={connInfo}
          isConnecting={isConnecting}
          onConnect={handleConnect}
          serverApiKeyConfigured={serverApiKeyConfigured}
          usage={usage}
          rateLimitHit={rateLimitHit}
          onApiKeyProvided={() => setRateLimitHit(false)}
        />
      </aside>

      {/* Main area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              title="Toggle settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold">SN AI Dev Agent</h1>
            {connected && connInfo && (
              <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-400/10 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                {connInfo.userInfo?.name || credentials.username} @ {credentials.instanceUrl.replace(/https?:\/\//, "").replace(/\.service-now\.com\/?$/, "")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <PhaseTracker currentPhase={currentPhase} completedPhases={completedPhases} reqId={activeReqId} />
            {messages.length > 0 && (
              <button
                onClick={handleNewChat}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                New Chat
              </button>
            )}
          </div>
        </header>

        {/* Chat */}
        <ChatWindow
          messages={messages}
          isLoading={isLoading}
          onSend={handleSend}
          onApprove={handleApprove}
          connected={connected}
          inputRef={inputRef}
        />
      </main>
    </div>
  );
}
