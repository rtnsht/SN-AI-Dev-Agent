"use client";

import { useEffect } from "react";
import Image from "next/image";
import { APP_NAME, APP_LOGO } from "@/lib/branding";

const FEATURES = [
  {
    icon: "💬",
    title: "Build ServiceNow Features with Chat",
    desc: "Describe what you need in plain English and the agent builds it on your instance — forms, automations, workflows, catalog items, and more.",
    example: `"Add a mandatory justification field when a change request is marked high impact"`,
  },
  {
    icon: "📋",
    title: "Structured Development Lifecycle",
    desc: "Every feature goes through Spec → Design → Implementation → Testing → Deployment. You review and approve each step before the agent moves on.",
    example: `"Build an approval workflow for high-priority incidents" → agent writes a spec first, waits for your OK`,
  },
  {
    icon: "✅",
    title: "You Stay in Control",
    desc: "Spec and Design phases require your explicit approval before proceeding. Nothing gets deployed without your review.",
    example: `Click the green "Approve" button after reviewing each phase document`,
  },
  {
    icon: "🔍",
    title: "Smart Reuse of Existing Config",
    desc: "Before building anything new, the agent checks what already exists on your instance and reuses or extends it — avoiding duplicates.",
    example: `Agent finds an existing priority rule and extends it instead of creating a new one`,
  },
  {
    icon: "📦",
    title: "Organized Change Tracking",
    desc: "All changes are grouped into a named update set on your instance. If one with the same name already exists, you're asked what to do.",
    example: `"Group these changes under Q1-Enhancements" → agent asks if you want to reuse the existing set or create a new one`,
  },
  {
    icon: "🤖",
    title: "Choose Your AI Model",
    desc: "Pick between a faster model for quick questions or a more powerful one for complex features. Your choice locks for the session and resets on New Chat.",
    example: `Use the faster model for lookups, the powerful one for multi-step features`,
  },
  {
    icon: "🖼️",
    title: "Attach Screenshots & Images",
    desc: "Paste, drag-drop, or click to attach images. The agent can read UI mockups, error screenshots, and diagrams to understand what you need.",
    example: `Paste a screenshot of a form and say "Add a mandatory field like this"`,
  },
  {
    icon: "📊",
    title: "Usage Tracking",
    desc: "See how many requests you've used and when your quota resets. The settings panel shows a live usage counter.",
    example: `"3 of 10 requests used — resets at 4:30 PM"`,
  },
  {
    icon: "💾",
    title: "Download Conversation",
    desc: "Export your entire chat history as a Markdown file for documentation or sharing.",
    example: `Click the "Download" button in the header bar`,
  },
  {
    icon: "🛑",
    title: "Stop Anytime",
    desc: "Cancel a running request with the red stop button. Your conversation is preserved and you can continue from where you left off.",
    example: `Click the red stop button if a request is taking too long`,
  },
  {
    icon: "🔐",
    title: "Secure Connection",
    desc: "Your ServiceNow credentials are validated on connect and the agent checks that your account has the required permissions before proceeding.",
    example: `"Connected as John Smith @ dev12345" — warns you if permissions are missing`,
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function InfoModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[90vh] sm:max-h-[80vh] mx-0 sm:mx-4 rounded-t-lg sm:rounded-lg shadow-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--surface-primary)", border: "1px solid var(--border-emphasis)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4" style={{ borderBottom: "1px solid var(--border-default)" }}>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Image src={APP_LOGO} alt={APP_NAME} width={36} height={36} className="rounded-md flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9" unoptimized />
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold truncate" style={{ color: "var(--text-primary)" }}>{APP_NAME}</h2>
              <p className="text-[10px] sm:text-xs mt-0.5" style={{ color: "var(--text-disabled)" }}>What you can do with this app</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md transition-colors flex-shrink-0"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-elevated)"; e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Feature list */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4 space-y-2 sm:space-y-3">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="group flex gap-2 sm:gap-3 p-2 sm:p-3 rounded-md transition-colors"
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-secondary)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span className="text-lg sm:text-xl flex-shrink-0 mt-0.5">{f.icon}</span>
              <div className="min-w-0">
                <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{f.title}</h3>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
                <p className="text-[10px] sm:text-[11px] mt-1 italic truncate" style={{ color: "rgba(76,125,255,0.6)" }} title={f.example}>💡 {f.example}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-2.5 sm:py-3 text-center" style={{ borderTop: "1px solid var(--border-default)" }}>
          <p className="text-[10px]" style={{ color: "var(--text-disabled)" }}>
            <span className="hidden sm:inline">Press <kbd className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: "var(--surface-secondary)", color: "var(--text-secondary)" }}>Esc</kbd> or click outside to close</span>
            <span className="sm:hidden">Tap outside to close</span>
          </p>
        </div>
      </div>
    </div>
  );
}

