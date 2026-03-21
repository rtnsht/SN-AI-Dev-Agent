/**
 * Slash Command type definitions.
 * Extensible registry pattern — new commands are added by creating a file
 * in commands/ and registering it in index.ts.
 */

import type { SDLCPhase } from "../types";

export type CommandCategory = "mode" | "context" | "chat" | "settings" | "meta";

export interface CommandContext {
  /** Current SDLC phase (null if not in SDD mode) */
  currentPhase: SDLCPhase | null;
  /** Whether SDD mode is currently active */
  sddMode: boolean;
  /** Whether connected to a ServiceNow instance */
  connected: boolean;
  /** Current session ID */
  sessionId: string;
  /** Active requirement ID (e.g. "REQ-001") */
  activeReqId: string | null;
}

export type CommandResult =
  | { type: "state_update"; updates: Partial<CommandStateUpdates> }
  | { type: "system_message"; content: string; messageType: "info" | "success" | "warning" }
  | { type: "action"; action: "new_chat" | "toggle_settings" }
  | { type: "passthrough" };

export interface CommandStateUpdates {
  sddMode: boolean;
  currentPhase: SDLCPhase | null;
  completedPhases: SDLCPhase[];
}

export interface SlashCommand {
  /** Primary command name including the slash, e.g. "/build" */
  name: string;
  /** Alternative names that also trigger this command */
  aliases: string[];
  /** One-line description shown in the command palette */
  description: string;
  /** Grouping category for the palette */
  category: CommandCategory;
  /** Whether this command requires an active ServiceNow connection */
  requiresConnection: boolean;
  /** Contextual visibility — return false to hide from the palette */
  isAvailable?: (ctx: CommandContext) => boolean;
  /** Execute the command and return a result. allCommands is passed to /help to avoid circular import. */
  execute: (ctx: CommandContext, args?: string, allCommands?: SlashCommand[]) => CommandResult;
}
