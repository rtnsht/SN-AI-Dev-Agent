"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage, ToolExecution, SDLCPhase, UserChoicesBlock } from "@/lib/types";
import { stripPhaseGateMarker, SDLC_PHASES, parseUserChoices, stripUserChoicesMarker } from "@/lib/types";

interface Props {
  message: ChatMessage;
  onApprove?: (phase: SDLCPhase) => void;
  /** Callback to send a choice as user message */
  onChoiceSelect?: (choiceKey: string) => void;
  /** When false, tool executions show only a compact summary line (no expandable cards) */
  showToolDetails?: boolean;
  /** Authenticated user's display name (for avatar initial) */
  userName?: string;
}

/** Copy-to-clipboard button with brief "Copied!" feedback */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded-md transition-colors"
      style={{ color: "var(--text-disabled)" }}
      onMouseEnter={e => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--surface-elevated)"; }}
      onMouseLeave={e => { e.currentTarget.style.color = "var(--text-disabled)"; e.currentTarget.style.background = "transparent"; }}
      title={copied ? "Copied!" : "Copy message"}
    >
      {copied ? (
        <svg className="w-3.5 h-3.5" style={{ color: "var(--color-success)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

/** Interactive choice buttons rendered from USER_CHOICES markers */
function InteractiveChoices({
  block,
  answered,
  onSelect,
}: {
  block: UserChoicesBlock;
  answered: boolean;
  onSelect: (key: string) => void;
}) {
  const [focusIdx, setFocusIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!answered && containerRef.current) {
      containerRef.current.focus();
    }
  }, [answered]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (answered) return;
      const len = block.choices.length;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setFocusIdx((prev) => (prev + 1) % len);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setFocusIdx((prev) => (prev - 1 + len) % len);
      } else if (e.key === "Enter") {
        e.preventDefault();
        onSelect(block.choices[focusIdx].key);
      }
    },
    [answered, block.choices, focusIdx, onSelect]
  );

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`mt-3 flex flex-wrap gap-2 outline-none ${answered ? "opacity-50 pointer-events-none" : ""}`}
      role="listbox"
      aria-label="Choose an option"
    >
      {block.choices.map((choice, idx) => (
        <button
          key={choice.key}
          onClick={() => !answered && onSelect(choice.key)}
          className="text-left px-3 py-2 rounded-md text-sm transition-all"
          style={{
            background: answered ? "var(--surface-secondary)" : idx === focusIdx ? "rgba(76,125,255,0.12)" : "var(--surface-secondary)",
            border: `1px solid ${answered ? "var(--border-default)" : idx === focusIdx ? "rgba(76,125,255,0.4)" : "var(--border-emphasis)"}`,
            color: answered ? "var(--text-disabled)" : idx === focusIdx ? "var(--color-info)" : "var(--text-primary)",
            opacity: answered ? 0.5 : 1,
            ...(idx === focusIdx && !answered ? { boxShadow: "0 0 0 1px rgba(76,125,255,0.2)" } : {}),
          }}
          role="option"
          aria-selected={idx === focusIdx}
        >
          <span className="font-medium">{choice.label}</span>
          {choice.description && (
            <span className="block text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{choice.description}</span>
          )}
        </button>
      ))}
      {!answered && (
        <span className="self-center text-[10px] ml-1" style={{ color: "var(--text-disabled)" }}>
          Arrow keys to navigate, Enter to select
        </span>
      )}
    </div>
  );
}

function ToolExecutionCard({ exec }: { exec: ToolExecution }) {
  const [expanded, setExpanded] = useState(false);
  const isError =
    typeof exec.output === "object" &&
    exec.output !== null &&
    "error" in (exec.output as Record<string, unknown>);

  return (
    <div className="rounded-md overflow-hidden text-xs mt-1.5" style={{ border: "1px solid var(--border-default)" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 transition-colors text-left"
        style={{ background: "var(--surface-secondary)" }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-elevated)")}
        onMouseLeave={e => (e.currentTarget.style.background = "var(--surface-secondary)")}
      >
        <span className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: isError ? "var(--color-danger)" : "var(--color-success)" }}>
            {isError ? "✗" : "✓"}
          </span>
          <span className="font-mono text-[11px]" style={{ color: "var(--text-secondary)" }}>{exec.toolName}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: "var(--text-disabled)" }}>{exec.durationMs}ms</span>
          <svg className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} style={{ color: "var(--text-disabled)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </span>
      </button>
      {expanded && (
        <div className="px-3 py-2 space-y-2" style={{ background: "var(--surface-app)", borderTop: "1px solid var(--border-default)" }}>
          <div>
            <span className="font-medium text-[10px] uppercase" style={{ color: "var(--text-disabled)" }}>Input</span>
            <pre className="mt-1 p-2 rounded overflow-x-auto max-h-32 overflow-y-auto text-[11px] leading-relaxed font-mono" style={{ background: "var(--surface-primary)", color: "var(--text-secondary)" }}>
              {JSON.stringify(exec.input, null, 2)}
            </pre>
          </div>
          <div>
            <span className="font-medium text-[10px] uppercase" style={{ color: "var(--text-disabled)" }}>Output</span>
            <pre className="mt-1 p-2 rounded overflow-x-auto max-h-48 overflow-y-auto text-[11px] leading-relaxed font-mono" style={{ background: "var(--surface-primary)", color: "var(--text-secondary)" }}>
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

/* System message banner — non-intrusive top banner per spec */
function SystemMessage({ message }: Props) {
  const typeColors: Record<string, { bg: string; border: string; text: string }> = {
    success: { bg: "rgba(56,201,118,0.06)", border: "rgba(56,201,118,0.15)", text: "var(--color-success)" },
    warning: { bg: "rgba(245,196,81,0.06)", border: "rgba(245,196,81,0.15)", text: "var(--color-warning)" },
    error:   { bg: "rgba(249,115,115,0.06)", border: "rgba(249,115,115,0.15)", text: "var(--color-danger)" },
    info:    { bg: "rgba(76,125,255,0.06)", border: "rgba(76,125,255,0.15)", text: "var(--color-info)" },
  };
  const colors = typeColors[message.type || "info"] || typeColors.info;

  return (
    <div
      className="px-4 py-2.5 rounded-md text-xs leading-relaxed"
      style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}
    >
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
  code: ({ children }: any) => <code className="px-1 py-0.5 rounded text-[11px] font-mono" style={{ background: "rgba(255,255,255,0.08)" }}>{children}</code>,
};

const MD_COMPONENTS: Record<string, any> = {
  p: ({ children }: any) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }: any) => <strong className="font-semibold" style={{ color: "var(--text-primary)" }}>{children}</strong>,
  em: ({ children }: any) => <em className="italic" style={{ color: "var(--text-secondary)" }}>{children}</em>,
  h1: ({ children }: any) => <h1 className="text-base font-bold mb-2 mt-3 first:mt-0" style={{ color: "var(--text-primary)" }}>{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-sm font-bold mb-1.5 mt-2.5 first:mt-0" style={{ color: "var(--text-primary)" }}>{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0" style={{ color: "var(--text-primary)" }}>{children}</h3>,
  ul: ({ children }: any) => <ul className="list-disc list-outside ml-4 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal list-outside ml-4 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }: any) => <li style={{ color: "var(--text-secondary)" }}>{children}</li>,
  code: ({ className, children }: any) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return <code className="block p-3 my-2 rounded-md text-[12px] font-mono overflow-x-auto" style={{ background: "var(--surface-app)", color: "var(--text-secondary)" }}>{children}</code>;
    }
    return <code className="px-1.5 py-0.5 rounded text-[12px] font-mono" style={{ background: "var(--surface-elevated)", color: "var(--color-info)" }}>{children}</code>;
  },
  pre: ({ children }: any) => <pre className="my-2">{children}</pre>,
  table: ({ children }: any) => <div className="overflow-x-auto my-2"><table className="min-w-full text-xs border-collapse">{children}</table></div>,
  thead: ({ children }: any) => <thead style={{ background: "var(--surface-secondary)" }}>{children}</thead>,
  th: ({ children }: any) => <th className="px-3 py-1.5 text-left font-medium" style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border-emphasis)" }}>{children}</th>,
  td: ({ children }: any) => <td className="px-3 py-1.5" style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>{children}</td>,
  blockquote: ({ children }: any) => <blockquote className="pl-3 my-2 italic" style={{ borderLeft: "2px solid var(--color-info)", color: "var(--text-secondary)" }}>{children}</blockquote>,
  a: ({ href, children }: any) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--color-info)" }}>{children}</a>,
  hr: () => <hr className="my-3" style={{ borderColor: "var(--border-default)" }} />,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function MessageBubble({ message, onApprove, onChoiceSelect, showToolDetails = true, userName }: Props) {
  const [approving, setApproving] = useState(false);

  if (message.role === "system") return <SystemMessage message={message} />;

  const isUser = message.role === "user";
  const choicesBlock: UserChoicesBlock | null = !isUser ? parseUserChoices(message.content) : null;
  const contentWithoutChoices = choicesBlock ? stripUserChoicesMarker(message.content) : message.content;
  const displayContent = message.phaseGate ? stripPhaseGateMarker(contentWithoutChoices) : contentWithoutChoices;
  const phaseLabel = message.phaseGate
    ? SDLC_PHASES.find((p) => p.key === message.phaseGate)?.label || message.phaseGate
    : null;

  return (
    <div className={`group/msg flex items-start gap-3 ${isUser ? "ml-auto flex-row-reverse" : ""}`}>
      {/* Content — no chat bubble styling, Linear/Notion comment aesthetic */}
      <div
        className="relative px-3 sm:px-4 py-2.5 sm:py-3 min-w-0 rounded-md"
        style={{
          background: isUser ? "var(--surface-secondary)" : "transparent",
          border: isUser ? "1px solid var(--border-default)" : "none",
          color: "var(--text-primary)",
          maxWidth: isUser ? "85%" : undefined,
          flex: isUser ? undefined : "1",
        }}
      >
        {/* Copy button — visible on hover */}
        <div className={`absolute top-1.5 ${isUser ? "left-1.5" : "right-1.5"} opacity-0 group-hover/msg:opacity-100 transition-opacity`}>
          <CopyButton text={displayContent} />
        </div>
        {/* User-attached images */}
        {isUser && message.images && message.images.length > 0 && (
          <div className={`flex gap-2 flex-wrap ${displayContent ? "mb-2" : ""}`}>
            {message.images.map((img, i) => (
              <img key={i} src={img} alt={`Attachment ${i + 1}`} className="max-w-xs max-h-48 rounded-lg object-contain" />
            ))}
          </div>
        )}

        {isUser ? (
          displayContent ? <div className="text-sm whitespace-pre-wrap break-words">{displayContent}</div> : null
        ) : (
          <div className="text-sm prose-sm break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
              {displayContent}
            </ReactMarkdown>
          </div>
        )}

        {/* Interactive choices */}
        {choicesBlock && onChoiceSelect && (
          <InteractiveChoices
            block={choicesBlock}
            answered={!!message.choicesAnswered}
            onSelect={onChoiceSelect}
          />
        )}

        {/* Tool executions */}
        {message.toolExecutions && message.toolExecutions.length > 0 && (
          <div className="mt-3 pt-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            {showToolDetails ? (
              <>
                <p className="text-[11px] mb-1" style={{ color: "var(--text-disabled)" }}>
                  🔧 {message.toolExecutions.length} tool{message.toolExecutions.length > 1 ? "s" : ""} executed
                </p>
                {message.toolExecutions.map((exec, i) => (
                  <ToolExecutionCard key={i} exec={exec} />
                ))}
              </>
            ) : (
              /* Compact summary — no expandable cards */
              <p className="text-[11px]" style={{ color: "var(--text-disabled)" }}>
                🔧 {message.toolExecutions.length} tool{message.toolExecutions.length > 1 ? "s" : ""} executed
                <span className="ml-1.5" style={{ color: "var(--text-disabled)" }}>
                  ({message.toolExecutions.filter((e) => {
                    const isErr = typeof e.output === "object" && e.output !== null && "error" in (e.output as Record<string, unknown>);
                    return !isErr;
                  }).length} succeeded
                  {message.toolExecutions.some((e) => {
                    const isErr = typeof e.output === "object" && e.output !== null && "error" in (e.output as Record<string, unknown>);
                    return isErr;
                  }) && `, ${message.toolExecutions.filter((e) => {
                    const isErr = typeof e.output === "object" && e.output !== null && "error" in (e.output as Record<string, unknown>);
                    return isErr;
                  }).length} failed`})
                </span>
              </p>
            )}
          </div>
        )}

        {/* Phase gate approval button */}
        {message.phaseGate && !message.approved && !message.autoApproved && onApprove && (
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setApproving(true); onApprove(message.phaseGate!); }}
                disabled={approving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: approving ? "var(--surface-elevated)" : "var(--color-success)",
                  color: approving ? "var(--text-disabled)" : "#0A0A0B",
                }}
              >
                {approving ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {approving ? "Approving..." : `Approve ${phaseLabel}`}
              </button>
              {!approving && (
                <span className="text-[11px]" style={{ color: "var(--text-disabled)" }}>🔒 Click to approve and proceed to the next phase</span>
              )}
            </div>
          </div>
        )}

        {/* User-approved badge */}
        {message.phaseGate && message.approved && !message.autoApproved && (
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md w-fit" style={{ background: "rgba(56,201,118,0.06)", border: "1px solid rgba(56,201,118,0.15)" }}>
              <svg className="w-4 h-4" style={{ color: "var(--color-success)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-xs font-medium" style={{ color: "var(--color-success)" }}>✅ {phaseLabel} Approved</span>
            </div>
          </div>
        )}

        {/* Auto-approved badge */}
        {message.phaseGate && message.autoApproved && (
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md w-fit" style={{ background: "rgba(76,125,255,0.06)", border: "1px solid rgba(76,125,255,0.15)" }}>
              <svg className="w-4 h-4" style={{ color: "var(--color-info)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-xs font-medium" style={{ color: "var(--color-info)" }}>⚡ {phaseLabel} Auto-approved</span>
              <span className="text-[10px]" style={{ color: "var(--text-disabled)" }}>(no sign-off required)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

