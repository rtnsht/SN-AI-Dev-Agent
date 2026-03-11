"use client";

import { useState, useRef, useEffect, useCallback, type RefObject } from "react";
import Image from "next/image";
import type { ChatMessage, SDLCPhase, LiveStatus, FileAttachment } from "@/lib/types";
import MessageBubble from "./MessageBubble";
import { APP_NAME, APP_LOGO, APP_TAGLINE, APP_SUBTITLE } from "@/lib/branding";

/* ── Web Speech API type shim ── */
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}
type SpeechRecognitionCtor = new () => SpeechRecognition;
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

/** Detect browser SpeechRecognition support */
function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const MAX_RECORDING_MS = 2 * 60 * 1000; // 2 minute hard cap

const DEFAULT_PROMPTS = [
  { icon: "🏗️", text: "Build a high-priority incident justification feature that requires managers to provide a business reason when setting incident priority to P1", desc: "Full SDLC requirement" },
  { icon: "📦", text: "Create a catalog item for requesting a new laptop with approval workflow", desc: "Full SDLC requirement" },
  { icon: "🔍", text: "Analyze my instance health and show me any anti-patterns", desc: "Instance analysis" },
  { icon: "📊", text: "List all custom business rules on the incident table", desc: "Quick query" },
];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB per image
const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per document
const MAX_FILES = 5;

/** Accepted document MIME types */
const DOC_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

/** File extension to icon mapping */
function fileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return "📄";
  if (ext === "doc" || ext === "docx") return "📝";
  if (ext === "xls" || ext === "xlsx") return "📊";
  return "📎";
}

/** Read a File as base64 data URI */
function readFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Read a File as raw base64 (no data-URI prefix) */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      // Strip the "data:...;base64," prefix
      const base64 = dataUri.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Activity log entry from streaming events */
export interface ActivityLogEntry {
  message: string;
  phase: string;
  timestamp: number;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  done?: boolean;
}

/** Convert raw tool name + input into a friendly conversational label */
function friendlyToolLabel(toolName: string, input?: Record<string, unknown>): string {
  const table = input?.table as string | undefined;
  const name = input?.name as string | undefined;
  const query = input?.query as string | undefined;

  // sn_get_* tools — "Looking up X" or "X on table"
  const getMap: Record<string, string> = {
    sn_get_instance_info: "Checking instance info",
    sn_get_tables: "Listing available tables",
    sn_get_table_schema: table ? `Reading ${table} table schema` : "Reading table schema",
    sn_get_business_rules: table ? `Business rules on ${table}` : "Business rules",
    sn_get_client_scripts: table ? `Client scripts on ${table}` : "Client scripts",
    sn_get_ui_policies: table ? `UI policies on ${table}` : "UI policies",
    sn_get_ui_actions: table ? `UI actions on ${table}` : "UI actions",
    sn_get_ui_policy_actions: "UI policy actions",
    sn_get_script_includes: query ? `Script includes matching ${query}` : "Script includes",
    sn_get_acls: table ? `ACLs on ${table}` : "ACLs",
    sn_get_notifications: table ? `Notifications for ${table}` : "Notifications",
    sn_get_scheduled_jobs: "Scheduled jobs",
    sn_get_fix_scripts: "Fix scripts",
    sn_get_update_set_contents: "Update set contents",
  };
  if (getMap[toolName]) return getMap[toolName];

  // sn_query_records / sn_read_record
  if (toolName === "sn_query_records") return table ? `Querying ${table} records` : "Querying records";
  if (toolName === "sn_read_record" || toolName === "sn_get_record") return table ? `Reading ${table} record` : "Reading record";

  // sn_create_* tools
  if (toolName.startsWith("sn_create_")) {
    const entity = toolName.replace("sn_create_", "").replace(/_/g, " ");
    return name ? `Creating ${entity}: ${name}${table ? ` on ${table}` : ""}` : `Creating ${entity}${table ? ` on ${table}` : ""}`;
  }

  // sn_update_* tools
  if (toolName.startsWith("sn_update_")) {
    const entity = toolName.replace("sn_update_", "").replace(/_/g, " ");
    return name ? `Updating ${entity}: ${name}` : `Updating ${entity}`;
  }

  // sn_list_* tools
  if (toolName === "sn_list_flows") return "Listing flows";
  if (toolName === "sn_list_update_sets") return "Listing update sets";
  if (toolName.startsWith("sn_list_")) return `Listing ${toolName.replace("sn_list_", "").replace(/_/g, " ")}`;

  // sn_analyze_instance
  if (toolName === "sn_analyze_instance") return "Analyzing instance";

  // sn_execute_* / sn_run_*
  if (toolName.startsWith("sn_execute_") || toolName.startsWith("sn_run_")) return `Running ${toolName.replace(/^sn_(execute|run)_/, "").replace(/_/g, " ")}`;

  // sn_set_* / sn_move_*
  if (toolName === "sn_set_current_update_set") return "Setting active update set";
  if (toolName === "sn_move_to_update_set") return "Moving artifact to update set";

  // Flow designer
  if (toolName === "sn_get_flow") return "Reading flow details";
  if (toolName === "sn_scaffold_flow") return "Scaffolding flow";

  // Generic fallback — humanize the tool name
  return toolName.replace(/^sn_/, "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

interface Props {
  messages: ChatMessage[];
  isLoading: boolean;
  onSend: (text: string, images?: string[], files?: FileAttachment[]) => void;
  onCancel: () => void;
  onApprove: (phase: SDLCPhase) => void;
  onChoiceSelect?: (choiceKey: string) => void;
  connected: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  /** When false, tool executions show only a compact summary (controlled by env) */
  showToolDetails?: boolean;
  /** Live status during streaming (tool execution updates) */
  liveStatus?: LiveStatus | null;
  /** Authenticated user's display name (from ServiceNow connection) */
  userName?: string;
  /** Dynamic example prompts generated from instance data */
  instancePrompts?: { icon: string; text: string; desc: string }[];
  /** Agent activity log entries for inline display */
  activityLog?: ActivityLogEntry[];
}

/** Deduplicate and clean activity log for display — merge status noise, keep tool entries */
function processActivityLog(entries: ActivityLogEntry[]): ActivityLogEntry[] {
  const result: ActivityLogEntry[] = [];
  for (const entry of entries) {
    // Tool entries always shown (with friendly labels)
    if (entry.phase === "tool" && entry.toolName) {
      result.push(entry);
      continue;
    }
    // Skip noisy status messages that duplicate tool events
    const msg = entry.message;
    if (msg.startsWith("Executing:") || msg.includes("completed")) continue;
    // Collapse "Starting..." and "Round N: Analyzing request..." into one thinking line
    if (msg === "Starting..." || /^Round \d+/.test(msg)) {
      // Only add if last entry isn't already a thinking line
      const last = result[result.length - 1];
      if (last?.phase === "thinking") continue;
      result.push({ ...entry, message: "Analyzing your request..." });
      continue;
    }
    // Collapse "Generating response..." messages
    if (msg === "Generating response...") {
      const last = result[result.length - 1];
      if (last?.message === "Preparing response...") continue;
      result.push({ ...entry, message: "Preparing response..." });
      continue;
    }
    // Keep other status messages as-is
    result.push(entry);
  }
  return result;
}

/** Claude-style inline agent activity — clean, conversational, no icons */
function InlineAgentActivity({ activityLog, liveStatus, onCancel }: { activityLog: ActivityLogEntry[]; liveStatus: LiveStatus | null; onCancel: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest entry
  useEffect(() => {
    if (scrollRef.current && expanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activityLog, expanded]);

  const processed = processActivityLog(activityLog);
  const toolCount = processed.filter(e => e.phase === "tool").length;

  // Header text: latest tool's friendly label or latest status
  const latestEntry = processed[processed.length - 1];
  const headerText = latestEntry
    ? (latestEntry.toolName ? friendlyToolLabel(latestEntry.toolName, latestEntry.toolInput) : latestEntry.message)
    : "Thinking...";

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-default)", background: "var(--surface-secondary)" }}>
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors"
        style={{ background: "var(--surface-secondary)" }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-elevated)")}
        onMouseLeave={e => (e.currentTarget.style.background = "var(--surface-secondary)")}
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "var(--color-primary)", animation: "statusPulse 1.5s ease-in-out infinite" }} />
        <span className="flex-1 text-xs truncate" style={{ color: "var(--text-secondary)" }}>
          {headerText}
          {toolCount > 0 && <span className="ml-2" style={{ color: "var(--text-disabled)" }}>· {toolCount} tool{toolCount !== 1 ? "s" : ""}</span>}
        </span>
        <svg
          className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${expanded ? "rotate-0" : "-rotate-90"}`}
          style={{ color: "var(--text-disabled)" }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Step list */}
      {expanded && (
        <div
          ref={scrollRef}
          className="overflow-y-auto py-1"
          style={{ maxHeight: "220px", borderTop: "1px solid var(--border-default)" }}
        >
          {processed.map((entry, idx) => {
            const isLast = idx === processed.length - 1;
            const isActive = isLast && !!liveStatus;
            const isDone = entry.phase === "tool" ? entry.done !== false : !isActive;
            const label = entry.toolName ? friendlyToolLabel(entry.toolName, entry.toolInput) : entry.message;

            return (
              <div
                key={idx}
                className="flex items-center gap-2.5 px-4 py-1 text-xs"
                style={{ color: isActive ? "var(--text-primary)" : "var(--text-disabled)" }}
              >
                {/* Indicator: pulsing dot for active, checkmark for done */}
                {isActive && !isDone ? (
                  <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-primary)", animation: "statusPulse 1s ease-in-out infinite" }} />
                  </span>
                ) : (
                  <svg className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-disabled)", opacity: 0.6 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                <span className="truncate min-w-0">{label}</span>
              </div>
            );
          })}
          {processed.length === 0 && (
            <div className="flex items-center gap-2.5 px-4 py-1 text-xs" style={{ color: "var(--text-disabled)" }}>
              <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-primary)", animation: "statusPulse 1s ease-in-out infinite" }} />
              </span>
              <span>Thinking...</span>
            </div>
          )}
        </div>
      )}

      {/* Stop button */}
      <div className="flex items-center justify-end px-3 py-1.5" style={{ borderTop: "1px solid var(--border-default)" }}>
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-2 py-0.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 rounded-md transition-colors"
          title="Cancel request"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Stop
        </button>
      </div>
    </div>
  );
}

export default function ChatWindow({ messages, isLoading, onSend, onCancel, onApprove, onChoiceSelect, connected, inputRef, showToolDetails = true, liveStatus, userName, instancePrompts, activityLog = [] }: Props) {
  const [input, setInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  /* ── Voice input state ── */
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Accumulates finalized transcript segments across onresult events
  const finalTranscriptRef = useRef("");

  /** Check browser support on mount */
  useEffect(() => {
    setSpeechSupported(getSpeechRecognition() !== null);
  }, []);

  /** Cleanup on unmount */
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (timerRef.current) clearInterval(timerRef.current);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    };
  }, []);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
    setRecordingSeconds(0);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }
  }, []);

  const startRecording = useCallback(() => {
    const SRCtor = getSpeechRecognition();
    if (!SRCtor) return;

    const recognition = new SRCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;
    finalTranscriptRef.current = input; // preserve existing text

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscriptRef.current += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      // Show finalized + current interim in textarea
      setInput(finalTranscriptRef.current + interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn("SpeechRecognition error:", event.error);
      // "no-speech" and "aborted" are non-fatal — just stop gracefully
      stopRecording();
    };

    recognition.onend = () => {
      // Browser may auto-stop (e.g. silence); sync state
      setIsRecording(false);
      setRecordingSeconds(0);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }
    };

    recognition.start();
    setIsRecording(true);
    setRecordingSeconds(0);

    // Elapsed timer (1s ticks)
    timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    // Hard cap at 2 minutes
    maxTimerRef.current = setTimeout(() => stopRecording(), MAX_RECORDING_MS);
  }, [input, stopRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording();
    else startRecording();
  }, [isRecording, stopRecording, startRecording]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-grow textarea
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    // Clamp between 1 row (~40px) and 50vh
    const maxH = window.innerHeight * 0.5;
    ta.style.height = `${Math.min(ta.scrollHeight, maxH)}px`;
  }, [input, inputRef]);

  const handleSubmit = useCallback(() => {
    if ((!input.trim() && images.length === 0 && files.length === 0) || isLoading) return;
    // Auto-stop recording when user sends a message
    if (isRecording) stopRecording();
    onSend(
      input.trim(),
      images.length > 0 ? images : undefined,
      files.length > 0 ? files : undefined
    );
    setInput("");
    setImages([]);
    setFiles([]);
    // Reset textarea height after sending
    if (inputRef.current) inputRef.current.style.height = "auto";
  }, [input, images, files, isLoading, isRecording, stopRecording, onSend, inputRef]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter = send, Shift+Enter = new line
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    // Shift+Enter allows default behavior (new line in textarea)
  };

  /** Process image files and add as base64 data URIs */
  const addImageFiles = useCallback(async (fileList: FileList | File[]) => {
    const validFiles = Array.from(fileList).filter((f) => {
      if (!f.type.startsWith("image/")) return false;
      if (f.size > MAX_IMAGE_SIZE) {
        console.warn(`Skipping ${f.name}: exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB limit`);
        return false;
      }
      return true;
    });

    const remaining = MAX_IMAGES - images.length;
    const toProcess = validFiles.slice(0, remaining);
    if (toProcess.length === 0) return;

    const dataUris = await Promise.all(toProcess.map(readFileAsDataUri));
    setImages((prev) => [...prev, ...dataUris].slice(0, MAX_IMAGES));
  }, [images.length]);

  /** Process document files and add as FileAttachment objects */
  const addDocFiles = useCallback(async (fileList: FileList | File[]) => {
    const validFiles = Array.from(fileList).filter((f) => {
      if (!DOC_MIME_TYPES.has(f.type)) return false;
      if (f.size > MAX_FILE_SIZE) {
        console.warn(`Skipping ${f.name}: exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
        return false;
      }
      return true;
    });

    const remaining = MAX_FILES - files.length;
    const toProcess = validFiles.slice(0, remaining);
    if (toProcess.length === 0) return;

    const attachments: FileAttachment[] = await Promise.all(
      toProcess.map(async (f) => ({
        name: f.name,
        mimeType: f.type,
        data: await readFileAsBase64(f),
        size: f.size,
      }))
    );
    setFiles((prev) => [...prev, ...attachments].slice(0, MAX_FILES));
  }, [files.length]);

  /** Process any dropped/selected files -- route images vs documents */
  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    const imgFiles = arr.filter((f) => f.type.startsWith("image/"));
    const docFiles = arr.filter((f) => DOC_MIME_TYPES.has(f.type));
    if (imgFiles.length > 0) await addImageFiles(imgFiles);
    if (docFiles.length > 0) await addDocFiles(docFiles);
  }, [addImageFiles, addDocFiles]);

  /** Handle paste — intercept images and documents from clipboard */
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/") || DOC_MIME_TYPES.has(item.type)) {
        const file = item.getAsFile();
        if (file) pastedFiles.push(file);
      }
    }
    if (pastedFiles.length > 0) {
      e.preventDefault();
      addFiles(pastedFiles);
    }
  }, [addFiles]);

  /** Handle drag & drop */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const showEmptyState = messages.every((m) => m.role === "system");

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ background: "var(--surface-app)" }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-2 sm:px-6 py-4 sm:py-6">
        <div className="max-w-3xl mx-auto space-y-4 sm:space-y-5">
          {showEmptyState && (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center max-w-lg mx-auto px-2">
                <div className="w-24 h-24 sm:w-40 sm:h-40 mx-auto -mb-1 flex items-center justify-center">
                  <Image src={APP_LOGO} alt={APP_NAME} width={160} height={160} className="rounded-xl" unoptimized />
                </div>
                <h2 className="text-display mb-1" style={{ color: "var(--text-primary)", fontSize: "clamp(20px, 4vw, 32px)" }}>
                  {APP_TAGLINE}
                </h2>
                <p className="phase-label mb-3 sm:mb-4" style={{ fontSize: "11px" }}>
                  {APP_SUBTITLE}
                </p>
                <p className="text-small mb-4 sm:mb-6" style={{ color: "var(--text-disabled)" }}>
                  {connected
                    ? `You're connected! Describe what you need — ${APP_NAME} builds, tests, and deploys it on your ServiceNow instance.`
                    : `Open the settings panel, connect your instance, and tell ${APP_NAME} what to build.`}
                </p>
                {connected && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(instancePrompts && instancePrompts.length > 0 ? instancePrompts : DEFAULT_PROMPTS).map((p, i) => (
                      <button
                        key={i}
                        onClick={() => onSend(p.text)}
                        className="text-left p-3 rounded-md transition-all group overflow-hidden"
                        style={{ background: "var(--surface-secondary)", border: "1px solid var(--border-default)" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-emphasis)"; e.currentTarget.style.background = "var(--surface-elevated)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.background = "var(--surface-secondary)"; }}
                      >
                        <span className="text-lg">{p.icon}</span>
                        <p className="text-[12px] mt-1 transition-colors line-clamp-2 break-words" style={{ color: "var(--text-secondary)" }}>{p.text}</p>
                        <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--text-disabled)" }}>{p.desc}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {messages.filter((msg) => !msg.hidden).map((msg, i) => (
            <MessageBubble
              key={i}
              message={msg}
              onApprove={onApprove}
              onChoiceSelect={onChoiceSelect}
              showToolDetails={showToolDetails}
              userName={userName}
            />
          ))}

          {isLoading && (
            <InlineAgentActivity
              activityLog={activityLog}
              liveStatus={liveStatus ?? null}
              onCancel={onCancel}
            />
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div
        className="p-2 sm:p-4 transition-colors"
        style={{
          borderTop: "1px solid var(--border-default)",
          background: dragOver ? "rgba(76,125,255,0.04)" : "var(--surface-primary)",
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="max-w-3xl mx-auto">
          {/* Image previews */}
          {images.length > 0 && (
            <div className="flex gap-2 mb-2 flex-wrap">
              {images.map((img, i) => (
                <div key={i} className="relative group">
                  <img src={img} alt={`Attachment ${i + 1}`} className="h-16 w-16 object-cover rounded-md" style={{ border: "1px solid var(--border-emphasis)" }} />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 hover:bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove image"
                  >
                    ×
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-16 w-16 rounded-md flex items-center justify-center transition-colors"
                  style={{ border: "1px dashed var(--border-emphasis)", color: "var(--text-disabled)" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--text-secondary)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-emphasis)"; e.currentTarget.style.color = "var(--text-disabled)"; }}
                  title="Add another image"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
              )}
            </div>
          )}

          {/* Document file previews */}
          {files.length > 0 && (
            <div className="flex gap-2 mb-2 flex-wrap">
              {files.map((f, i) => (
                <div key={i} className="relative group flex items-center gap-2 px-3 py-2 rounded-md" style={{ background: "var(--surface-secondary)", border: "1px solid var(--border-emphasis)" }}>
                  <span className="text-lg">{fileIcon(f.name)}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] truncate max-w-[120px]" style={{ color: "var(--text-primary)" }}>{f.name}</span>
                    <span className="text-[10px]" style={{ color: "var(--text-disabled)" }}>{formatSize(f.size)}</span>
                  </div>
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: "var(--color-danger)" }}
                    title="Remove file"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Drag overlay hint */}
          {dragOver && (
            <div className="mb-2 py-3 rounded-md text-center text-xs" style={{ border: "2px dashed rgba(76,125,255,0.4)", color: "var(--color-info)" }}>
              Drop images or documents here
            </div>
          )}

          {/* Recording indicator -- prominent bar with clear controls */}
          {isRecording && (
            <div className="flex items-center gap-3 mb-2 px-4 py-2.5 rounded-md" style={{ background: "rgba(249,115,115,0.06)", border: "1px solid rgba(249,115,115,0.2)" }}>
              {/* Pulsing red dot */}
              <span className="relative flex h-3 w-3 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              {/* Timer */}
              <span className="font-mono tabular-nums text-sm text-red-200 font-medium">
                {Math.floor(recordingSeconds / 60).toString().padStart(2, "0")}:{(recordingSeconds % 60).toString().padStart(2, "0")}
              </span>
              {/* Waveform animation bars */}
              <div className="flex items-center gap-[3px] h-5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="w-[3px] bg-red-400/80 rounded-full"
                    style={{
                      animation: `voiceBar 0.8s ease-in-out ${i * 0.12}s infinite alternate`,
                      height: "40%",
                    }}
                  />
                ))}
              </div>
              <span className="text-xs text-red-300/80 ml-1">Listening...</span>
              {/* Remaining time */}
              <span className="ml-auto text-red-400/50 text-[10px] tabular-nums">
                {Math.floor((MAX_RECORDING_MS / 1000 - recordingSeconds) / 60)}:{((MAX_RECORDING_MS / 1000 - recordingSeconds) % 60).toString().padStart(2, "0")} left
              </span>
              {/* Stop button */}
              <button
                onClick={stopRecording}
                className="ml-1 px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg transition-colors flex-shrink-0"
              >
                Stop
              </button>
            </div>
          )}

          <div className="flex gap-2 items-end">
            {/* Image upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!connected || isLoading || images.length >= MAX_IMAGES}
              className="p-3 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) { e.currentTarget.style.background = "var(--surface-elevated)"; e.currentTarget.style.color = "var(--text-primary)"; }}}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
              title="Attach image (paste or drag also works)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files) addImageFiles(e.target.files); e.target.value = ""; }}
            />
            {/* Document upload button */}
            <button
              onClick={() => docInputRef.current?.click()}
              disabled={!connected || isLoading || files.length >= MAX_FILES}
              className="p-3 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) { e.currentTarget.style.background = "var(--surface-elevated)"; e.currentTarget.style.color = "var(--text-primary)"; }}}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
              title="Attach document (PDF, Word, Excel)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <input
              ref={docInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files) addDocFiles(e.target.files); e.target.value = ""; }}
            />

            {/* Auto-growing textarea */}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={connected ? "Ask me anything about your ServiceNow instance..." : "Connect first →"}
              disabled={!connected || isLoading}
              rows={1}
              className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-md text-sm focus:outline-none focus:ring-2 disabled:opacity-50 resize-none overflow-y-auto"
              style={{
                background: "var(--surface-secondary)",
                border: "1px solid var(--border-emphasis)",
                color: "var(--text-primary)",
                maxHeight: "50vh",
                /* focus ring handled by focus:ring-2 + custom color */
                "--tw-ring-color": "var(--color-info)",
              } as React.CSSProperties}
            />

            {/* Voice input button */}
            {speechSupported && (
              <button
                onClick={toggleRecording}
                disabled={!connected || isLoading}
                className="flex items-center gap-1.5 rounded-md transition-all flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  padding: isRecording ? "10px 12px" : "12px",
                  background: isRecording ? "var(--color-danger)" : "transparent",
                  color: isRecording ? "white" : "var(--text-secondary)",
                }}
                title={isRecording ? "Stop recording" : "Voice input (speech-to-text)"}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isRecording ? (
                    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z" />
                  )}
                </svg>
                {isRecording && <span className="text-xs font-medium">Stop</span>}
              </button>
            )}
            {!speechSupported && (
              <div className="p-3 flex-shrink-0 cursor-not-allowed" style={{ color: "var(--text-disabled)" }} title="Voice input not supported. Use Chrome or Edge.">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                </svg>
              </div>
            )}

            {/* Send / Stop button */}
            {isLoading ? (
              <button
                onClick={onCancel}
                className="p-3 rounded-md transition-colors flex-shrink-0"
                style={{ background: "var(--color-danger)", color: "white" }}
                title="Cancel request"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!connected || (!input.trim() && images.length === 0 && files.length === 0)}
                className="p-3 rounded-md transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: (connected && (input.trim() || images.length > 0 || files.length > 0)) ? "var(--color-primary)" : "var(--surface-elevated)",
                  color: (connected && (input.trim() || images.length > 0 || files.length > 0)) ? "white" : "var(--text-disabled)",
                }}
                title="Send (Enter)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            )}
          </div>
          {/* Keyboard hints */}
          <div className="hidden sm:flex gap-2 mt-2">
            <div className="w-[44px] flex-shrink-0" />
            <div className="flex-1 flex items-center justify-center gap-5 px-4 py-1.5 rounded-md text-xs" style={{ background: "var(--surface-secondary)", border: "1px solid var(--border-subtle)" }}>
              <span className="flex items-center gap-1.5 font-medium" style={{ color: "var(--color-info)" }}>
                <kbd className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold" style={{ background: "rgba(76,125,255,0.1)", border: "1px solid rgba(76,125,255,0.2)", color: "var(--color-info)" }}>Enter</kbd>
                <span className="ml-0.5">to Send</span>
              </span>
              <span style={{ color: "var(--border-emphasis)" }}>│</span>
              <span className="flex items-center gap-1.5 font-medium" style={{ color: "var(--text-secondary)" }}>
                <kbd className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-emphasis)", color: "var(--text-primary)" }}>⇧ Shift</kbd>
                <span style={{ color: "var(--text-disabled)" }}>+</span>
                <kbd className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-emphasis)", color: "var(--text-primary)" }}>Enter</kbd>
                <span className="ml-0.5">for New Line</span>
              </span>
              <span style={{ color: "var(--border-emphasis)" }}>│</span>
              <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Paste or drag images/docs</span>
            </div>
            <div className="w-[44px] flex-shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
}

