import type { SlashCommand } from "../types";

const MIN_ASSISTANT_MESSAGES = 3;

const shareCommand: SlashCommand = {
  name: "/share",
  aliases: ["/share-session"],
  description: "Put your session in front of the ServiceNow community",
  category: "meta",
  requiresConnection: true,
  execute: (ctx) => {
    const hasPhases = ctx.completedPhases.length >= 1;
    const hasMessages = ctx.assistantMessageCount >= MIN_ASSISTANT_MESSAGES;

    if (!hasPhases && !hasMessages) {
      const tips: string[] = [];
      if (!hasPhases) tips.push("complete at least one SDLC phase");
      if (!hasMessages) tips.push(`exchange a few messages with the agent`);
      return {
        type: "system_message" as const,
        content: `Sharing works best when there\u2019s a real story to tell. ${tips.length > 1 ? `Try to ${tips.join(" or ")}` : `Try to ${tips[0]}`}, and you\u2019ll have something worth putting out there.`,
        messageType: "warning" as const,
      };
    }

    return {
      type: "action" as const,
      action: "open_share_modal" as const,
    };
  },
};

export default shareCommand;
