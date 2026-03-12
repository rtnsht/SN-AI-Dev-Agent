"use client";

import { useState, useRef, useEffect, useCallback, type RefObject } from "react";
import type { ChatMessage, SDLCPhase, LiveStatus, FileAttachment } from "@/lib/types";
import MessageBubble from "./MessageBubble";
import Image from "next/image";
import { APP_NAME, APP_LOGO, APP_HERO_TAGLINE, APP_SUBTITLE, APP_TAGLINE, HERO_FEATURES } from "@/lib/branding";

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



/** Suggestion tab categories */
const SUGGESTION_TABS = [
  { key: "foryou", label: "For you", icon: "sparkles" },
  { key: "build", label: "Build a feature", icon: "folder" },
  { key: "explore", label: "Explore instance", icon: "code" },
  { key: "quick", label: "Quick queries", icon: "list" },
] as const;

type TabKey = typeof SUGGESTION_TABS[number]["key"];

/** Categorized suggestions */
const SUGGESTION_DATA: Record<TabKey, string[]> = {
  foryou: [
    "Build a high-priority incident justification feature with manager approval",
    "Create a catalog item for requesting a new laptop with approval workflow",
    "Analyze my instance health and show me any anti-patterns",
    "List all custom business rules on the incident table",
  ],
  build: [
    "Build an onboarding workflow that provisions accounts across IT systems",
    "Create a change request template with risk assessment and CAB approval",
    "Add a custom field to incident that tracks customer sentiment",
    "Build a knowledge article approval workflow with draft and publish states",
  ],
  explore: [
    "Show me all active business rules on the incident table",
    "Audit my ACLs and find any overly permissive rules",
    "List all scheduled jobs and their run frequencies",
    "Find unused script includes in my instance",
  ],
  quick: [
    "How many open incidents are assigned to my group?",
    "What update sets are in progress right now?",
    "Show the schema for the cmdb_ci_server table",
    "List all notification email templates for incidents",
  ],
};



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
  /** Task planner: group this entry under a task */
  taskId?: number;
  taskName?: string;
}

/** Structured task plan from the planner */
export interface TaskPlanDisplay {
  analysis: string;
  tasks: { id: number; name: string; type: string; tools: { name: string; args: Record<string, unknown> }[] }[];
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
  /** Structured task plan from the planner */
  taskPlan?: TaskPlanDisplay | null;
}

/** Deduplicate and clean activity log for display — merge status noise, keep tool entries */
function processActivityLog(entries: ActivityLogEntry[]): ActivityLogEntry[] {
  const result: ActivityLogEntry[] = [];
  for (const entry of entries) {
    // Task entries always shown
    if (entry.phase === "task" && entry.taskId != null) {
      result.push(entry);
      continue;
    }
    // Tool entries always shown (with friendly labels)
    if (entry.phase === "tool" && entry.toolName) {
      result.push(entry);
      continue;
    }
    // Skip noisy status messages that duplicate tool events
    const msg = entry.message;
    if (msg.startsWith("Executing:") || msg.includes("completed")) continue;
    // Skip planner status messages that are redundant with task events
    if (msg === "Planning execution..." || msg === "Executing plan...") continue;
    if (msg.startsWith("Task:")) continue; // Covered by task entries
    // Collapse "Starting..." and "Round N: Analyzing request..." — only keep the first one
    if (msg === "Starting..." || /^Round \d+/.test(msg)) {
      const last = result[result.length - 1];
      if (last?.phase === "thinking") continue;
      result.push({ ...entry, message: "Reasoning" });
      continue;
    }
    // Collapse "Generating response..." messages
    if (msg === "Generating response...") {
      const last = result[result.length - 1];
      if (last?.message === "Composing response") continue;
      result.push({ ...entry, message: "Composing response" });
      continue;
    }
    // Keep other status messages as-is
    result.push(entry);
  }
  return result;
}

/** Group activity entries by task for two-level rendering */
interface TaskGroup {
  taskEntry: ActivityLogEntry;
  toolEntries: ActivityLogEntry[];
}

function groupByTask(entries: ActivityLogEntry[]): { tasks: TaskGroup[]; ungrouped: ActivityLogEntry[] } {
  const tasks: TaskGroup[] = [];
  const ungrouped: ActivityLogEntry[] = [];
  let currentTask: TaskGroup | null = null;

  for (const entry of entries) {
    if (entry.phase === "task" && entry.taskId != null) {
      // Start a new task group
      currentTask = { taskEntry: entry, toolEntries: [] };
      tasks.push(currentTask);
    } else if (entry.phase === "tool" && currentTask && entry.taskId === currentTask.taskEntry.taskId) {
      // Tool belongs to current task
      currentTask.toolEntries.push(entry);
    } else if (entry.phase === "tool" && currentTask) {
      // Tool with matching or no taskId — add to current task if it's still being built
      currentTask.toolEntries.push(entry);
    } else {
      // Non-task, non-grouped-tool entry
      ungrouped.push(entry);
    }
  }

  return { tasks, ungrouped };
}

/** Single timeline entry — used for flat rendering (no planner) */
function TimelineEntry({ entry, isLast, liveStatus }: { entry: ActivityLogEntry; isLast: boolean; liveStatus: LiveStatus | null }) {
  const isActive = isLast && !!liveStatus;
  const isDone = entry.phase === "tool" ? entry.done !== false : !isActive;
  const label = entry.toolName ? friendlyToolLabel(entry.toolName, entry.toolInput) : entry.message;
  const isTool = entry.phase === "tool";

  return (
    <div
      className="relative flex items-start gap-3 py-[5px] transition-opacity duration-300"
      style={{ opacity: isActive ? 1 : isDone ? 0.7 : 0.4 }}
    >
      <div className="relative z-[1] flex-shrink-0 mt-[2px]">
        {isActive && !isDone ? (
          <span className="flex items-center justify-center w-[14px] h-[14px]">
            <span className="absolute w-[14px] h-[14px] rounded-full" style={{ background: "var(--color-primary)", opacity: 0.15, animation: "activityRipple 1.5s ease-out infinite" }} />
            <span className="w-[6px] h-[6px] rounded-full" style={{ background: "var(--color-primary)" }} />
          </span>
        ) : (
          <span className="flex items-center justify-center w-[14px] h-[14px]">
            {isTool ? (
              <svg className="w-[12px] h-[12px]" style={{ color: "var(--color-primary)", opacity: 0.5 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <span className="w-[5px] h-[5px] rounded-full" style={{ background: "var(--text-disabled)", opacity: 0.5 }} />
            )}
          </span>
        )}
      </div>
      <span
        className={`text-[12px] truncate min-w-0 ${isTool ? "font-medium" : ""}`}
        style={{ color: isActive ? "var(--text-primary)" : isTool ? "var(--text-secondary)" : "var(--text-disabled)" }}
      >
        {label}
      </span>
    </div>
  );
}

/** Elegant inline agent activity — timeline-style with visual hierarchy */
function InlineAgentActivity({ activityLog, liveStatus, onCancel }: { activityLog: ActivityLogEntry[]; liveStatus: LiveStatus | null; onCancel: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startTime = useRef(Date.now());

  // Auto-scroll to latest entry
  useEffect(() => {
    if (scrollRef.current && expanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activityLog, expanded]);

  const processed = processActivityLog(activityLog);
  const toolCount = processed.filter(e => e.phase === "tool").length;
  const taskCount = processed.filter(e => e.phase === "task").length;
  const elapsed = Math.round((Date.now() - startTime.current) / 1000);

  // Determine if we have task-grouped entries (planner was used)
  const hasTasks = taskCount > 0;

  // Header text: latest tool's friendly label, task name, or latest status
  const latestEntry = processed[processed.length - 1];
  const headerText = latestEntry
    ? (latestEntry.taskName ? `Task: ${latestEntry.taskName}` : latestEntry.toolName ? friendlyToolLabel(latestEntry.toolName, latestEntry.toolInput) : latestEntry.message)
    : "Thinking...";

  // Group tool entries under their parent task (for two-level rendering)
  const taskGroups = hasTasks ? groupByTask(processed) : null;

  return (
    <div className="agent-activity-container rounded-xl overflow-hidden" style={{ background: "var(--surface-secondary)", border: "1px solid color-mix(in srgb, var(--color-primary) 15%, var(--border-default))" }}>
      {/* Header bar with shimmer accent */}
      <div className="relative">
        <div className="agent-activity-shimmer" />
        <div
          onClick={() => setExpanded(!expanded)}
          className="relative w-full flex items-center gap-3 px-4 py-3 text-left transition-colors z-[1] cursor-pointer"
          style={{ background: "transparent" }}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setExpanded(!expanded); }}
        >
          {/* Animated orbital indicator */}
          <span className="agent-activity-orbit flex-shrink-0">
            <span className="w-2 h-2 rounded-full block" style={{ background: "var(--color-primary)" }} />
          </span>
          <div className="flex-1 min-w-0">
            <span className="text-[13px] font-medium truncate block" style={{ color: "var(--text-primary)" }}>
              {headerText}
            </span>
            <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-disabled)" }}>
              {hasTasks
                ? `${taskCount} task${taskCount !== 1 ? "s" : ""}${toolCount > 0 ? ` · ${toolCount} tool${toolCount !== 1 ? "s" : ""}` : ""}`
                : toolCount > 0 ? `${toolCount} tool${toolCount !== 1 ? "s" : ""} used` : "Processing"}
              {elapsed > 0 && ` · ${elapsed}s`}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onCancel(); }}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md transition-all"
              style={{ color: "var(--text-disabled)", background: "var(--surface-elevated)", border: "1px solid var(--border-default)" }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--color-error, #ef4444)"; e.currentTarget.style.borderColor = "color-mix(in srgb, var(--color-error, #ef4444) 40%, transparent)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text-disabled)"; e.currentTarget.style.borderColor = "var(--border-default)"; }}
              title="Stop generation"
            >
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="2" width="8" height="8" rx="1.5" /></svg>
              Stop
            </button>
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? "rotate-0" : "-rotate-90"}`}
              style={{ color: "var(--text-disabled)" }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Timeline step list */}
      {expanded && (
        <div
          ref={scrollRef}
          className="overflow-y-auto"
          style={{ maxHeight: "240px" }}
        >
          <div className="relative px-4 py-2">
            {/* Vertical timeline line */}
            {processed.length > 1 && (
              <div
                className="absolute left-[25px] top-3 bottom-3 w-px"
                style={{ background: "color-mix(in srgb, var(--color-primary) 12%, transparent)" }}
              />
            )}

            {/* ── Two-level rendering: tasks → tools grouped underneath ── */}
            {taskGroups ? (
              <>
                {/* Ungrouped entries (thinking, status) before tasks */}
                {taskGroups.ungrouped.map((entry, idx) => (
                  <TimelineEntry key={`ug-${idx}`} entry={entry} isLast={false} liveStatus={liveStatus} />
                ))}
                {/* Task groups with nested tools */}
                {taskGroups.tasks.map((group, tIdx) => {
                  const isLastTask = tIdx === taskGroups.tasks.length - 1;
                  const taskDone = group.taskEntry.done !== false;
                  const taskActive = isLastTask && !taskDone && !!liveStatus;
                  return (
                    <div key={`task-${group.taskEntry.taskId}`} className="mb-1">
                      {/* Task header */}
                      <div
                        className="relative flex items-start gap-3 py-[5px] transition-opacity duration-300"
                        style={{ opacity: taskActive ? 1 : taskDone ? 0.8 : 0.5 }}
                      >
                        <div className="relative z-[1] flex-shrink-0 mt-[2px]">
                          {taskActive ? (
                            <span className="flex items-center justify-center w-[14px] h-[14px]">
                              <span className="absolute w-[14px] h-[14px] rounded-full" style={{ background: "var(--color-primary)", opacity: 0.15, animation: "activityRipple 1.5s ease-out infinite" }} />
                              <span className="w-[6px] h-[6px] rounded-full" style={{ background: "var(--color-primary)" }} />
                            </span>
                          ) : taskDone ? (
                            <span className="flex items-center justify-center w-[14px] h-[14px]">
                              <svg className="w-[12px] h-[12px]" style={{ color: "var(--color-primary)", opacity: 0.6 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          ) : (
                            <span className="flex items-center justify-center w-[14px] h-[14px]">
                              <span className="w-[6px] h-[6px] rounded-full border" style={{ borderColor: "var(--text-disabled)" }} />
                            </span>
                          )}
                        </div>
                        <span className="text-[12px] font-medium truncate min-w-0" style={{ color: taskActive ? "var(--text-primary)" : taskDone ? "var(--text-secondary)" : "var(--text-disabled)" }}>
                          {group.taskEntry.taskName || group.taskEntry.message}
                        </span>
                      </div>
                      {/* Nested tool entries under this task */}
                      {group.toolEntries.map((toolEntry, tIdx2) => (
                        <div
                          key={`tool-${tIdx}-${tIdx2}`}
                          className="relative flex items-start gap-2 py-[3px] pl-8 transition-opacity duration-300"
                          style={{ opacity: toolEntry.done !== false ? 0.6 : 0.4 }}
                        >
                          <span className="flex items-center justify-center w-[10px] h-[10px] flex-shrink-0 mt-[2px]">
                            {toolEntry.done !== false ? (
                              <svg className="w-[10px] h-[10px]" style={{ color: "var(--color-primary)", opacity: 0.4 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <span className="w-[4px] h-[4px] rounded-full" style={{ background: "var(--text-disabled)", opacity: 0.4 }} />
                            )}
                          </span>
                          <span className="text-[11px] truncate min-w-0" style={{ color: "var(--text-disabled)" }}>
                            {friendlyToolLabel(toolEntry.toolName!, toolEntry.toolInput)}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </>
            ) : (
              /* ── Flat rendering: original behavior when no planner ── */
              <>
                {processed.map((entry, idx) => (
                  <TimelineEntry key={idx} entry={entry} isLast={idx === processed.length - 1} liveStatus={liveStatus} />
                ))}
              </>
            )}

            {processed.length === 0 && (
              <div className="flex items-center gap-3 py-[5px]">
                <span className="flex items-center justify-center w-[14px] h-[14px] flex-shrink-0">
                  <span className="absolute w-[14px] h-[14px] rounded-full" style={{ background: "var(--color-primary)", opacity: 0.15, animation: "activityRipple 1.5s ease-out infinite" }} />
                  <span className="w-[6px] h-[6px] rounded-full" style={{ background: "var(--color-primary)" }} />
                </span>
                <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Thinking...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatWindow({ messages, isLoading, onSend, onCancel, onApprove, onChoiceSelect, connected, inputRef, showToolDetails = true, liveStatus, userName, instancePrompts, activityLog = [], taskPlan }: Props) {
  const [input, setInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("foryou");
  const [showAttachDropdown, setShowAttachDropdown] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const attachDropdownRef = useRef<HTMLDivElement>(null);

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

  /** Close attach dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (attachDropdownRef.current && !attachDropdownRef.current.contains(e.target as Node)) {
        setShowAttachDropdown(false);
      }
    };
    if (showAttachDropdown) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAttachDropdown]);

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

  /* ── Resolve which suggestions to show based on active tab ── */
  const currentSuggestions = activeTab === "foryou" && instancePrompts && instancePrompts.length > 0
    ? instancePrompts.map((p) => p.text)
    : SUGGESTION_DATA[activeTab];

  /* ── Tab icon helper ── */
  const tabIcon = (icon: string) => {
    switch (icon) {
      case "sparkles": return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" /></svg>;
      case "folder": return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>;
      case "code": return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>;
      case "list": return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12M3.75 6.75h.007v.008H3.75V6.75zm0 5.25h.007v.008H3.75V12zm0 5.25h.007v.008H3.75v-.008z" /></svg>;
      default: return null;
    }
  };

  /* ── Shared input bar (used in both hero and bottom) ── */
  const renderInputBar = (inHero: boolean) => (
    <div
      className={`hero-input-container ${inHero ? "w-full" : ""} ${isRecording ? "recording" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Image previews */}
      {images.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {images.map((img, i) => (
            <div key={i} className="relative group">
              <img src={img} alt={`Attachment ${i + 1}`} className="h-14 w-14 object-cover rounded-lg" style={{ border: "1px solid var(--border-emphasis)" }} />
              <button onClick={() => removeImage(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 hover:bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="Remove">×</button>
            </div>
          ))}
        </div>
      )}
      {/* Document file previews */}
      {files.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {files.map((f, i) => (
            <div key={i} className="relative group flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-emphasis)" }}>
              <span className="text-base">{fileIcon(f.name)}</span>
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] truncate max-w-[120px]" style={{ color: "var(--text-primary)" }}>{f.name}</span>
                <span className="text-[10px]" style={{ color: "var(--text-disabled)" }}>{formatSize(f.size)}</span>
              </div>
              <button onClick={() => removeFile(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "var(--color-danger)" }} title="Remove">x</button>
            </div>
          ))}
        </div>
      )}
      {/* Drag overlay */}
      {dragOver && (
        <div className="mb-2 py-3 rounded-lg text-center text-xs" style={{ border: "2px dashed rgba(76,125,255,0.4)", color: "var(--color-info)" }}>
          Drop images or documents here
        </div>
      )}
      {isRecording ? (
        /* ════ RECORDING MODE — full takeover ════ */
        <>
          {/* Transcript area (live text as it comes in) */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Listening..."
            rows={1}
            className="w-full bg-transparent text-sm focus:outline-none resize-none overflow-y-auto"
            style={{ color: "var(--text-primary)", maxHeight: inHero ? "120px" : "50vh", opacity: input ? 1 : 0.5 }}
          />
          {/* Recording controls row */}
          <div className="flex items-center gap-3 mt-3">
            {/* Waveform visualizer */}
            <div className="flex items-center gap-[2px] h-6">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <span
                  key={i}
                  className="w-[2.5px] rounded-full"
                  style={{
                    background: "var(--text-disabled)",
                    animation: `voiceBar 0.7s ease-in-out ${i * 0.09}s infinite alternate`,
                    height: "30%",
                  }}
                />
              ))}
            </div>
            {/* Timer */}
            <span className="font-mono tabular-nums text-xs" style={{ color: "var(--text-disabled)" }}>
              {Math.floor(recordingSeconds / 60).toString().padStart(2, "0")}:{(recordingSeconds % 60).toString().padStart(2, "0")}
            </span>

            <div className="flex-1" />

            {/* Cancel (discard) */}
            <button
              onClick={() => { stopRecording(); setInput(""); }}
              className="text-xs px-3 py-1 rounded-full transition-colors"
              style={{ color: "var(--text-secondary)", background: "var(--surface-elevated)" }}
              title="Cancel recording"
            >
              Cancel
            </button>
            {/* Stop & keep */}
            <button
              onClick={stopRecording}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all voice-stop-btn"
              title="Done"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2" /></svg>
            </button>
          </div>
        </>
      ) : (
        /* ════ NORMAL INPUT MODE ════ */
        <>
          {/* Textarea row */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={connected ? "What should we work on next?" : "Connect your instance first →"}
            disabled={!connected || isLoading}
            rows={1}
            className="w-full bg-transparent text-sm focus:outline-none disabled:opacity-50 resize-none overflow-y-auto"
            style={{ color: "var(--text-primary)", maxHeight: inHero ? "120px" : "50vh" }}
          />
          {/* Bottom row: + button, mic, send */}
          <div className="flex items-center gap-1 mt-2">
            {/* + Attach button with dropdown */}
            <div className="relative" ref={attachDropdownRef}>
              <button
                onClick={() => setShowAttachDropdown((v) => !v)}
                disabled={!connected || isLoading}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ border: "1px solid var(--border-emphasis)", color: "var(--text-secondary)" }}
                title="Attach file"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </button>
              {showAttachDropdown && (
                <div className="attach-dropdown">
                  <button className="attach-dropdown-item" onClick={() => { fileInputRef.current?.click(); setShowAttachDropdown(false); }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" /></svg>
                    Image
                  </button>
                  <button className="attach-dropdown-item" onClick={() => { docInputRef.current?.click(); setShowAttachDropdown(false); }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                    Document
                  </button>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) addImageFiles(e.target.files); e.target.value = ""; }} />
            <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" multiple className="hidden" onChange={(e) => { if (e.target.files) addDocFiles(e.target.files); e.target.value = ""; }} />

            <div className="flex-1" />

            {/* Mic button */}
            {speechSupported && (
              <button
                onClick={toggleRecording}
                disabled={!connected || isLoading}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ color: "var(--text-disabled)" }}
                title="Voice input"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z" />
                </svg>
              </button>
            )}

            {/* Send / Stop */}
            {isLoading ? (
              <button onClick={onCancel} className="w-8 h-8 rounded-full flex items-center justify-center transition-colors" style={{ background: "var(--color-danger)", color: "white" }} title="Cancel">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!connected || (!input.trim() && images.length === 0 && files.length === 0)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: (connected && (input.trim() || images.length > 0 || files.length > 0)) ? "var(--text-primary)" : "var(--surface-elevated)",
                  color: (connected && (input.trim() || images.length > 0 || files.length > 0)) ? "var(--surface-app)" : "var(--text-disabled)",
                }}
                title="Send (Enter)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" /></svg>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ background: "var(--surface-app)" }}>
      {showEmptyState ? (
        /* ════ EMPTY STATE — two modes: disconnected (full hero) vs connected (ready-to-chat) ════ */
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 overflow-y-auto">
          <div className="w-full max-w-2xl mx-auto flex flex-col items-center">

            {/* ── DISCONNECTED: Full branded hero landing page ── */}
            {!connected && (
              <>
                {/* Logo */}
                {APP_LOGO && (
                  <div className="hero-logo-container mb-5">
                    <Image
                      src={APP_LOGO}
                      alt={APP_NAME || "App Logo"}
                      width={180}
                      height={180}
                      className="hero-logo w-32 h-32 sm:w-40 sm:h-40 md:w-[180px] md:h-[180px]"
                      unoptimized
                      priority
                    />
                  </div>
                )}

                {/* App Name */}
                {APP_NAME && (
                  <h1
                    className="text-2xl sm:text-3xl md:text-4xl font-semibold text-center mb-1 tracking-tight"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {APP_NAME}
                  </h1>
                )}

                {/* Tagline */}
                {(APP_TAGLINE || APP_HERO_TAGLINE) && (
                  <p className="hero-tagline text-center mb-1" style={{ fontSize: "clamp(18px, 3vw, 28px)" }}>
                    {APP_HERO_TAGLINE || APP_TAGLINE}
                  </p>
                )}

                {/* Subtitle */}
                {APP_SUBTITLE && (
                  <p className="text-center mb-6 text-xs sm:text-sm" style={{ color: "var(--text-disabled)", letterSpacing: "0.04em" }}>
                    {APP_SUBTITLE}
                  </p>
                )}
                {!APP_SUBTITLE && <div className="mb-6" />}

                {/* Feature Description Pills */}
                {HERO_FEATURES.length > 0 && (
                  <div className="hero-features-block w-full mb-8 rounded-xl px-4 sm:px-6 py-5 sm:py-6">
                    <div className="relative z-[1] space-y-4 sm:space-y-5">
                      {HERO_FEATURES.map((feature, i) => (
                        <div key={i} className="flex gap-3.5 items-start">
                          <span
                            className="hero-feature-dot flex-shrink-0 mt-[8px] w-2.5 h-2.5 rounded-full"
                            style={{
                              background: i === 0 ? "var(--color-primary)" : i === 1 ? "var(--color-accent-from, var(--color-primary))" : "var(--text-disabled)",
                              boxShadow: i < 2 ? `0 0 8px ${i === 0 ? "var(--color-primary)" : "var(--color-accent-from, var(--color-primary))"}` : "none",
                            }}
                          />
                          <div className="min-w-0">
                            <p className="text-[14px] sm:text-[15px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
                              {feature.title}
                            </p>
                            <p className="text-[12px] sm:text-[13px] mt-1 leading-relaxed" style={{ color: "var(--text-secondary)", opacity: 0.85 }}>
                              {feature.desc}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input bar (disabled) */}
                {renderInputBar(true)}

                {/* Connect prompt */}
                <p className="text-center mt-6 text-sm" style={{ color: "var(--text-disabled)" }}>
                  Open settings and connect your instance to get started.
                </p>
              </>
            )}

            {/* ── CONNECTED: Clean ready-to-chat state with glowing input ── */}
            {connected && (
              <>
                {/* Compact logo + greeting */}
                {APP_LOGO && (
                  <div className="hero-logo-container mb-4">
                    <Image
                      src={APP_LOGO}
                      alt={APP_NAME || "App Logo"}
                      width={80}
                      height={80}
                      className="hero-logo w-16 h-16 sm:w-20 sm:h-20"
                      unoptimized
                    />
                  </div>
                )}
                <h2
                  className="text-xl sm:text-2xl font-semibold text-center mb-1 tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {APP_HERO_TAGLINE || APP_TAGLINE || "What should we build?"}
                </h2>
                <p className="text-center mb-6 text-xs sm:text-sm" style={{ color: "var(--text-disabled)" }}>
                  {APP_SUBTITLE || "Describe what you need and let's get started."}
                </p>

                {/* Glowing input bar */}
                <div className="hero-input-glow w-full">
                  {renderInputBar(true)}
                </div>

                {/* Suggestion tabs */}
                <div className="mt-6 w-full">
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {SUGGESTION_TABS.map((tab) => (
                      <button
                        key={tab.key}
                        className={`suggestion-tab ${activeTab === tab.key ? "active" : ""}`}
                        onClick={() => setActiveTab(tab.key)}
                      >
                        {tabIcon(tab.icon)}
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 space-y-0.5">
                    {currentSuggestions.map((text, i) => (
                      <button
                        key={`${activeTab}-${i}`}
                        className="suggestion-item"
                        onClick={() => onSend(text)}
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* ════ CHAT MODE ════ */
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-2 sm:px-6 py-4 sm:py-6">
            <div className="max-w-3xl mx-auto space-y-4 sm:space-y-5">
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

          {/* Bottom input bar */}
          <div className="p-2 sm:p-4" style={{ borderTop: "1px solid var(--border-default)", background: "var(--surface-primary)" }}>
            <div className="max-w-3xl mx-auto">
              {renderInputBar(false)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

