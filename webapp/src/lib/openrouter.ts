/**
 * OpenRouter API Client
 * Handles communication with OpenRouter API for multi-model access
 */

import { OpenRouterModel } from "./types";

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";

export interface OpenRouterConfig {
  apiKey: string;
  siteUrl?: string;
  siteName?: string;
}

export interface OpenRouterContentBlock {
  type: string;
  text?: string;
  image_url?: { url: string };
  cache_control?: { type: "ephemeral"; ttl?: string };
}

export interface OpenRouterMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string | OpenRouterContentBlock[];
  tool_call_id?: string;
  name?: string;
}

export interface OpenRouterTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: object;
  };
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  tools?: OpenRouterTool[];
  tool_choice?: "none" | "auto" | { type: "function"; function: { name: string } };
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface OpenRouterToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenRouterChoice {
  finish_reason: string | null;
  message?: {
    role: string;
    content: string | null;
    tool_calls?: OpenRouterToolCall[];
  };
  delta?: {
    role?: string;
    content?: string | null;
    tool_calls?: OpenRouterToolCall[];
  };
}

export interface OpenRouterResponse {
  id: string;
  choices: OpenRouterChoice[];
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Fetch available models from OpenRouter
 */
export async function fetchOpenRouterModels(apiKey?: string): Promise<OpenRouterModel[]> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${OPENROUTER_API_BASE}/models`, { headers });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenRouter models: ${response.status}`);
  }

  const data = await response.json();
  
  // Strict filtering for ServiceNow AI Dev Agent use:
  // Must support tool calling + reasoning, with sufficient context for complex agent workflows
  const models = (data.data as OpenRouterModel[])
    .filter((m) => {
      const params = m.supported_parameters || [];

      // MUST: tool calling support (non-negotiable for agent use)
      if (!params.includes("tools")) return false;

      // MUST: reasoning/thinking support
      if (!params.includes("reasoning") && !params.includes("include_reasoning")) return false;

      // MUST: sufficient context for complex agent work (64K minimum)
      if (m.context_length < 64000) return false;

      // MUST: accept text input
      const inputMods = m.architecture?.input_modalities || [];
      if (!inputMods.includes("text")) return false;

      // EXCLUDE: routers, free routers, image-generation-only models
      if (m.id.startsWith("openrouter/")) return false;

      // EXCLUDE: models with negative pricing (routers)
      if (parseFloat(m.pricing.prompt) < 0) return false;

      // EXCLUDE: models whose primary output is images (not text-focused)
      const outputMods = m.architecture?.output_modalities || [];
      if (outputMods.length > 0 && !outputMods.includes("text")) return false;

      return true;
    })
    .sort((a, b) => {
      // Sort: multimodal input first, then by context length desc, then name
      const aMulti = (a.architecture?.input_modalities?.length || 0) > 1 ? 1 : 0;
      const bMulti = (b.architecture?.input_modalities?.length || 0) > 1 ? 1 : 0;
      if (bMulti !== aMulti) return bMulti - aMulti;
      if (b.context_length !== a.context_length) return b.context_length - a.context_length;
      return a.name.localeCompare(b.name);
    });

  return models;
}

/**
 * Make a chat completion request to OpenRouter
 */
export async function chatCompletion(
  config: OpenRouterConfig,
  request: OpenRouterRequest
): Promise<OpenRouterResponse> {
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };

  if (config.siteUrl) {
    headers["HTTP-Referer"] = config.siteUrl;
  }
  if (config.siteName) {
    headers["X-OpenRouter-Title"] = config.siteName;
  }

  const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errMsg = errorData.error?.message || "Unknown error";
    const errType = errorData.error?.type || errorData.error?.code || "";
    const errMeta = errorData.error?.metadata ? JSON.stringify(errorData.error.metadata) : "";
    const detail = [
      `OpenRouter ${response.status}`,
      `model=${request.model}`,
      errType ? `type=${errType}` : "",
      errMsg,
      errMeta ? `meta=${errMeta}` : "",
    ].filter(Boolean).join(" | ");
    // Log the full error for debugging (server-side only)
    console.error("[OpenRouter API Error]", { status: response.status, model: request.model, error: errorData.error });
    throw new Error(detail);
  }

  const data = await response.json();

  // Some models/providers return 200 but with an error object or missing choices
  if (data.error) {
    const errMsg = data.error?.message || "Unknown error";
    const errType = data.error?.type || data.error?.code || "";
    const detail = [`OpenRouter 200 (error in body)`, `model=${request.model}`, errType ? `type=${errType}` : "", errMsg].filter(Boolean).join(" | ");
    console.error("[OpenRouter API Error in 200]", { model: request.model, error: data.error });
    throw new Error(detail);
  }

  if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
    console.error("[OpenRouter API] No choices in response", { model: request.model, keys: Object.keys(data) });
    throw new Error(`OpenRouter returned no choices | model=${request.model} | response keys: ${Object.keys(data).join(",")}`);
  }

  return data as OpenRouterResponse;
}

