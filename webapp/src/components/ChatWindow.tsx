"use client";

import { useState, useRef, useEffect, useCallback, type RefObject } from "react";
import { useRotatingText } from "@/hooks/useRotatingText";
import type { ChatMessage, SDLCPhase, LiveStatus, FileAttachment, CategorizedPrompts, ExamplePrompt, UpdateSetSummary } from "@/lib/types";
import { SDLC_PHASES } from "@/lib/types";
import MessageBubble from "./MessageBubble";
import { APP_NAME, APP_LOGO, APP_HERO_TAGLINE, APP_SUBTITLE, APP_TAGLINE, HERO_FEATURES, WELCOME_BADGE } from "@/lib/branding";
import AppLogo from "./AppLogo";
import { SUGGESTION_FALLBACK } from "@/lib/suggestion-engine";
import CommandPalette from "./CommandPalette";
import SDDModeChip from "./SDDModeChip";
import ChatSearch from "./ChatSearch";
import ChatTOC from "./ChatTOC";
import { isSlashPrefix, type CommandContext } from "@/lib/slash-commands";

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
  { key: "updates", label: "Latest Updates", icon: "globe" },
] as const;

type TabKey = typeof SUGGESTION_TABS[number]["key"];

/** Re-export shared fallback for use in this component (imported from suggestion-engine) */
const FALLBACK = SUGGESTION_FALLBACK as Record<TabKey, ExamplePrompt[]>;



/* ── Hero rotating text — auto-toggles between multiple strings ── */
function HeroRotatingText({ texts, interval = 12000, className = "" }: { texts: string[]; interval?: number; className?: string }) {
  const { activeIdx, phase } = useRotatingText(texts.length, interval);

  if (texts.length === 0) return null;
  if (texts.length === 1) {
    return (
      <p className={`text-center text-sm sm:text-base ${className}`} style={{ color: "var(--text-secondary)" }}>
        {texts[0]}
      </p>
    );
  }

  const isHeroTagline = activeIdx === 0;
  return (
    <div className={`hero-rotating-text ${className}`}>
      <div className={`hero-rotating-text-item ${phase === "active" ? "active" : "exiting"}`}>
        <p
          className={`text-center max-w-xl mx-auto px-2 ${isHeroTagline ? "text-base sm:text-lg font-semibold tracking-tight" : "text-xs sm:text-sm"}`}
          style={{ color: isHeroTagline ? "var(--text-primary)" : "var(--text-secondary)" }}
        >
          {texts[activeIdx]}
        </p>
      </div>
    </div>
  );
}

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
  const dataName = (input?.data as Record<string, unknown>)?.name as string | undefined;
  const effectiveName = name || dataName;

  // Explicit friendly labels for known tools
  const explicitMap: Record<string, string> = {
    // Instance & connection
    sn_get_instance_info: "Checking instance info",
    sn_test_connection: "Testing connection",
    sn_initialize_instance: "Initializing instance",
    sn_get_tables: "Listing available tables",
    sn_get_table_schema: table ? `Reading ${table} table schema` : "Reading table schema",
    sn_analyze_instance: "Analyzing instance",
    // Discovery — artifact reads
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
    sn_get_events: table ? `Events on ${table}` : "Reading events",
    sn_get_roles: "Checking roles",
    sn_get_requests: "Reading service requests",
    // Catalog
    sn_get_catalog_items: "Browsing service catalog",
    sn_get_catalog_item: "Reading catalog item details",
    sn_get_catalog_variables: "Catalog item variables",
    // Update sets
    sn_get_update_set: "Reading update set",
    sn_get_update_set_contents: "Update set contents",
    sn_set_current_update_set: "Setting active update set",
    sn_complete_update_set: "Completing update set",
    sn_move_to_update_set: table ? `Moving ${table} to update set` : "Moving artifact to update set",
    sn_verify_update_set_capture: "Verifying update set capture",
    // Analysis & quality
    sn_detect_ootb_overrides: "Checking for OOTB overrides",
    sn_get_dependency_graph: "Mapping dependencies",
    sn_find_anti_patterns: "Scanning for anti-patterns",
    sn_code_quality_score: "Evaluating code quality",
    sn_find_dead_code: "Scanning for unused code",
    sn_preview_change_impact: "Previewing change impact",
    sn_detect_conflicts: table ? `Checking conflicts on ${table}` : "Checking for conflicts",
    sn_validate_change: "Validating changes",
    sn_check_breaking_changes: "Checking for breaking changes",
    sn_diff_artifact: "Comparing artifact versions",
    // Audit & change tracking
    sn_log_change: "Logging change",
    sn_get_audit_history: table ? `Audit history for ${table}` : "Reading audit history",
    // Approvals
    sn_request_approval: "Requesting approval",
    sn_process_approval: "Processing approval",
    sn_get_approval_status: "Checking approval status",
    // Persona & framework
    sn_detect_persona: "Detecting user persona",
    sn_apply_4g_framework: "Applying 4G analysis",
    // Multi-instance
    sn_register_instance: "Registering instance",
    sn_register_instance_v2: "Registering instance",
    sn_switch_instance: "Switching instance",
    sn_get_active_instance: "Checking active instance",
    sn_test_instance_connection: "Testing instance connection",
    sn_compare_instances: "Comparing instances",
    sn_assess_upgrade_readiness: "Assessing upgrade readiness",
    sn_predict_conflicts: "Predicting conflicts",
    sn_compare_to_ootb: "Comparing to OOTB baseline",
    // Knowledge & recommendations
    sn_get_fix_recommendations: "Finding fix recommendations",
    sn_get_best_practices: "Looking up best practices",
    sn_get_code_templates: "Loading code templates",
    // Reporting
    sn_generate_report: "Generating report",
    sn_get_dashboard_data: "Loading dashboard data",
    // Scope & apps
    sn_get_scope_selection_options: "Loading scope options",
    sn_get_custom_apps: "Reading custom applications",
    // Promotion
    sn_create_promotion_package: "Creating promotion package",
    sn_preview_promotion: "Previewing promotion",
    sn_validate_promotion: "Validating promotion",
    sn_execute_promotion: "Executing promotion",
    sn_rollback_promotion: "Rolling back promotion",
    sn_list_promotion_history: "Promotion history",
    sn_list_promotion_packages: "Listing promotion packages",
    // Flow Designer
    sn_get_flow: "Reading flow details",
    sn_analyze_flow: "Analyzing flow",
    sn_scaffold_flow: "Scaffolding flow",
    sn_get_action_type_schema: "Reading action type schema",
    sn_get_flow_execution_status: "Checking flow execution status",
    sn_export_flow_as_template: "Exporting flow template",
  };
  if (explicitMap[toolName]) return explicitMap[toolName];

  // sn_query_records
  if (toolName === "sn_query_records") {
    const filter = (input?.encoded_query as string | undefined) || query;
    if (table && filter) {
      const short = filter.length > 40 ? filter.slice(0, 40) + "..." : filter;
      return `Querying ${table}: ${short}`;
    }
    return table ? `Querying ${table}` : "Querying records";
  }
  if (toolName === "sn_read_record" || toolName === "sn_get_record") return table ? `Reading ${table} record` : "Reading record";

  // sn_create_* tools
  if (toolName.startsWith("sn_create_")) {
    const entity = toolName.replace("sn_create_", "").replace(/_/g, " ");
    return effectiveName
      ? `Creating ${entity}: ${effectiveName}${table ? ` on ${table}` : ""}`
      : `Creating ${entity}${table ? ` on ${table}` : ""}`;
  }

  // sn_update_* tools
  if (toolName.startsWith("sn_update_")) {
    const entity = toolName.replace("sn_update_", "").replace(/_/g, " ");
    return effectiveName
      ? `Updating ${entity}: ${effectiveName}`
      : `Updating ${entity}`;
  }

  // sn_list_* tools
  if (toolName.startsWith("sn_list_")) {
    const entity = toolName.replace("sn_list_", "").replace(/_/g, " ");
    return `Listing ${entity}`;
  }

  // sn_execute_* / sn_run_*
  if (toolName.startsWith("sn_execute_") || toolName.startsWith("sn_run_")) {
    return `Running ${toolName.replace(/^sn_(execute|run)_/, "").replace(/_/g, " ")}`;
  }

  // Action-oriented fallback for remaining sn_ prefixed tools
  const verbMap: [RegExp, string][] = [
    [/^sn_get_/, "Reading"],
    [/^sn_detect_/, "Detecting"],
    [/^sn_check_/, "Checking"],
    [/^sn_find_/, "Finding"],
    [/^sn_validate_/, "Validating"],
    [/^sn_assess_/, "Assessing"],
    [/^sn_compare_/, "Comparing"],
    [/^sn_predict_/, "Predicting"],
    [/^sn_analyze_/, "Analyzing"],
    [/^sn_set_/, "Setting"],
    [/^sn_move_/, "Moving"],
    [/^sn_export_/, "Exporting"],
    [/^sn_import_/, "Importing"],
    [/^sn_register_/, "Registering"],
    [/^sn_switch_/, "Switching"],
    [/^sn_call_/, "Calling"],
    [/^sn_rollback_/, "Rolling back"],
    [/^sn_preview_/, "Previewing"],
    [/^sn_scaffold_/, "Scaffolding"],
    [/^sn_complete_/, "Completing"],
    [/^sn_generate_/, "Generating"],
    [/^sn_log_/, "Logging"],
    [/^sn_request_/, "Requesting"],
    [/^sn_process_/, "Processing"],
    [/^sn_apply_/, "Applying"],
    [/^sn_diff_/, "Comparing"],
    [/^sn_test_/, "Testing"],
    [/^sn_initialize_/, "Initializing"],
  ];
  for (const [pattern, verb] of verbMap) {
    if (pattern.test(toolName)) {
      const entity = toolName.replace(pattern, "").replace(/_/g, " ");
      return `${verb} ${entity}`;
    }
  }

  // Final fallback — humanize
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
  /** Dynamic categorized prompts generated from instance data (all 4 tabs) */
  categorizedPrompts?: CategorizedPrompts;
  /** Agent activity log entries for inline display */
  activityLog?: ActivityLogEntry[];
  /** Structured task plan from the planner */
  taskPlan?: TaskPlanDisplay | null;
  /** Mobile: callback when user taps "Get Started" on hero screen */
  onGetStarted?: () => void;
  /** Text to populate into the input field (from sidebar suggestion clicks) */
  pendingPrompt?: string | null;
  /** Clear the pending prompt after it has been consumed */
  onPendingPromptConsumed?: () => void;
  /** SDD mode state */
  sddMode?: boolean;
  /** Current SDLC phase */
  currentPhase?: SDLCPhase | null;
  /** Callback to change SDD mode */
  onSddModeChange?: (active: boolean, phase: SDLCPhase | null) => void;
  /** Active requirement ID */
  activeReqId?: string | null;
  /** Client session ID for command context */
  clientSessionId?: string;
  /** Number of messages waiting in the queue */
  queueLength?: number;
  /** Remove a queued message by ID */
  onDequeue?: (id: string) => void;
  /** Clear all queued messages */
  onClearQueue?: () => void;
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
    if (msg.startsWith("Task:")) continue;
    // Keep the initial "Analyzing your request..." as-is, collapse subsequent round messages
    if (msg === "Analyzing your request...") {
      const last = result[result.length - 1];
      if (last?.message === "Analyzing your request...") continue;
      result.push(entry);
      continue;
    }
    if (msg === "Starting..." || /^Round \d+/.test(msg)) {
      const last = result[result.length - 1];
      if (last?.phase === "thinking") continue;
      result.push({ ...entry, message: "Analyzing your request..." });
      continue;
    }
    // Collapse "Generating response..." messages
    if (msg === "Generating response...") {
      const last = result[result.length - 1];
      if (last?.message === "Composing response") continue;
      result.push({ ...entry, message: "Composing response" });
      continue;
    }
    // Rate limit retries — keep as-is (useful feedback)
    if (msg.includes("Rate limited") || msg.includes("retrying")) {
      result.push(entry);
      continue;
    }
    // Resuming messages — keep
    if (msg.includes("Resuming")) {
      result.push(entry);
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
  const [elapsed, setElapsed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startTime = useRef(Date.now());

  // Auto-scroll to latest entry
  useEffect(() => {
    if (scrollRef.current && expanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activityLog, expanded]);

  // Self-updating elapsed timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const processed = processActivityLog(activityLog);
  const toolCount = processed.filter(e => e.phase === "tool").length;
  const taskCount = processed.filter(e => e.phase === "task").length;

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

export default function ChatWindow({ messages, isLoading, onSend, onCancel, onApprove, onChoiceSelect, connected, inputRef, showToolDetails = true, liveStatus, userName, categorizedPrompts, activityLog = [], taskPlan, onGetStarted, pendingPrompt, onPendingPromptConsumed, sddMode = false, currentPhase = null, onSddModeChange, activeReqId, clientSessionId = "", queueLength = 0, onDequeue, onClearQueue }: Props) {
  const [input, setInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("foryou");
  const [expandedUpdates, setExpandedUpdates] = useState<Set<string>>(new Set());
  const [showAttachDropdown, setShowAttachDropdown] = useState(false);
  const [showAiAssist, setShowAiAssist] = useState(false);
  const [showTOC, setShowTOC] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
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

  /* ── Prompt enhance state ── */
  const [enhancing, setEnhancing] = useState<"grammar" | "enhance" | null>(null);
  const [preEnhanceText, setPreEnhanceText] = useState<string | null>(null);

  const handleEnhance = useCallback(async (mode: "grammar" | "enhance") => {
    if (!input.trim() || enhancing) return;
    setEnhancing(mode);
    setPreEnhanceText(input);
    try {
      const res = await fetch("/api/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input.trim(), mode }),
      });
      const data = await res.json();
      if (res.ok && data.text) {
        setInput(data.text);
      }
    } catch { /* silent */ }
    setEnhancing(null);
  }, [input, enhancing]);

  const handleUndoEnhance = useCallback(() => {
    if (preEnhanceText !== null) {
      setInput(preEnhanceText);
      setPreEnhanceText(null);
    }
  }, [preEnhanceText]);

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

  /** Consume pendingPrompt: populate input and focus textarea */
  useEffect(() => {
    if (pendingPrompt) {
      setInput(pendingPrompt);
      onPendingPromptConsumed?.();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [pendingPrompt, onPendingPromptConsumed, inputRef]);

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

  useEffect(() => {
    const handleSearchKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
      if (e.key === "Escape" && showSearch) {
        setShowSearch(false);
      }
    };
    window.addEventListener("keydown", handleSearchKey);
    return () => window.removeEventListener("keydown", handleSearchKey);
  }, [showSearch]);

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
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const threshold = 150;
      const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
      setIsNearBottom(nearBottom);
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isNearBottom]);

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
    if (!input.trim() && images.length === 0 && files.length === 0) return;
    if (isRecording) stopRecording();
    onSend(
      input.trim(),
      images.length > 0 ? images : undefined,
      files.length > 0 ? files : undefined
    );
    setInput("");
    setImages([]);
    setFiles([]);
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
  const isUpdatesTab = activeTab === "updates";
  const promptTabKey = isUpdatesTab ? null : activeTab;
  const dynamicList = promptTabKey ? categorizedPrompts?.[promptTabKey] as ExamplePrompt[] | undefined : undefined;
  const currentSuggestions: ExamplePrompt[] =
    dynamicList && dynamicList.length > 0 ? dynamicList : FALLBACK[activeTab];
  const isDynamic = !!(dynamicList && dynamicList.length > 0);
  const updatesList: UpdateSetSummary[] = categorizedPrompts?.updates ?? [];

  /* ── Tab icon helper ── */
  const tabIcon = (icon: string) => {
    switch (icon) {
      case "sparkles": return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" /></svg>;
      case "folder": return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>;
      case "code": return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>;
      case "list": return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12M3.75 6.75h.007v.008H3.75V6.75zm0 5.25h.007v.008H3.75V12zm0 5.25h.007v.008H3.75v-.008z" /></svg>;
      case "globe": return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M12 3a15.3 15.3 0 014 9 15.3 15.3 0 01-4 9 15.3 15.3 0 01-4-9 15.3 15.3 0 014-9z" /></svg>;
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
        <div className="mb-2 py-3 rounded-lg text-center text-xs" style={{ border: "2px dashed color-mix(in srgb, var(--color-primary) 40%, transparent)", color: "var(--color-primary)" }}>
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
          {/* SDD Mode chip + Command palette */}
          <div className="flex items-center gap-2 relative">
            <SDDModeChip
              active={sddMode}
              currentPhase={currentPhase ?? null}
              onSwitchToFreeform={() => onSddModeChange?.(false, null)}
              onShowStatus={() => onSend("/status")}
            />
            <CommandPalette
              inputText={input}
              ctx={{
                currentPhase: currentPhase ?? null,
                sddMode,
                connected,
                sessionId: clientSessionId,
                activeReqId: activeReqId ?? null,
              }}
              visible={isSlashPrefix(input)}
              onSelect={(cmd) => { setInput(""); onSend(cmd); }}
              onDismiss={() => inputRef.current?.focus()}
            />
          </div>
          {/* Textarea row */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={!connected ? "Connect your instance first →" : isLoading ? "Type to queue a follow-up message..." : "What should we work on next?"}
            disabled={!connected}
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
                disabled={!connected}
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

            {/* AI Assist popover — groups Grammar & Enhance to reduce input clutter */}
            {connected && input.trim() && !isLoading && (
              <div className="relative">
                <button
                  onClick={() => setShowAiAssist(!showAiAssist)}
                  className="h-7 px-2.5 rounded-md flex items-center gap-1 text-[11px] font-medium transition-colors"
                  style={{ color: "var(--color-primary)", background: "color-mix(in srgb, var(--color-primary) 10%, transparent)" }}
                  title="AI writing tools"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                  AI
                </button>
                {showAiAssist && (
                  <div className="attach-dropdown" style={{ bottom: "calc(100% + 6px)", left: 0, minWidth: "140px" }}>
                    <button
                      onClick={() => { handleEnhance("grammar"); setShowAiAssist(false); }}
                      disabled={!!enhancing}
                      className="attach-dropdown-item disabled:opacity-40"
                    >
                      {enhancing === "grammar" ? (
                        <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      )}
                      Grammar
                    </button>
                    <button
                      onClick={() => { handleEnhance("enhance"); setShowAiAssist(false); }}
                      disabled={!!enhancing}
                      className="attach-dropdown-item disabled:opacity-40"
                    >
                      {enhancing === "enhance" ? (
                        <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                      )}
                      Enhance
                    </button>
                    {preEnhanceText !== null && !enhancing && (
                      <button onClick={() => { handleUndoEnhance(); setShowAiAssist(false); }} className="attach-dropdown-item">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 010 10H9m-6-10l4-4m-4 4l4 4" /></svg>
                        Undo
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex-1" />

            {/* Mic button */}
            {speechSupported && (
              <button
                onClick={toggleRecording}
                disabled={!connected}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ color: "var(--text-disabled)" }}
                title="Voice input"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z" />
                </svg>
              </button>
            )}

            {/* Send / Queue + Stop */}
            <div className="flex items-center gap-1">
              {isLoading && (
                <button onClick={onCancel} className="w-8 h-8 rounded-full flex items-center justify-center transition-colors" style={{ background: "var(--color-danger)", color: "white" }} title="Stop generating">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                </button>
              )}
              <div className="relative">
                <button
                  onClick={handleSubmit}
                  disabled={!connected || (!input.trim() && images.length === 0 && files.length === 0)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    background: (connected && (input.trim() || images.length > 0 || files.length > 0)) ? "var(--text-primary)" : "var(--surface-elevated)",
                    color: (connected && (input.trim() || images.length > 0 || files.length > 0)) ? "var(--surface-app)" : "var(--text-disabled)",
                  }}
                  title={isLoading ? "Queue message" : "Send (Enter)"}
                >
                  {isLoading ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
                      <circle cx="12" cy="12" r="9" strokeWidth={2} fill="none" stroke="currentColor" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" /></svg>
                  )}
                </button>
                {queueLength > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[9px] font-bold px-1"
                    style={{ background: "var(--color-primary)", color: "#fff" }}
                  >
                    {queueLength}
                  </span>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ background: "var(--surface-app)" }}>
      {showEmptyState ? (
        /* ════ EMPTY STATE — two modes: disconnected (full hero) vs connected (ready-to-chat) ════ */
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-8 overflow-y-auto min-h-0">
          <div className="w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto flex flex-col items-center">

            {/* ── DISCONNECTED: Minimal hero ── */}
            {!connected && (
              <>
                {/* 1. Logo — focal point */}
                {APP_LOGO && (
                  <div className="hero-logo-container mb-4">
                    <AppLogo
                      idPrefix="chat-hero"
                      animated
                      className="hero-logo w-full h-full"
                      title={APP_NAME || "App Logo"}
                    />
                  </div>
                )}

                {/* 2. App Name */}
                {APP_NAME && (
                  <h1
                    className="text-2xl sm:text-3xl font-bold text-center mb-3 tracking-tight"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {APP_NAME}
                  </h1>
                )}

                {/* 3. Badge pill */}
                {WELCOME_BADGE && (
                  <div className="landing-badge mb-5">
                    <span className="landing-badge-dot" />
                    {WELCOME_BADGE}
                  </div>
                )}

                {/* 4. Auto-toggling animated text */}
                <HeroRotatingText
                  texts={[
                    APP_HERO_TAGLINE || APP_TAGLINE || "",
                    APP_SUBTITLE || "",
                  ].filter(Boolean)}
                  interval={12000}
                  className="mb-6"
                />

                {/* Input bar (disabled — hidden on mobile pre-connect) */}
                <div className="hidden sm:block w-full">{renderInputBar(true)}</div>

                {/* Mobile: Get Started CTA button */}
                {onGetStarted && (
                  <button
                    onClick={onGetStarted}
                    className="sm:hidden w-full mt-4 py-3.5 px-6 text-base font-semibold rounded-xl transition-all active:scale-[0.98]"
                    style={{ background: "var(--color-primary)", color: "white", boxShadow: "0 4px 16px color-mix(in srgb, var(--color-primary) 35%, transparent)" }}
                  >
                    Get Started
                  </button>
                )}

                {/* Desktop: Connect prompt */}
                <p className="hidden sm:block text-center mt-4 text-sm" style={{ color: "var(--text-disabled)" }}>
                  Open settings and connect your instance to get started.
                </p>
              </>
            )}

            {/* ── CONNECTED: Clean ready-to-chat state with glowing input ── */}
            {connected && (
              <>
                {/* 1. Logo — focal point */}
                {APP_LOGO && (
                  <div className="hero-logo-container mb-4">
                    <AppLogo
                      idPrefix="chat-hero-ready"
                      animated
                      className="hero-logo w-full h-full"
                      title={APP_NAME || "App Logo"}
                    />
                  </div>
                )}

                {/* 2. App name */}
                {APP_NAME && (
                  <h2
                    className="text-2xl sm:text-3xl font-bold text-center mb-3 tracking-tight"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {APP_NAME}
                  </h2>
                )}

                {/* 3. Badge pill */}
                {WELCOME_BADGE && (
                  <div className="landing-badge mb-5">
                    <span className="landing-badge-dot" />
                    {WELCOME_BADGE}
                  </div>
                )}

                {/* 4. Auto-toggling animated text */}
                <HeroRotatingText
                  texts={[
                    APP_HERO_TAGLINE || APP_TAGLINE || "What should we build?",
                    APP_SUBTITLE || "Describe what you need and let's get started.",
                  ].filter(Boolean)}
                  interval={12000}
                  className="mb-6"
                />

                {/* Glowing input bar */}
                <div className="hero-input-glow w-full">
                  {renderInputBar(true)}
                </div>

                {/* Suggestion tabs */}
                <div className="mt-6 w-full">
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {SUGGESTION_TABS.map((tab) => {
                      const isUpd = tab.key === "updates";
                      const tabHasDynamic = isUpd
                        ? !!(categorizedPrompts?.updates?.length)
                        : !!(categorizedPrompts?.[tab.key]?.length);
                      return (
                        <button
                          key={tab.key}
                          className={`suggestion-tab ${activeTab === tab.key ? "active" : ""}`}
                          onClick={() => setActiveTab(tab.key)}
                        >
                          {tabIcon(tab.icon)}
                          {tab.label}
                          {isUpd && categorizedPrompts?.updates?.length ? (
                            <span
                              className="text-[9px] font-semibold min-w-[16px] h-4 inline-flex items-center justify-center rounded-full px-1"
                              style={{ background: activeTab === "updates" ? "color-mix(in srgb, var(--color-primary) 15%, transparent)" : "var(--surface-secondary)", color: activeTab === "updates" ? "var(--color-primary)" : "var(--text-secondary)" }}
                            >
                              {categorizedPrompts.updates.length}
                            </span>
                          ) : tabHasDynamic && !isUpd ? (
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--color-primary)", opacity: 0.7 }} />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 space-y-0.5">
                    {isUpdatesTab ? (
                      updatesList.length > 0 ? (
                        updatesList.map((us) => {
                          const isExp = expandedUpdates.has(us.sysId);
                          const stateClr = us.state.toLowerCase() === "in progress" ? "var(--color-primary)"
                            : us.state.toLowerCase() === "complete" ? "var(--color-success)"
                            : "var(--text-disabled)";
                          return (
                            <div key={us.sysId} className="sp-update-row" style={{ animation: "spFadeIn 0.25s ease-out" }}>
                              <button
                                className="sp-update-header"
                                onClick={() => {
                                  setExpandedUpdates((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(us.sysId)) next.delete(us.sysId); else next.add(us.sysId);
                                    return next;
                                  });
                                }}
                              >
                                <span className="sp-update-state-dot" style={{ background: stateClr }} />
                                <span className="sp-update-name">{us.name}</span>
                                <svg className={`sp-update-chevron ${isExp ? "sp-update-chevron-open" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              {isExp && (
                                <div className="sp-update-detail">
                                  <div className="sp-update-meta">
                                    <span className="sp-update-badge" style={{ color: stateClr }}>{us.state}</span>
                                    {us.application && us.application !== "Global" && <span>{us.application}</span>}
                                  </div>
                                  <p className="sp-update-desc">{us.description || "No description"}</p>
                                  <button
                                    className="sp-update-action"
                                    onClick={(e) => { e.stopPropagation(); setInput(`Show the contents of update set "${us.name}" and summarize what it changes`); setTimeout(() => inputRef.current?.focus(), 50); }}
                                  >
                                    Explore this update set
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center text-xs py-4" style={{ color: "var(--text-disabled)" }}>No recent update sets found</div>
                      )
                    ) : (
                      currentSuggestions.map((prompt, i) => (
                        <button
                          key={`${activeTab}-${i}`}
                          className="suggestion-item"
                          onClick={() => { setInput(prompt.text); setTimeout(() => inputRef.current?.focus(), 50); }}
                        >
                          <span className="suggestion-item-icon">{prompt.icon}</span>
                          <span className="suggestion-item-content">
                            <span>{prompt.text}</span>
                            {isDynamic && prompt.desc && (
                              <span className="suggestion-item-desc">{prompt.desc}</span>
                            )}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* ════ CHAT MODE ════ */
        <div className="flex flex-col flex-1 relative overflow-hidden">
          {/* Messages */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-2 sm:px-6 py-4 sm:py-6">
            <div className="max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto space-y-4 sm:space-y-5">
              {messages.filter((msg) => !msg.hidden).map((msg, i, filtered) => {
                const prevMsg = i > 0 ? filtered[i - 1] : null;
                const showPhaseDivider = msg.phaseGate && msg.phaseGate !== prevMsg?.phaseGate;
                const phaseInfo = showPhaseDivider ? SDLC_PHASES.find(p => p.key === msg.phaseGate) : null;

                return (
                  <div key={msg.id || `msg-${i}`} id={msg.id || `msg-${i}`} data-message-id={msg.id || `msg-${i}`} data-phase={msg.phaseGate || undefined}>
                    {showPhaseDivider && phaseInfo && (
                      <div className="flex items-center gap-3 my-4 first:mt-0" data-phase-divider={msg.phaseGate}>
                        <div className="flex-1 h-px" style={{ background: "var(--border-default)" }} />
                        <span className="text-[10px] font-medium tracking-wider uppercase px-2" style={{ color: "var(--text-disabled)" }}>
                          {phaseInfo.label} Phase
                        </span>
                        <div className="flex-1 h-px" style={{ background: "var(--border-default)" }} />
                      </div>
                    )}
                    <MessageBubble
                      message={msg}
                      onApprove={onApprove}
                      onChoiceSelect={onChoiceSelect}
                      showToolDetails={showToolDetails}
                      userName={userName}
                      onDequeue={onDequeue}
                    />
                  </div>
                );
              })}
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

          {/* TOC toggle */}
          {messages.length > 3 && (
            <div className="absolute top-3 right-3 z-10">
              <button
                onClick={() => setShowTOC(!showTOC)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all shadow-sm"
                style={{
                  background: showTOC ? "var(--color-primary)" : "var(--surface-elevated)",
                  color: showTOC ? "#fff" : "var(--text-secondary)",
                  border: `1px solid ${showTOC ? "var(--color-primary)" : "var(--border-default)"}`,
                }}
                onMouseEnter={e => { if (!showTOC) { e.currentTarget.style.background = "var(--surface-secondary)"; e.currentTarget.style.color = "var(--text-primary)"; }}}
                onMouseLeave={e => { if (!showTOC) { e.currentTarget.style.background = "var(--surface-elevated)"; e.currentTarget.style.color = "var(--text-secondary)"; }}}
                title="Chat navigation"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <span className="hidden sm:inline">Navigate</span>
              </button>
            </div>
          )}
          <ChatTOC messages={messages} isOpen={showTOC} onClose={() => setShowTOC(false)} />

          {/* Scroll-to-bottom FAB */}
          {!isNearBottom && messages.length > 0 && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
              <button
                onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg text-xs font-medium transition-all hover:scale-105"
                style={{
                  background: "var(--surface-elevated)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-default)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                Scroll to bottom
              </button>
            </div>
          )}

          <ChatSearch messages={messages} isOpen={showSearch} onClose={() => setShowSearch(false)} />

          {/* Bottom input bar */}
          <div className="p-2 sm:p-4" style={{ borderTop: "1px solid var(--border-default)", background: "var(--surface-primary)" }}>
            <div className="max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto">
              {renderInputBar(false)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

