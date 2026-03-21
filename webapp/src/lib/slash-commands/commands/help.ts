import type { SlashCommand, CommandContext } from "../types";

const helpCommand: SlashCommand = {
  name: "/help",
  aliases: ["/commands", "/?"],
  description: "Show all available commands",
  category: "meta",
  requiresConnection: false,
  execute: (ctx: CommandContext, _args?: string, allCommands?: SlashCommand[]) => {
    const commands = allCommands || [];
    const grouped: Record<string, SlashCommand[]> = {};

    for (const cmd of commands) {
      if (cmd.name === "/help") continue;
      const cat = cmd.category.toUpperCase();
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(cmd);
    }

    const lines: string[] = ["**Available Commands**\n"];

    for (const [category, cmds] of Object.entries(grouped)) {
      lines.push(`**${category}**`);
      for (const cmd of cmds) {
        const available = !cmd.isAvailable || cmd.isAvailable(ctx);
        const prefix = available ? "" : "~~";
        const suffix = available ? "" : "~~";
        const aliases = cmd.aliases.length > 0 ? ` *(${cmd.aliases.join(", ")})*` : "";
        lines.push(`${prefix}\`${cmd.name}\`${aliases} — ${cmd.description}${suffix}`);
      }
      lines.push("");
    }

    lines.push("*Tip: Type `/` to see the command palette inline.*");

    return {
      type: "system_message" as const,
      content: lines.join("\n"),
      messageType: "info" as const,
    };
  },
};

export default helpCommand;
