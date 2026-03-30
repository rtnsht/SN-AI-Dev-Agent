import type {
  ChatMessage,
  PersistedChatMessageRecord,
  SDLCPhase,
} from "@/lib/types";

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asObjectArray<T extends object>(value: unknown): T[] {
  return Array.isArray(value) ? value.filter((item): item is T => typeof item === "object" && item !== null) : [];
}

function asPhase(value: unknown): SDLCPhase | undefined {
  return typeof value === "string" ? (value as SDLCPhase) : undefined;
}

export function deriveChatTitle(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "Untitled Chat";
  return normalized.length > 64 ? `${normalized.slice(0, 61)}...` : normalized;
}

export function serializeChatMessage(
  message: ChatMessage,
  options?: { modelUsed?: string | null; provider?: string | null }
) {
  return {
    role: message.role,
    content: message.content || null,
    model_used: options?.modelUsed || null,
    provider: options?.provider || null,
    token_count: null,
    context_items: [],
    artifacts: [],
    metadata: {
      id: message.id,
      timestamp: message.timestamp || null,
      type: message.type || null,
      images: message.images || [],
      files: message.files || [],
      toolExecutions: message.toolExecutions || [],
      phaseGate: message.phaseGate || null,
      approved: message.approved ?? null,
      autoApproved: message.autoApproved ?? null,
      choicesAnswered: message.choicesAnswered ?? null,
      hidden: message.hidden ?? false,
      queued: message.queued ?? false,
    },
  };
}

export function deserializeChatMessage(record: PersistedChatMessageRecord): ChatMessage {
  const metadata = record.metadata || {};

  return {
    id: typeof metadata.id === "string" ? metadata.id : record.id,
    role: record.role === "tool" ? "assistant" : record.role,
    content: record.content || "",
    timestamp: typeof metadata.timestamp === "string" ? metadata.timestamp : record.created_at,
    type:
      metadata.type === "info" ||
      metadata.type === "warning" ||
      metadata.type === "success" ||
      metadata.type === "error"
        ? metadata.type
        : undefined,
    images: asStringArray(metadata.images),
    files: asObjectArray(metadata.files),
    toolExecutions: asObjectArray(metadata.toolExecutions),
    phaseGate: asPhase(metadata.phaseGate),
    approved: typeof metadata.approved === "boolean" ? metadata.approved : undefined,
    autoApproved: typeof metadata.autoApproved === "boolean" ? metadata.autoApproved : undefined,
    choicesAnswered:
      typeof metadata.choicesAnswered === "boolean" ? metadata.choicesAnswered : undefined,
    hidden: typeof metadata.hidden === "boolean" ? metadata.hidden : undefined,
    queued: typeof metadata.queued === "boolean" ? metadata.queued : undefined,
  };
}

export function derivePhaseState(messages: ChatMessage[]) {
  const completed = new Set<SDLCPhase>();
  let currentPhase: SDLCPhase | null = null;

  for (const message of messages) {
    if (!message.phaseGate) continue;
    if (message.approved || message.autoApproved) {
      completed.add(message.phaseGate);
      continue;
    }
    currentPhase = message.phaseGate;
  }

  return {
    currentPhase,
    completedPhases: Array.from(completed),
  };
}
