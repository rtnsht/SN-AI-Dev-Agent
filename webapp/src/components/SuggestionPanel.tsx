"use client";

import { useState, useEffect, useRef } from "react";
import type { CategorizedPrompts, ExamplePrompt, UpdateSetSummary } from "@/lib/types";
import { SUGGESTION_FALLBACK } from "@/lib/suggestion-engine";

const PROMPT_TABS = [
  { key: "foryou" as const, label: "For you", icon: "sparkles" },
  { key: "build" as const, label: "Build", icon: "folder" },
  { key: "explore" as const, label: "Explore", icon: "code" },
  { key: "quick" as const, label: "Quick", icon: "list" },
] as const;

type PromptTabKey = (typeof PROMPT_TABS)[number]["key"];
type ActiveTab = PromptTabKey | "updates";

interface Props {
  prompts: CategorizedPrompts | null;
  onSuggestionClick: (text: string) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  lastRefreshed?: number | null;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "just now";
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function formatDate(isoish: string): string {
  if (!isoish) return "";
  try {
    const d = new Date(isoish.replace(" ", "T"));
    if (isNaN(d.getTime())) return isoish;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = Math.floor(diffMs / 3_600_000);
    if (diffH < 1) return "< 1 hour ago";
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return isoish;
  }
}

function TabIcon({ icon }: { icon: string }) {
  const cls = "w-3 h-3";
  switch (icon) {
    case "sparkles":
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" /></svg>;
    case "folder":
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>;
    case "code":
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>;
    case "list":
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12M3.75 6.75h.007v.008H3.75V6.75zm0 5.25h.007v.008H3.75V12zm0 5.25h.007v.008H3.75v-.008z" /></svg>;
    case "globe":
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M12 3a15.3 15.3 0 014 9 15.3 15.3 0 01-4 9 15.3 15.3 0 01-4-9 15.3 15.3 0 014-9z" /></svg>;
    default:
      return null;
  }
}

function stateColor(state: string): string {
  switch (state.toLowerCase()) {
    case "in progress": return "var(--color-primary)";
    case "complete": return "var(--color-success)";
    case "build": return "var(--color-warning, #e6a817)";
    default: return "var(--text-disabled)";
  }
}

function UpdateSetRow({ us, onSuggestionClick }: { us: UpdateSetSummary; onSuggestionClick: (text: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="sp-update-row" style={{ animation: "spFadeIn 0.25s ease-out" }}>
      <button
        className="sp-update-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="sp-update-state-dot" style={{ background: stateColor(us.state) }} />
        <span className="sp-update-name">{us.name}</span>
        <svg
          className={`sp-update-chevron ${expanded ? "sp-update-chevron-open" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="sp-update-detail">
          <div className="sp-update-meta">
            <span className="sp-update-badge" style={{ color: stateColor(us.state) }}>{us.state}</span>
            {us.updatedOn && <span>{formatDate(us.updatedOn)}</span>}
            {us.application && us.application !== "Global" && <span>{us.application}</span>}
          </div>
          <p className="sp-update-desc">{us.description || "No description"}</p>
          <button
            className="sp-update-action"
            onClick={(e) => {
              e.stopPropagation();
              onSuggestionClick(`Show the contents of update set "${us.name}" and summarize what it changes`);
            }}
          >
            Explore this update set
          </button>
        </div>
      )}
    </div>
  );
}

export default function SuggestionPanel({ prompts, onSuggestionClick, onRefresh, isRefreshing, lastRefreshed }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("foryou");
  const [displayedTime, setDisplayedTime] = useState("");
  const [fadeKey, setFadeKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPromptsRef = useRef(prompts);

  useEffect(() => {
    if (!lastRefreshed) return;
    const update = () => setDisplayedTime(timeAgo(lastRefreshed));
    update();
    timerRef.current = setInterval(update, 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [lastRefreshed]);

  useEffect(() => {
    if (prompts !== prevPromptsRef.current) {
      setFadeKey((k) => k + 1);
      prevPromptsRef.current = prompts;
    }
  }, [prompts]);

  const isUpdatesTab = activeTab === "updates";
  const dynamicList: ExamplePrompt[] = !isUpdatesTab ? (prompts?.[activeTab] ?? []) : [];
  const fallbackList: ExamplePrompt[] = !isUpdatesTab ? (SUGGESTION_FALLBACK[activeTab] ?? []) : [];
  const currentList = dynamicList.length > 0 ? dynamicList : fallbackList;
  const updatesList: UpdateSetSummary[] = prompts?.updates ?? [];
  const hasData = isUpdatesTab ? updatesList.length > 0 : currentList.length > 0;

  return (
    <div className="sp-root">
      {/* Header */}
      <div className="sp-header">
        <span className="sp-title">Suggestions</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="sp-refresh-btn"
            title="Refresh suggestions (fetch new data)"
          >
            <svg
              className={`w-3.5 h-3.5 ${isRefreshing ? "sp-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="sp-tabs">
        {PROMPT_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`sp-tab ${activeTab === tab.key ? "sp-tab-active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <TabIcon icon={tab.icon} />
            <span>{tab.label}</span>
          </button>
        ))}
        <button
          className={`sp-tab ${activeTab === "updates" ? "sp-tab-active" : ""}`}
          onClick={() => setActiveTab("updates")}
        >
          <TabIcon icon="globe" />
          <span>Latest Updates</span>
          {updatesList.length > 0 && (
            <span className="sp-tab-count">{updatesList.length}</span>
          )}
        </button>
      </div>

      {/* Content */}
      <div key={fadeKey} className="sp-items sp-items-fade-enter">
        {isUpdatesTab ? (
          hasData ? (
            updatesList.map((us, i) => (
              <UpdateSetRow key={us.sysId || i} us={us} onSuggestionClick={onSuggestionClick} />
            ))
          ) : (
            <div className="sp-empty">No recent update sets found</div>
          )
        ) : (
          hasData ? (
            currentList.map((p, i) => (
              <button
                key={`${activeTab}-${i}`}
                className="sp-item"
                onClick={() => onSuggestionClick(p.text)}
                title={p.text}
              >
                <span className="sp-item-icon">{p.icon}</span>
                <div className="sp-item-body">
                  <span className="sp-item-text">{p.text}</span>
                  <span className="sp-item-desc">{p.desc}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="sp-empty">No suggestions available</div>
          )
        )}
      </div>

      {/* Footer timestamp */}
      {lastRefreshed && displayedTime && (
        <div className="sp-footer">Updated {displayedTime}</div>
      )}
    </div>
  );
}
