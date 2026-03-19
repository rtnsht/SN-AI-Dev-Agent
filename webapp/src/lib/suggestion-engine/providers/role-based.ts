import type { PromptProvider, ProviderContext, ProviderResult } from "../types";
import { emptyResult } from "../types";

function pick<T>(arr: T[]): T {
  if (arr.length === 0) throw new Error("pick() called on empty array");
  return arr[Math.floor(Math.random() * arr.length)];
}

const ADMIN_PROMPTS = [
  { icon: "🛡️", text: "Audit ACL rules on my instance and identify security gaps", desc: "Security audit" },
  { icon: "⚡", text: "Analyze instance health — find anti-patterns, unused scripts, and performance issues", desc: "Health check" },
  { icon: "🔐", text: "Review system properties for security misconfigurations", desc: "Security review" },
  { icon: "👥", text: "Check for users with excessive roles or unused admin accounts", desc: "User audit" },
];

const ITIL_PROMPTS = [
  { icon: "📊", text: "Show incident trends and SLA compliance for my assignment groups", desc: "ITIL insights" },
  { icon: "📈", text: "Review SLA definitions and compliance rates across services", desc: "SLA review" },
  { icon: "⚖️", text: "Analyze assignment group workload distribution", desc: "Workload analysis" },
];

export const roleBasedProvider: PromptProvider = {
  id: "role-based",
  name: "Role-Based",

  async fetch(ctx: ProviderContext): Promise<ProviderResult> {
    const result = emptyResult();
    const roles = ctx.userContext?.roles || [];

    if (roles.includes("admin")) {
      const shuffled = [...ADMIN_PROMPTS];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      for (const p of shuffled.slice(0, 2)) {
        result.foryou.push({ ...p, priority: 7 });
      }
    }

    if (roles.includes("itil")) {
      const p = pick(ITIL_PROMPTS);
      result.foryou.push({ ...p, priority: 7 });
    }

    return result;
  },
};
