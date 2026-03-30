import type { ServiceNowClient } from "../src/client/sn-client.js";
import {
  getAnthropicToolDefinitionsForPhase,
  getAnthropicToolDefinitions,
} from "../src/tool-definitions.js";
import { getBestPractices } from "../src/tools/recommendation-engine.js";

function toolNamesForPhase(phase: Parameters<typeof getAnthropicToolDefinitionsForPhase>[0]) {
  return new Set(getAnthropicToolDefinitionsForPhase(phase).map((tool) => tool.name));
}

describe("tool evals", () => {
  it("keeps quick-query mapped to real read-only tool names", () => {
    const quickQueryTools = toolNamesForPhase("quick_query");

    expect(quickQueryTools.has("sn_query_records")).toBe(true);
    expect(quickQueryTools.has("sn_list_update_sets")).toBe(true);
    expect(quickQueryTools.has("sn_get_records")).toBe(false);
    expect(quickQueryTools.has("sn_get_update_sets")).toBe(false);
  });

  it("includes import and transform tools in implementation", () => {
    const implementationTools = toolNamesForPhase("implementation");
    for (const requiredTool of [
      "sn_list_data_sources",
      "sn_create_data_source",
      "sn_list_import_sets",
      "sn_get_import_set_rows",
      "sn_list_transform_maps",
      "sn_get_transform_map",
      "sn_create_transform_map",
      "sn_list_transform_entries",
      "sn_create_transform_entry",
      "sn_list_transform_scripts",
      "sn_create_transform_script",
      "sn_execute_transform_map",
      "sn_get_transform_run_history",
    ]) {
      expect(implementationTools.has(requiredTool)).toBe(true);
    }
  });

  it("publishes import and transform tools in the global catalog", () => {
    const allTools = new Set(getAnthropicToolDefinitions().map((tool) => tool.name));
    expect(allTools.has("sn_list_transform_maps")).toBe(true);
    expect(allTools.has("sn_execute_transform_map")).toBe(true);
  });

  it("returns transform-map best practices guidance", async () => {
    const result = await getBestPractices(
      null as unknown as ServiceNowClient,
      { artifactType: "transform_map" }
    );

    expect(result.success).toBe(true);
    expect(result.guide?.artifactType).toBe("transform_map");
    expect(result.guide?.doList.length).toBeGreaterThan(0);
  });
});
