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
const DEFAULT_PROVIDER: AIProvider = "anthropic";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_TOOL_SELECTION_MODE: ToolSelectionMode = "categories";
const DEFAULT_TOOL_CATEGORIES = ["analysis"];

function readFromStorage(keys: string[]) {
  if (typeof window === "undefined") return null;

  try {
    for (const key of keys) {
      const value = window.sessionStorage.getItem(key);
      if (value) return value;
    }
  } catch {
    return null;
  }

  return null;
}

function getStoredProvider(): AIProvider {
  const storedProvider = readFromStorage([PROVIDER_STORAGE_KEY, ...LEGACY_PROVIDER_STORAGE_KEYS]);
  return (storedProvider as AIProvider) || DEFAULT_PROVIDER;
}

function getStoredModel(): string {
  const storedModel = readFromStorage([MODEL_STORAGE_KEY, ...LEGACY_MODEL_STORAGE_KEYS]);
  if (!storedModel) return DEFAULT_MODEL;
  return MODEL_KEY_MIGRATION[storedModel] || storedModel;
}

function getStoredToolSelectionMode(): ToolSelectionMode {
  const storedMode = readFromStorage([TOOL_SELECTION_MODE_STORAGE_KEY]);
  return storedMode === "all" || storedMode === "custom" ? storedMode : DEFAULT_TOOL_SELECTION_MODE;
}

function getStoredToolCategories(): string[] {
  const stored = readFromStorage([TOOL_SELECTION_CATEGORIES_STORAGE_KEY]);
  if (!stored) return [...DEFAULT_TOOL_CATEGORIES];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [...DEFAULT_TOOL_CATEGORIES];
  } catch {
    return [...DEFAULT_TOOL_CATEGORIES];
  }
}

function getStoredSelectedToolNames(): string[] {
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
  const [aiProvider, setAiProvider] = useState<AIProvider>(DEFAULT_PROVIDER);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [fdeMode, setFdeMode] = useState("explore");
  const [contextBlocks, setContextBlocks] = useState<ContextChip[]>([]);
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [toolSelectionMode, setToolSelectionMode] = useState<ToolSelectionMode>(DEFAULT_TOOL_SELECTION_MODE);
  const [activeToolCategories, setActiveToolCategories] = useState<string[]>([...DEFAULT_TOOL_CATEGORIES]);
  const [selectedToolNames, setSelectedToolNames] = useState<string[]>([]);
  const [showToolWorkbench, setShowToolWorkbench] = useState(false);
  const [showModePopup, setShowModePopup] = useState(false);
  const [storageLoaded, setStorageLoaded] = useState(false);

  // Load client-only composer preferences after mount to avoid hydration mismatches.
  useEffect(() => {
    setAiProvider(getStoredProvider());
    setSelectedModel(getStoredModel());
    setToolSelectionMode(getStoredToolSelectionMode());
    setActiveToolCategories(getStoredToolCategories());
    setSelectedToolNames(getStoredSelectedToolNames());
    setStorageLoaded(true);
  }, []);

  useEffect(() => {
    if (!storageLoaded || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(PROVIDER_STORAGE_KEY, aiProvider);
    } catch {
      // Ignore storage write failures and keep the in-memory state.
    }
  }, [aiProvider, storageLoaded]);

  useEffect(() => {
    if (!storageLoaded || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
    } catch {
      // Ignore storage write failures and keep the in-memory state.
    }
  }, [selectedModel, storageLoaded]);

  useEffect(() => {
    if (!storageLoaded || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(TOOL_SELECTION_MODE_STORAGE_KEY, toolSelectionMode);
    } catch {
      // Ignore storage write failures and keep the in-memory state.
    }
  }, [toolSelectionMode, storageLoaded]);

  useEffect(() => {
    if (!storageLoaded || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        TOOL_SELECTION_CATEGORIES_STORAGE_KEY,
        JSON.stringify(activeToolCategories)
      );
    } catch {
      // Ignore storage write failures and keep the in-memory state.
    }
  }, [activeToolCategories, storageLoaded]);

  useEffect(() => {
    if (!storageLoaded || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        TOOL_SELECTION_TOOLS_STORAGE_KEY,
        JSON.stringify(selectedToolNames)
      );
    } catch {
      // Ignore storage write failures and keep the in-memory state.
    }
  }, [selectedToolNames, storageLoaded]);

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
