"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, Eye, EyeOff, Plus, Save, X, Settings, Image, Palette, Layout, Sparkles } from "lucide-react";
import { HeroEditor } from "./components/HeroEditor";
import { FeatureEditor } from "./components/FeatureEditor";
import { StatsEditor } from "./components/StatsEditor";
import { CtaEditor } from "./components/CtaEditor";
import { NavEditor } from "./components/NavEditor";
import { FooterEditor } from "./components/FooterEditor";
import { ThemeEditor } from "./components/ThemeEditor";
import { MediaEditor } from "./components/MediaEditor";
import { SectionEditor } from "./components/SectionEditor";
import { Toast, ToastProps } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Tab = "hero" | "features" | "stats" | "ctas" | "nav" | "footer" | "theme" | "media" | "sections";

interface LandingContent {
  sections: any[];
  hero: any | null;
  features: any[];
  stats: any[];
  ctas: any[];
  nav_links: any[];
  footer_links: any[];
  theme_config: {
    dark: any | null;
    light: any | null;
  };
  media: any[];
}

export default function LandingCmsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("hero");
  const [content, setContent] = useState<LandingContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastProps[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const addToast = (message: string, type: ToastProps["type"] = "info") => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type, onClose: (id) => setToasts(prev => prev.filter(t => t.id !== id)) }]);
  };

  const fetchContent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/landing-content");
      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setContent(data);
      setHasUnsavedChanges(false);
    } catch (error) {
      addToast("Failed to load content", "error");
      console.error(error);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const handleSave = async () => {
    if (!content) return;
    
    setSaving(true);
    try {
      // Save all content to the database
      const res = await fetch("/api/admin/landing-cms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      });

      if (res.ok) {
        addToast("All changes saved successfully", "success");
        setHasUnsavedChanges(false);
        await fetchContent();
      } else {
        const data = await res.json();
        addToast(data.error || "Failed to save changes", "error");
      }
    } catch (error) {
      addToast("Failed to save changes", "error");
      console.error(error);
    }
    setSaving(false);
  };

  const handleContentChange = (newContent: Partial<LandingContent>) => {
    if (!content) return;
    setContent({ ...content, ...newContent });
    setHasUnsavedChanges(true);
  };

  const handleNavigateAway = () => {
    if (hasUnsavedChanges) {
      setConfirmDialog({
        isOpen: true,
        title: "Unsaved Changes",
        message: "You have unsaved changes. Are you sure you want to leave?",
        onConfirm: () => router.back(),
      });
    } else {
      router.back();
    }
  };

  const tabs = [
    { id: "sections" as Tab, label: "Sections", icon: Layout },
    { id: "hero" as Tab, label: "Hero", icon: Sparkles },
    { id: "features" as Tab, label: "Features", icon: Settings },
    { id: "stats" as Tab, label: "Statistics", icon: Eye },
    { id: "ctas" as Tab, label: "CTAs", icon: ChevronUp },
    { id: "nav" as Tab, label: "Navigation", icon: ChevronDown },
    { id: "footer" as Tab, label: "Footer", icon: ChevronDown },
    { id: "theme" as Tab, label: "Theme", icon: Palette },
    { id: "media" as Tab, label: "Media", icon: Image },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={handleNavigateAway}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <ChevronDown className="w-5 h-5 rotate-90" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-white">Landing Page CMS</h1>
                <p className="text-xs text-zinc-500">Manage all landing page content</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {hasUnsavedChanges && (
                <span className="text-xs text-amber-400">Unsaved changes</span>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !hasUnsavedChanges}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="mb-8 overflow-x-auto">
          <div className="flex gap-2 min-w-max border-b border-zinc-800 pb-4">
            {tabs.map((tabItem) => {
              const Icon = tabItem.icon;
              return (
                <button
                  key={tabItem.id}
                  onClick={() => setTab(tabItem.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tab === tabItem.id
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tabItem.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        {content && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            {tab === "sections" && (
              <SectionEditor
                sections={content.sections}
                onChange={(sections) => handleContentChange({ sections })}
              />
            )}
            {tab === "hero" && (
              <HeroEditor
                hero={content.hero}
                onChange={(hero) => handleContentChange({ hero })}
              />
            )}
            {tab === "features" && (
              <FeatureEditor
                features={content.features}
                sections={content.sections}
                onChange={(features) => handleContentChange({ features })}
              />
            )}
            {tab === "stats" && (
              <StatsEditor
                stats={content.stats}
                sections={content.sections}
                onChange={(stats) => handleContentChange({ stats })}
              />
            )}
            {tab === "ctas" && (
              <CtaEditor
                ctas={content.ctas}
                sections={content.sections}
                onChange={(ctas) => handleContentChange({ ctas })}
              />
            )}
            {tab === "nav" && (
              <NavEditor
                navLinks={content.nav_links}
                onChange={(nav_links) => handleContentChange({ nav_links })}
              />
            )}
            {tab === "footer" && (
              <FooterEditor
                footerLinks={content.footer_links}
                onChange={(footer_links) => handleContentChange({ footer_links })}
              />
            )}
            {tab === "theme" && (
              <ThemeEditor
                themeConfig={content.theme_config}
                onChange={(theme_config) => handleContentChange({ theme_config })}
              />
            )}
            {tab === "media" && (
              <MediaEditor
                media={content.media}
                onChange={(media) => handleContentChange({ media })}
              />
            )}
          </div>
        )}
      </div>

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} />
        ))}
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="Leave"
        cancelLabel="Stay"
        variant="warning"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ isOpen: false, title: "", message: "", onConfirm: () => {} })}
      />
    </div>
  );
}
