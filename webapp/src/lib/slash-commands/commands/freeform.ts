import type { SlashCommand } from "../types";

const freeformCommand: SlashCommand = {
  name: "/freeform",
  aliases: ["/skip-sdd", "/free"],
  description: "Disable phase gates — full tool access",
  category: "mode",
  requiresConnection: false,
  isAvailable: (ctx) => ctx.sddMode,
  execute: () => ({
    type: "state_update" as const,
    updates: {
      sddMode: false,
      currentPhase: null,
      completedPhases: [],
    },
  }),
};

export default freeformCommand;
