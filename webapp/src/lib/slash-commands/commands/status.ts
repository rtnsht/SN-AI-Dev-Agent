import type { SlashCommand } from "../types";
import { SDLC_PHASES } from "../../types";

const statusCommand: SlashCommand = {
  name: "/status",
  aliases: ["/info"],
  description: "Show current phase, scope, and session info",
  category: "context",
  requiresConnection: false,
  execute: (ctx) => {
    const lines: string[] = [];

    if (ctx.sddMode) {
      const phaseInfo = ctx.currentPhase
        ? SDLC_PHASES.find(p => p.key === ctx.currentPhase)
        : null;
      lines.push(`**SDD Mode:** Active`);
      lines.push(`**Current Phase:** ${phaseInfo?.label || ctx.currentPhase || "Not started"}`);
      if (ctx.activeReqId) {
        lines.push(`**Requirement:** ${ctx.activeReqId}`);
      }
      const pipeline = SDLC_PHASES.map(p => {
        if (ctx.currentPhase === p.key) return `**[${p.label}]**`;
        return p.label;
      }).join(" → ");
      lines.push(`**Pipeline:** ${pipeline}`);
    } else {
      lines.push(`**SDD Mode:** Off (freeform)`);
      lines.push(`All tools available. Type \`/build\` to start a requirement with phase gates.`);
    }

    lines.push(`**Connected:** ${ctx.connected ? "Yes" : "No"}`);
    lines.push(`**Session:** \`${ctx.sessionId.slice(0, 20)}...\``);

    return {
      type: "system_message" as const,
      content: lines.join("\n"),
      messageType: "info" as const,
    };
  },
};

export default statusCommand;
