"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage, ToolExecution, SDLCPhase } from "@/lib/types";
import { stripPhaseGateMarker, SDLC_PHASES } from "@/lib/types";

interface Props {
  message: ChatMessage;
  onApprove?: (phase: SDLCPhase) => void;
}

function ToolExecutionCard({ exec }: { exec: ToolExecution }) {
  const [expanded, setExpanded] = useState(false);
  const isError =
    typeof exec.output === "object" &&
    exec.output !== null &&
    "error" in (exec.output as Record<string, unknown>);

  return (
    <div className="border border-gray-700/50 rounded-lg overflow-hidden text-xs mt-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 bg-gray-800/30 hover:bg-gray-800/60 transition-colors text-left"
      >
        <span className="flex items-center gap-2">
          <span className={`text-[10px] ${isError ? "text-red-400" : "text-green-400"}`}>
            {isError ? "✗" : "✓"}
          </span>
          <span className="font-mono text-gray-400 text-[11px]">{exec.toolName}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-gray-600 text-[10px]">{exec.durationMs}ms</span>
          <svg className={`w-3 h-3 text-gray-600 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </span>
      </button>
      {expanded && (
        <div className="px-3 py-2 space-y-2 bg-gray-900/50 border-t border-gray-700/30">
          <div>
            <span className="text-gray-500 font-medium text-[10px] uppercase">Input</span>
            <pre className="mt-1 p-2 bg-gray-950 rounded text-gray-400 overflow-x-auto max-h-32 overflow-y-auto text-[11px] leading-relaxed">
              {JSON.stringify(exec.input, null, 2)}
            </pre>
          </div>
          <div>
            <span className="text-gray-500 font-medium text-[10px] uppercase">Output</span>
            <pre className="mt-1 p-2 bg-gray-950 rounded text-gray-400 overflow-x-auto max-h-48 overflow-y-auto text-[11px] leading-relaxed">
              {typeof exec.output === "string"
                ? exec.output
                : JSON.stringify(exec.output, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

/* System message banner (connection info, role warnings, errors) */
function SystemMessage({ message }: Props) {
  const typeStyles: Record<string, string> = {
    success: "bg-green-500/10 border-green-500/30 text-green-300",
    warning: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    error: "bg-red-500/10 border-red-500/30 text-red-300",
    info: "bg-blue-500/10 border-blue-500/30 text-blue-300",
  };
  const style = typeStyles[message.type || "info"] || typeStyles.info;

  return (
    <div className={`max-w-3xl mx-auto px-4 py-2.5 rounded-lg border text-xs leading-relaxed ${style}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS_SYSTEM}>
        {message.content}
      </ReactMarkdown>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const MD_COMPONENTS_SYSTEM: Record<string, any> = {
  p: ({ children }: any) => <p className="inline">{children}</p>,
  strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
  code: ({ children }: any) => <code className="px-1 py-0.5 bg-white/10 rounded text-[11px] font-mono">{children}</code>,
};

const MD_COMPONENTS: Record<string, any> = {
  p: ({ children }: any) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }: any) => <strong className="font-semibold text-gray-100">{children}</strong>,
  em: ({ children }: any) => <em className="italic text-gray-300">{children}</em>,
  h1: ({ children }: any) => <h1 className="text-base font-bold mb-2 mt-3 first:mt-0 text-gray-100">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-sm font-bold mb-1.5 mt-2.5 first:mt-0 text-gray-100">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0 text-gray-200">{children}</h3>,
  ul: ({ children }: any) => <ul className="list-disc list-outside ml-4 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal list-outside ml-4 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }: any) => <li className="text-gray-300">{children}</li>,
  code: ({ className, children }: any) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return <code className="block p-3 my-2 bg-gray-950 rounded-lg text-[12px] font-mono text-gray-300 overflow-x-auto">{children}</code>;
    }
    return <code className="px-1.5 py-0.5 bg-gray-700/70 rounded text-[12px] font-mono text-blue-300">{children}</code>;
  },
  pre: ({ children }: any) => <pre className="my-2">{children}</pre>,
  table: ({ children }: any) => <div className="overflow-x-auto my-2"><table className="min-w-full text-xs border-collapse">{children}</table></div>,
  thead: ({ children }: any) => <thead className="bg-gray-800/50">{children}</thead>,
  th: ({ children }: any) => <th className="px-3 py-1.5 text-left font-medium text-gray-400 border-b border-gray-700">{children}</th>,
  td: ({ children }: any) => <td className="px-3 py-1.5 border-b border-gray-800 text-gray-300">{children}</td>,
  blockquote: ({ children }: any) => <blockquote className="border-l-2 border-blue-500/50 pl-3 my-2 text-gray-400 italic">{children}</blockquote>,
  a: ({ href, children }: any) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">{children}</a>,
  hr: () => <hr className="my-3 border-gray-700" />,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function MessageBubble({ message, onApprove }: Props) {
  if (message.role === "system") return <SystemMessage message={message} />;

  const isUser = message.role === "user";
  const displayContent = message.phaseGate ? stripPhaseGateMarker(message.content) : message.content;
  const phaseLabel = message.phaseGate
    ? SDLC_PHASES.find((p) => p.key === message.phaseGate)?.label || message.phaseGate
    : null;

  return (
    <div className={`flex items-start gap-3 max-w-3xl ${isUser ? "ml-auto flex-row-reverse" : "mx-auto"}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
          isUser ? "bg-blue-600" : "bg-gradient-to-br from-purple-500 to-blue-600"
        }`}
      >
        {isUser ? "U" : "AI"}
      </div>

      {/* Content */}
      <div
        className={`rounded-2xl px-4 py-3 min-w-0 ${
          isUser
            ? "bg-blue-600 rounded-tr-sm text-white max-w-md"
            : "bg-gray-800/80 rounded-tl-sm text-gray-100 border border-gray-700/40 flex-1"
        }`}
      >
        {isUser ? (
          <div className="text-sm whitespace-pre-wrap break-words">{displayContent}</div>
        ) : (
          <div className="text-sm prose-sm break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
              {displayContent}
            </ReactMarkdown>
          </div>
        )}

        {/* Tool executions */}
        {message.toolExecutions && message.toolExecutions.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-700/40">
            <p className="text-[11px] text-gray-500 mb-1">
              🔧 {message.toolExecutions.length} tool{message.toolExecutions.length > 1 ? "s" : ""} executed
            </p>
            {message.toolExecutions.map((exec, i) => (
              <ToolExecutionCard key={i} exec={exec} />
            ))}
          </div>
        )}

        {/* Phase gate approval button */}
        {message.phaseGate && !message.approved && onApprove && (
          <div className="mt-3 pt-3 border-t border-gray-700/40">
            <div className="flex items-center gap-3">
              <button
                onClick={() => onApprove(message.phaseGate!)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Approve {phaseLabel}
              </button>
              <span className="text-[11px] text-gray-500">Click to approve and proceed to the next phase</span>
            </div>
          </div>
        )}

        {/* Approved badge */}
        {message.phaseGate && message.approved && (
          <div className="mt-3 pt-3 border-t border-gray-700/40">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg w-fit">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-xs text-green-300 font-medium">✅ {phaseLabel} Approved</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

