"use client";

import { useState, useCallback, useRef, useEffect, Component, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage, ToolExecution, SDLCPhase, UserChoicesBlock } from "@/lib/types";
import { stripPhaseGateMarker, SDLC_PHASES, parseUserChoices, stripUserChoicesMarker } from "@/lib/types";
import { getVideoEmbedUrl } from "@/components/LandingPage";

interface Props {
  message: ChatMessage;
  onApprove?: (phase: SDLCPhase) => void;
  /** Callback to send a choice as user message */
  onChoiceSelect?: (choiceKey: string) => void;
  /** When false, tool executions show only a compact summary line (no expandable cards) */
  showToolDetails?: boolean;
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
            background: answered ? "var(--surface-secondary)" : idx === focusIdx ? "color-mix(in srgb, var(--color-primary) 12%, transparent)" : "var(--surface-secondary)",
            border: `1px solid ${answered ? "var(--border-default)" : idx === focusIdx ? "color-mix(in srgb, var(--color-primary) 40%, transparent)" : "var(--border-emphasis)"}`,
            color: answered ? "var(--text-disabled)" : idx === focusIdx ? "var(--color-primary)" : "var(--text-primary)",
            opacity: answered ? 0.5 : 1,
            ...(idx === focusIdx && !answered ? { boxShadow: "0 0 0 1px color-mix(in srgb, var(--color-primary) 20%, transparent)" } : {}),
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

type DiagramView = "diagram" | "ascii" | "text" | "code";

/** Extract AI-generated ASCII art from %% @ascii / %% @end-ascii comment block */
function extractAsciiArt(code: string): string {
  const lines = code.split("\n");
  const startIdx = lines.findIndex(l => l.trim() === "%% @ascii");
  const endIdx = lines.findIndex(l => l.trim() === "%% @end-ascii");
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return "";
  return lines.slice(startIdx + 1, endIdx)
    .map(l => l.replace(/^%%\s?/, ""))
    .join("\n");
}

/** Strip the @ascii comment block, returning only the mermaid code for rendering */
function stripAsciiArt(code: string): string {
  const lines = code.split("\n");
  const startIdx = lines.findIndex(l => l.trim() === "%% @ascii");
  const endIdx = lines.findIndex(l => l.trim() === "%% @end-ascii");
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return code;
  return [...lines.slice(0, startIdx), ...lines.slice(endIdx + 1)].join("\n").trim();
}

/** Convert Mermaid syntax into a simple ASCII/text representation */
function mermaidToAscii(code: string): string {
  const lines = code.trim().split("\n");
  const out: string[] = [];
  const type = lines[0]?.trim().split(/\s/)[0] || "";

  if (type === "sequenceDiagram") {
    const participants: string[] = [];
    for (const line of lines.slice(1)) {
      const t = line.trim();
      const pMatch = t.match(/^participant\s+(\S+)(?:\s+as\s+(.+))?/);
      if (pMatch) { participants.push(pMatch[2] || pMatch[1]); continue; }
      const arrow = t.match(/^(\S+?)\s*(->>|-->>|-->|->)\s*(\S+?)\s*:\s*(.+)/);
      if (arrow) {
        const [, from, , to, label] = arrow;
        out.push(`  ${from} ${"-".repeat(Math.max(4, 20 - from.length - to.length))}> ${to}: ${label}`);
        continue;
      }
      const note = t.match(/^Note\s+over\s+(\S+),?(\S*):\s*(.+)/i);
      if (note) { out.push(`  [Note: ${note[3]}]`); continue; }
      if (t.startsWith("alt ") || t.startsWith("else")) out.push(`  ${t}`);
      if (t === "end") out.push(`  end`);
    }
    if (participants.length > 0) {
      out.unshift(`  Participants: ${participants.join(", ")}`, "");
    }
    out.unshift(`SEQUENCE DIAGRAM`, "=" .repeat(40));
  } else if (type === "erDiagram") {
    out.push("ER DIAGRAM", "=".repeat(40), "");
    for (const line of lines.slice(1)) {
      const t = line.trim();
      const entity = t.match(/^(\S+)\s*\{/);
      if (entity) { out.push(`[${entity[1]}]`); continue; }
      if (t === "}") { out.push(""); continue; }
      const field = t.match(/^(\S+)\s+(\S+)/);
      if (field) { out.push(`  ${field[1].padEnd(12)} ${field[2]}`); continue; }
      const rel = t.match(/^(\S+)\s+(\|[|o{]--[|o{]\|)\s+(\S+)\s*:\s*"?([^"]*)"?/);
      if (rel) { out.push(`  ${rel[1]} --- ${rel[3]}  (${rel[4]})`); }
    }
  } else {
    const heading = type.includes("flowchart") ? "FLOWCHART" : "DIAGRAM";
    out.push(heading, "=".repeat(40), "");
    const nodes = new Map<string, string>();
    const edges: string[] = [];
    for (const line of lines.slice(1)) {
      const t = line.trim();
      if (!t || t.startsWith("classDef") || t.startsWith("class ") || t.startsWith("style ")) continue;
      if (t.startsWith("subgraph")) {
        const label = t.replace(/^subgraph\s+/, "").replace(/\[.*/, "").replace(/["']/g, "");
        out.push(`+${"─".repeat(36)}+`, `| ${label.padEnd(35)}|`);
        continue;
      }
      if (t === "end") { out.push(`+${"─".repeat(36)}+`, ""); continue; }
      const nodeDef = t.match(/^(\w+)\[["']?([^"'\]]+)["']?\]/);
      if (nodeDef) nodes.set(nodeDef[1], nodeDef[2]);
      const nodeRound = t.match(/^(\w+)\(["']?([^"'\)]+)["']?\)/);
      if (nodeRound) nodes.set(nodeRound[1], `(${nodeRound[2]})`);
      const edgeMatch = t.match(/^(\w+)\s*(-->|---->|==>|-.->|-->)\s*\|?"?([^|"]*)"?\|?\s*(\w+)/);
      if (edgeMatch) {
        const [, from, , label, to] = edgeMatch;
        const fromLabel = nodes.get(from) || from;
        const toLabel = nodes.get(to) || to;
        edges.push(label
          ? `  [${fromLabel}] --${label}--> [${toLabel}]`
          : `  [${fromLabel}] ---------> [${toLabel}]`
        );
      }
    }
    if (edges.length > 0) out.push(...edges);
    else {
      for (const line of lines.slice(1)) {
        const t = line.trim();
        if (t && !t.startsWith("classDef") && !t.startsWith("class ") && !t.startsWith("style "))
          out.push(`  ${t}`);
      }
    }
  }
  return out.join("\n");
}

const VIEW_OPTIONS: { key: DiagramView; label: string }[] = [
  { key: "diagram", label: "Diagram" },
  { key: "ascii", label: "ASCII" },
  { key: "text", label: "Text" },
  { key: "code", label: "Code" },
];

let mermaidInitPromise: Promise<void> | null = null;

async function ensureMermaidInit(): Promise<void> {
  if (mermaidInitPromise) return mermaidInitPromise;
  mermaidInitPromise = (async () => {
    const mermaid = (await import("mermaid")).default;
    mermaid.initialize({
      startOnLoad: false,
      theme: document.documentElement.getAttribute("data-theme") === "light" ? "default" : "dark",
      securityLevel: "strict",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
    });
  })();
  mermaidInitPromise.catch(() => { mermaidInitPromise = null; });
  return mermaidInitPromise;
}

let idCounter = 0;

/** Mermaid diagram renderer with four view modes: visual SVG, ASCII art, text outline, raw code */
function MermaidDiagram({ code }: { code: string }) {
  const asciiArt = extractAsciiArt(code);
  const mermaidCode = stripAsciiArt(code);
  const textFallback = mermaidToAscii(mermaidCode);
  const asciiContent = asciiArt || textFallback;

  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [view, setView] = useState<DiagramView>("diagram");
  const idRef = useRef(`mermaid-${Date.now()}-${++idCounter}`);

  useEffect(() => {
    let cancelled = false;
    setSvg("");
    setError("");
    setView("diagram");
    (async () => {
      try {
        await ensureMermaidInit();
        const mermaid = (await import("mermaid")).default;
        await mermaid.parse(mermaidCode.trim());
        const { svg: rendered } = await mermaid.render(idRef.current, mermaidCode.trim());
        if (!cancelled) setSvg(rendered);
      } catch (e: unknown) {
        document.getElementById(`d${idRef.current}`)?.remove();
        document.getElementById(idRef.current)?.remove();
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Failed to render diagram";
          setError(msg);
          setView("ascii");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [mermaidCode]);

  if (!svg && !error) {
    return (
      <div className="my-2 p-4 rounded-md flex items-center justify-center" style={{ background: "var(--surface-secondary)", minHeight: 60 }}>
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-disabled)" }}>
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Rendering diagram...
        </div>
      </div>
    );
  }

  return (
    <div className="my-2 rounded-md overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center justify-between px-3 py-1.5" style={{ background: "var(--surface-secondary)" }}>
        <span className="text-[11px] font-medium" style={{ color: "var(--text-disabled)" }}>
          {error ? "Diagram (render error)" : "Diagram"}
        </span>
        <div className="flex items-center rounded-md overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setView(opt.key)}
              disabled={opt.key === "diagram" && !!error}
              className="text-[10px] px-2 py-0.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: view === opt.key ? "var(--surface-elevated)" : "transparent",
                color: view === opt.key ? "var(--text-primary)" : "var(--text-disabled)",
                fontWeight: view === opt.key ? 600 : 400,
              }}
              onMouseEnter={e => { if (view !== opt.key && !(opt.key === "diagram" && error)) e.currentTarget.style.background = "var(--surface-elevated)"; }}
              onMouseLeave={e => { if (view !== opt.key) e.currentTarget.style.background = "transparent"; }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {view === "diagram" && svg && (
        <div
          className="p-4 overflow-x-auto flex justify-center"
          style={{ background: "var(--surface-app)" }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
      {view === "ascii" && (
        <pre className="block p-3 text-[11px] font-mono overflow-x-auto whitespace-pre leading-relaxed" style={{ background: "var(--surface-app)", color: "var(--text-secondary)" }}>
          {asciiContent}
        </pre>
      )}
      {view === "text" && (
        <pre className="block p-3 text-[11px] font-mono overflow-x-auto whitespace-pre leading-relaxed" style={{ background: "var(--surface-app)", color: "var(--text-secondary)" }}>
          {textFallback}
        </pre>
      )}
      {view === "code" && (
        <code className="block p-3 text-[12px] font-mono overflow-x-auto" style={{ background: "var(--surface-app)", color: "var(--text-secondary)" }}>
          {mermaidCode}
        </code>
      )}
    </div>
  );
}

/** Safety net: catches errors that escape the MermaidDiagram try/catch (import failure, SVG render crash) */
class DiagramErrorBoundary extends Component<{ code: string; children: ReactNode }, { hasError: boolean }> {
  constructor(props: { code: string; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidUpdate(prevProps: { code: string }) {
    if (prevProps.code !== this.props.code && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="my-2 rounded-md overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center px-3 py-1.5" style={{ background: "var(--surface-secondary)" }}>
            <span className="text-[11px] font-medium" style={{ color: "var(--text-disabled)" }}>Diagram (render error)</span>
          </div>
          <code className="block p-3 text-[12px] font-mono overflow-x-auto" style={{ background: "var(--surface-app)", color: "var(--text-secondary)" }}>
            {this.props.code}
          </code>
        </div>
      );
    }
    return this.props.children;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const MD_COMPONENTS_SYSTEM: Record<string, any> = {
  p: ({ children }: any) => <p className="inline">{children}</p>,
  strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
  code: ({ children }: any) => <code className="px-1 py-0.5 rounded text-[11px] font-mono" style={{ background: "rgba(255,255,255,0.08)" }}>{children}</code>,
};

/** Returns true if the URL is a known video platform link (YouTube, Loom, ScreenPal, Vimeo) */
function isVideoUrl(url: string): boolean {
  if (!url) return false;
  return /youtu\.?be|youtube\.com|loom\.com|screenpal\.com|screencast-o-matic\.com|vimeo\.com/i.test(url);
}

/** Inline video embed for recognized video links in chat messages */
function VideoEmbed({ href }: { href: string }) {
  const embedUrl = getVideoEmbedUrl(href);
  return (
    <div className="my-2 rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
      <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, background: "var(--surface-secondary)" }}>
        <iframe
          src={embedUrl}
          title="Video"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          frameBorder={0}
          referrerPolicy="no-referrer-when-downgrade"
          loading="lazy"
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
        />
      </div>
    </div>
  );
}

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
    const isMermaid = className?.includes("language-mermaid");
    const isBlock = className?.includes("language-");
    if (isMermaid) {
      const code = String(children).replace(/\n$/, "");
      return <DiagramErrorBoundary code={code}><MermaidDiagram code={code} /></DiagramErrorBoundary>;
    }
    if (isBlock) {
      return <code className="block p-3 my-2 rounded-md text-[12px] font-mono overflow-x-auto" style={{ background: "var(--surface-app)", color: "var(--text-secondary)" }}>{children}</code>;
    }
    return <code className="px-1.5 py-0.5 rounded text-[12px] font-mono" style={{ background: "var(--surface-elevated)", color: "var(--color-primary)" }}>{children}</code>;
  },
  pre: ({ children }: any) => <pre className="my-2">{children}</pre>,
  table: ({ children }: any) => <div className="overflow-x-auto my-2"><table className="min-w-full text-xs border-collapse">{children}</table></div>,
  thead: ({ children }: any) => <thead style={{ background: "var(--surface-secondary)" }}>{children}</thead>,
  th: ({ children }: any) => <th className="px-3 py-1.5 text-left font-medium" style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border-emphasis)" }}>{children}</th>,
  td: ({ children }: any) => <td className="px-3 py-1.5" style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>{children}</td>,
  blockquote: ({ children }: any) => <blockquote className="pl-3 my-2 italic" style={{ borderLeft: "2px solid var(--color-primary)", color: "var(--text-secondary)" }}>{children}</blockquote>,
  a: ({ href, children }: any) => {
    if (href && isVideoUrl(href)) {
      return (
        <span>
          <a href={href} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--color-primary)" }}>{children}</a>
          <VideoEmbed href={href} />
        </span>
      );
    }
    return <a href={href} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--color-primary)" }}>{children}</a>;
  },
  hr: () => <hr className="my-3" style={{ borderColor: "var(--border-default)" }} />,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function MessageBubble({ message, onApprove, onChoiceSelect, showToolDetails = true }: Props) {
  const [approving, setApproving] = useState(false);
  const [msgExpanded, setMsgExpanded] = useState(true);
  const [isLong, setIsLong] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  if (message.role === "system") return <SystemMessage message={message} />;

  const isUser = message.role === "user";
  const choicesBlock: UserChoicesBlock | null = !isUser ? parseUserChoices(message.content) : null;
  const contentWithoutChoices = choicesBlock ? stripUserChoicesMarker(message.content) : message.content;
  const displayContent = message.phaseGate ? stripPhaseGateMarker(contentWithoutChoices) : contentWithoutChoices;
  const phaseLabel = message.phaseGate
    ? SDLC_PHASES.find((p) => p.key === message.phaseGate)?.label || message.phaseGate
    : null;

  useEffect(() => {
    if (isLong || isUser) return;
    if (contentRef.current && contentRef.current.scrollHeight > 500) {
      setIsLong(true);
      setMsgExpanded(false);
    }
  }, [isUser, isLong, displayContent]);

  return (
    <div className={`group/msg flex items-start gap-3 ${isUser ? "ml-auto flex-row-reverse" : ""}`}>
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
        <div className={`absolute top-1.5 ${isUser ? "left-1.5" : "right-1.5"} opacity-0 group-hover/msg:opacity-100 transition-opacity`}>
          <CopyButton text={displayContent} />
        </div>
        {isUser && message.images && message.images.length > 0 && (
          <div className={`flex gap-2 flex-wrap ${displayContent ? "mb-2" : ""}`}>
            {message.images.map((img, i) => (
              <img key={i} src={img} alt={`Attachment ${i + 1}`} className="max-w-xs max-h-48 rounded-lg object-contain" />
            ))}
          </div>
        )}

        {isUser ? (
          <>
            {displayContent ? <div className="text-sm whitespace-pre-wrap break-words">{displayContent}</div> : null}
          </>
        ) : (
          <div ref={contentRef}>
            <div
              className="text-sm prose-sm break-words transition-all duration-300"
              style={{
                ...(isLong && !msgExpanded ? { maxHeight: "400px", overflow: "hidden", maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)" } : {}),
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                {displayContent}
              </ReactMarkdown>
            </div>
            {isLong && (
              <button
                onClick={() => setMsgExpanded(!msgExpanded)}
                className="flex items-center gap-1.5 mt-2 px-3 py-1 rounded-md text-[11px] font-medium transition-colors w-full justify-center"
                style={{ background: "var(--surface-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-elevated)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "var(--surface-secondary)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
              >
                <svg className={`w-3 h-3 transition-transform ${msgExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                {msgExpanded ? "Collapse" : "Expand full message"}
              </button>
            )}
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
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md w-fit" style={{ background: "color-mix(in srgb, var(--color-primary) 6%, transparent)", border: "1px solid color-mix(in srgb, var(--color-primary) 15%, transparent)" }}>
              <svg className="w-4 h-4" style={{ color: "var(--color-primary)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-xs font-medium" style={{ color: "var(--color-primary)" }}>⚡ {phaseLabel} Auto-approved</span>
              <span className="text-[10px]" style={{ color: "var(--text-disabled)" }}>(no sign-off required)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

