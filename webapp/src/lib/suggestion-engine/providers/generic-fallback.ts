import type { ExamplePrompt } from "../../types";
import type { PromptProvider, ProviderContext, ProviderResult, TabKey } from "../types";
import { emptyResult } from "../types";

/**
 * Shared static fallback prompts used by both ChatWindow and SuggestionPanel
 * when the instance is disconnected or the fetch failed.
 */
export const SUGGESTION_FALLBACK: Record<TabKey | "updates", ExamplePrompt[]> = {
  foryou: [
    { icon: "🏗️", text: "Build a high-priority incident justification feature with manager approval", desc: "Feature build" },
    { icon: "📦", text: "Create a catalog item for requesting a new laptop with approval workflow", desc: "Catalog" },
    { icon: "🔍", text: "Analyze my instance health and show me any anti-patterns", desc: "Health check" },
    { icon: "⚙️", text: "List all custom business rules on the incident table", desc: "Instance review" },
  ],
  build: [
    { icon: "🏗️", text: "Build an onboarding workflow that provisions accounts across IT systems", desc: "Workflow" },
    { icon: "📝", text: "Create a change request template with risk assessment and CAB approval", desc: "Template" },
    { icon: "💡", text: "Add a custom field to incident that tracks customer sentiment", desc: "Enhancement" },
    { icon: "📖", text: "Build a knowledge article approval workflow with draft and publish states", desc: "Workflow" },
  ],
  explore: [
    { icon: "⚙️", text: "Show me all active business rules on the incident table", desc: "Business rules" },
    { icon: "🛡️", text: "Audit my ACLs and find any overly permissive rules", desc: "Security audit" },
    { icon: "⏰", text: "List all scheduled jobs and their run frequencies", desc: "Scheduled jobs" },
    { icon: "🔍", text: "Find unused script includes in my instance", desc: "Cleanup" },
  ],
  quick: [
    { icon: "❓", text: "How many open incidents are assigned to my group?", desc: "Incidents" },
    { icon: "📝", text: "What update sets are in progress right now?", desc: "Update sets" },
    { icon: "🗂️", text: "Show the schema for the cmdb_ci_server table", desc: "Schema" },
    { icon: "📧", text: "List all notification email templates for incidents", desc: "Notifications" },
  ],
  updates: [],
};

export const genericFallbackProvider: PromptProvider = {
  id: "generic-fallback",
  name: "Generic Fallback",

  async fetch(_ctx: ProviderContext): Promise<ProviderResult> {
    const result = emptyResult();

    result.foryou.push(
      { icon: "🏗️", text: "Build a new feature on my instance following the full SDLC process", desc: "Full SDLC", priority: 2 },
      { icon: "🔍", text: "Analyze my instance health — find anti-patterns and performance issues", desc: "Health check", priority: 2 },
    );

    result.build.push(
      { icon: "🏗️", text: "Build an onboarding workflow that provisions accounts across IT systems", desc: "Workflow", priority: 2 },
      { icon: "📝", text: "Create a change request template with risk assessment and CAB approval", desc: "Template", priority: 2 },
      { icon: "💡", text: "Add a custom field to incident that tracks customer sentiment", desc: "Enhancement", priority: 2 },
      { icon: "📖", text: "Build a knowledge article approval workflow with draft and publish states", desc: "Workflow", priority: 2 },
    );

    result.explore.push(
      { icon: "📋", text: "List all custom applications and scoped apps on this instance", desc: "Apps", priority: 2 },
      { icon: "🔍", text: "Find unused script includes in my instance", desc: "Cleanup", priority: 2 },
    );

    result.quick.push(
      { icon: "❓", text: "How many open incidents are there right now?", desc: "Incidents", priority: 2 },
      { icon: "📝", text: "What update sets are in progress right now?", desc: "Update sets", priority: 2 },
      { icon: "🗂️", text: "Show the schema for the cmdb_ci_server table", desc: "Schema", priority: 2 },
      { icon: "📧", text: "List all notification email templates for incidents", desc: "Notifications", priority: 2 },
    );

    return result;
  },
};
