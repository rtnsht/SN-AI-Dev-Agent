import type { UpdateSetSummary } from "../../types";
import type { PromptProvider, ProviderContext, ProviderResult } from "../types";
import { emptyResult } from "../types";

function pick<T>(arr: T[]): T {
  if (arr.length === 0) throw new Error("pick() called on empty array");
  return arr[Math.floor(Math.random() * arr.length)];
}

const US_FORYOU = [
  (name: string) => `Show contents of update set "${name}" and summarize changes`,
  (name: string) => `Review update set "${name}" for completeness before promoting`,
];

const US_QUICK = [
  (name: string) => `What's in update set "${name}"?`,
  (name: string) => `List all artifacts in update set "${name}"`,
];

export const updateSetProvider: PromptProvider = {
  id: "update-sets",
  name: "Update Sets",

  async fetch(ctx: ProviderContext): Promise<ProviderResult> {
    const result = emptyResult();
    const { snClient } = ctx;

    const updSets = await snClient
      .getRecords("sys_update_set", {
        sysparm_query: "nameNOT LIKEDefault^stateNOT IN ignore^ORDERBYDESCsys_updated_on",
        sysparm_fields: "sys_id,name,description,state,application,sys_updated_on",
        sysparm_limit: 15,
      })
      .catch(() => [] as Record<string, unknown>[]);

    for (const us of updSets.slice(0, 4)) {
      const name = us.name as string;
      result.foryou.push({ icon: "📝", text: pick(US_FORYOU)(name), desc: "Update set review", priority: 6 });
      result.quick.push({ icon: "📝", text: pick(US_QUICK)(name), desc: "Update set", priority: 7 });
    }

    const stateMap: Record<string, string> = {
      "in progress": "In Progress",
      complete: "Complete",
      build: "Build",
      retrieved: "Retrieved",
      previewed: "Previewed",
      committed: "Committed",
      "": "Unknown",
    };

    const updates: UpdateSetSummary[] = updSets.slice(0, 10).map((us) => {
      const stateVal = String(us.state || "");
      return {
        sysId: String(us.sys_id || ""),
        name: String(us.name || "Untitled"),
        state: stateMap[stateVal] || stateVal,
        description: String(us.description || "No description provided"),
        updatedOn: String(us.sys_updated_on || ""),
        application: String(us.application || "Global"),
      };
    });

    result.updates = updates;
    return result;
  },
};
