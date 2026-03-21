import type { SlashCommand } from "../types";

const buildCommand: SlashCommand = {
  name: "/build",
  aliases: ["/sdd", "/new-requirement", "/req"],
  description: "Start a new requirement with phase gates (SDD mode)",
  category: "mode",
  requiresConnection: false,
  isAvailable: (ctx) => !ctx.sddMode,
  execute: () => ({
    type: "state_update" as const,
    updates: {
      sddMode: true,
      currentPhase: "spec" as const,
      completedPhases: [],
    },
  }),
};

export default buildCommand;
