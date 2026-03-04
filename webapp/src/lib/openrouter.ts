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
  
  // Filter to models that support tool calling for ServiceNow agent use
  const models = (data.data as OpenRouterModel[])
    .filter((m) => {
      // Include models that support tools or are known good models
      const supportsTools = m.supported_parameters?.includes("tools");
      const isTextModel = m.architecture?.modality?.includes("text");
      return supportsTools || isTextModel;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

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
    throw new Error(errorData.error?.message || `OpenRouter API error: ${response.status}`);
  }

  return response.json();
}

