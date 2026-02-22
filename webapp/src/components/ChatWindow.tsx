"use client";

import { useState, useRef, useEffect, type RefObject } from "react";
import type { ChatMessage, SDLCPhase } from "@/lib/types";
import MessageBubble from "./MessageBubble";

const EXAMPLE_PROMPTS = [
  { icon: "🏗️", text: "Build a high-priority incident justification feature that requires managers to provide a business reason when setting incident priority to P1", desc: "Full SDLC requirement" },
  { icon: "📦", text: "Create a catalog item for requesting a new laptop with approval workflow", desc: "Full SDLC requirement" },
  { icon: "🔍", text: "Analyze my instance health and show me any anti-patterns", desc: "Instance analysis" },
  { icon: "📊", text: "List all custom business rules on the incident table", desc: "Quick query" },
];

interface Props {
  messages: ChatMessage[];
  isLoading: boolean;
  onSend: (text: string) => void;
  onApprove: (phase: SDLCPhase) => void;
  connected: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}

export default function ChatWindow({ messages, isLoading, onSend, onApprove, connected, inputRef }: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const showEmptyState = messages.length === 0;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {showEmptyState && (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center max-w-lg">
              <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-2xl flex items-center justify-center">
                <span className="text-3xl">⚡</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-200 mb-2">
                ServiceNow AI Dev Agent
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                {connected
                  ? "You're connected! Ask me anything — query records, create scripts, analyze code quality, manage update sets, and more."
                  : "Connect to your ServiceNow instance using the settings panel, then start chatting."}
              </p>
              {connected && (
                <div className="grid grid-cols-2 gap-2">
                  {EXAMPLE_PROMPTS.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => onSend(p.text)}
                      className="text-left p-3 rounded-xl bg-gray-800/50 border border-gray-800 hover:border-gray-600 hover:bg-gray-800 transition-all group"
                    >
                      <span className="text-lg">{p.icon}</span>
                      <p className="text-xs text-gray-300 mt-1 group-hover:text-gray-100 transition-colors">{p.text}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">{p.desc}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} onApprove={onApprove} />
        ))}

        {isLoading && (
          <div className="flex items-start gap-3 max-w-3xl mx-auto">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
              AI
            </div>
            <div className="bg-gray-800/80 rounded-2xl rounded-tl-sm px-4 py-3 border border-gray-700/50">
              <div className="flex items-center gap-1.5 text-sm text-gray-400">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="ml-2 text-xs text-gray-500">Thinking & executing tools...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 p-4 bg-gray-900/50">
        <div className="max-w-3xl mx-auto flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={connected ? "Ask me anything about your ServiceNow instance..." : "Connect first →"}
            disabled={!connected || isLoading}
            rows={1}
            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none"
          />
          <button
            onClick={handleSubmit}
            disabled={!connected || isLoading || !input.trim()}
            className="px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-gray-600 text-center mt-2">Press Enter to send, Shift+Enter for new line</p>
      </div>
    </div>
  );
}

