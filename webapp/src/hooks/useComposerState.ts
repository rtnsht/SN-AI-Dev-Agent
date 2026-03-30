"use client";

import { useEffect, useMemo, useState } from "react";

import type { AIProvider } from "@/lib/types";
import type { ContextChip } from "@/components/fde/ContextRibbon";
import type { ToolSelectionMode } from "@/lib/tool-categories";

const PROVIDER_STORAGE_KEY = "snai:provider";
const MODEL_STORAGE_KEY = "snai:model";
const LEGACY_PROVIDER_STORAGE_KEYS = ["snai:aiProvider"];
const LEGACY_MODEL_STORAGE_KEYS = ["snai:selectedModel"];
const TOOL_SELECTION_MODE_STORAGE_KEY = "snai:toolSelectionMode";
const TOOL_SELECTION_CATEGORIES_STORAGE_KEY = "snai:toolSelectionCategories";
const TOOL_SELECTION_TOOLS_STORAGE_KEY = "snai:selectedToolNames";
const MODEL_KEY_MIGRATION: Record<string, string> = {
  "sonnet-4": "claude-sonnet-4-6",
  "opus-4": "claude-opus-4-6",
  "haiku-4": "claude-haiku-4-5",
  "claude-sonnet-4.6": "claude-sonnet-4-6",
  "claude-opus-4.0": "claude-opus-4-6",
};

function readFromStorage(keys: string[]) {
  if (typeof window === "undefined") return null;

  for (const key of keys) {
    const value = window.sessionStorage.getItem(key);
    if (value) return value;
  }

  return null;
}

function getInitialProvider(): AIProvider {
  const storedProvider = readFromStorage([PROVIDER_STORAGE_KEY, ...LEGACY_PROVIDER_STORAGE_KEYS]);
  return (storedProvider as AIProvider) || "anthropic";
}

function getInitialModel(): string {
  const storedModel = readFromStorage([MODEL_STORAGE_KEY, ...LEGACY_MODEL_STORAGE_KEYS]);
  if (!storedModel) return "claude-sonnet-4-6";
  return MODEL_KEY_MIGRATION[storedModel] || storedModel;
}

function getInitialToolSelectionMode(): ToolSelectionMode {
  const storedMode = readFromStorage([TOOL_SELECTION_MODE_STORAGE_KEY]);
  return storedMode === "all" || storedMode === "custom" ? storedMode : "categories";
}

function getInitialToolCategories(): string[] {
  const stored = readFromStorage([TOOL_SELECTION_CATEGORIES_STORAGE_KEY]);
  if (!stored) return ["analysis"];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : ["analysis"];
  } catch {
    return ["analysis"];
  }
}

function getInitialSelectedToolNames(): string[] {
  const stored = readFromStorage([TOOL_SELECTION_TOOLS_STORAGE_KEY]);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function useComposerState() {
  const [aiProvider, setAiProvider] = useState<AIProvider>(getInitialProvider);
  const [selectedModel, setSelectedModel] = useState(getInitialModel);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [fdeMode, setFdeMode] = useState("explore");
  const [contextBlocks, setContextBlocks] = useState<ContextChip[]>([]);
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [toolSelectionMode, setToolSelectionMode] = useState<ToolSelectionMode>(getInitialToolSelectionMode);
  const [activeToolCategories, setActiveToolCategories] = useState<string[]>(getInitialToolCategories);
  const [selectedToolNames, setSelectedToolNames] = useState<string[]>(getInitialSelectedToolNames);
  const [showToolWorkbench, setShowToolWorkbench] = useState(false);
  const [showModePopup, setShowModePopup] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(PROVIDER_STORAGE_KEY, aiProvider);
  }, [aiProvider]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(TOOL_SELECTION_MODE_STORAGE_KEY, toolSelectionMode);
  }, [toolSelectionMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(TOOL_SELECTION_CATEGORIES_STORAGE_KEY, JSON.stringify(activeToolCategories));
  }, [activeToolCategories]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(TOOL_SELECTION_TOOLS_STORAGE_KEY, JSON.stringify(selectedToolNames));
  }, [selectedToolNames]);

  return useMemo(
    () => ({
      aiProvider,
      setAiProvider,
      selectedModel,
      setSelectedModel,
      providerError,
      setProviderError,
      fdeMode,
      setFdeMode,
      contextBlocks,
      setContextBlocks,
      toolMenuOpen,
      setToolMenuOpen,
      toolSelectionMode,
      setToolSelectionMode,
      activeToolCategories,
      setActiveToolCategories,
      selectedToolNames,
      setSelectedToolNames,
      showToolWorkbench,
      setShowToolWorkbench,
      showModePopup,
      setShowModePopup,
    }),
    [
      aiProvider,
      selectedModel,
      providerError,
      fdeMode,
      contextBlocks,
      toolMenuOpen,
      toolSelectionMode,
      activeToolCategories,
      selectedToolNames,
      showToolWorkbench,
      showModePopup,
    ]
  );
}
