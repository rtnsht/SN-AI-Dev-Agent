/**
 * Slash Command Registry
 *
 * Central registry for all slash commands. New commands are added by:
 * 1. Creating a file in commands/ that exports a SlashCommand
 * 2. Importing and registering it in the COMMANDS array below
 */

import type { SlashCommand, CommandContext, CommandResult } from "./types";
import buildCommand from "./commands/build";
import freeformCommand from "./commands/freeform";
import statusCommand from "./commands/status";
import helpCommand from "./commands/help";
import shareCommand from "./commands/share";

export type { SlashCommand, CommandContext, CommandResult, CommandCategory } from "./types";
export type { CommandStateUpdates } from "./types";

const COMMANDS: SlashCommand[] = [
  buildCommand,
  freeformCommand,
  statusCommand,
  shareCommand,
  helpCommand,
];

/** Get all registered commands */
export function getAllCommands(): SlashCommand[] {
  return COMMANDS;
}

/**
 * Get commands available in the current context (for the command palette).
 * Filters out commands whose isAvailable returns false.
 */
export function getAvailableCommands(ctx: CommandContext): SlashCommand[] {
  return COMMANDS.filter(cmd => {
    if (cmd.requiresConnection && !ctx.connected) return false;
    if (cmd.isAvailable && !cmd.isAvailable(ctx)) return false;
    return true;
  });
}

/**
 * Find a command by name or alias.
 * Returns null if the input is not a recognized command.
 */
function findCommand(input: string): SlashCommand | null {
  const normalized = input.toLowerCase().trim();
  for (const cmd of COMMANDS) {
    if (cmd.name === normalized) return cmd;
    if (cmd.aliases.some(a => a === normalized)) return cmd;
  }
  return null;
}

/**
 * Dispatch a slash command from user input.
 * Returns { type: "passthrough" } if the input is not a command.
 *
 * @param text - The full text the user typed (e.g. "/build" or "/status")
 * @param ctx  - Current session context
 */
export function dispatch(text: string, ctx: CommandContext): CommandResult {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return { type: "passthrough" };

  const spaceIdx = trimmed.indexOf(" ");
  const cmdName = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
  const args = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();

  const command = findCommand(cmdName);
  if (!command) return { type: "passthrough" };

  if (command.requiresConnection && !ctx.connected) {
    return {
      type: "system_message",
      content: `\`${command.name}\` requires an active ServiceNow connection.`,
      messageType: "warning",
    };
  }

  return command.execute(ctx, args, COMMANDS);
}

/**
 * Check if a string looks like it could be a slash command.
 * Used to decide whether to show the command palette.
 */
export function isSlashPrefix(text: string): boolean {
  return text.startsWith("/") && !text.includes(" ") && text.length <= 20;
}

/**
 * Filter commands that match a partial input (for autocomplete).
 */
export function filterCommands(partial: string, ctx: CommandContext): SlashCommand[] {
  const normalized = partial.toLowerCase();
  return getAvailableCommands(ctx).filter(cmd => {
    if (cmd.name.startsWith(normalized)) return true;
    return cmd.aliases.some(a => a.startsWith(normalized));
  });
}
