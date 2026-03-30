import type { ServiceNowClient } from "../src/client/sn-client.js";
import {
  createTransformEntry,
  executeTransformMap,
  listTransformMaps,
} from "../src/tools/data-import.js";

describe("data import tools", () => {
  it("merges active-only and caller filters when listing transform maps", async () => {
    const getRecords = vi.fn().mockResolvedValue([]);
    const client = { getRecords } as unknown as ServiceNowClient;

    await listTransformMaps(client, {
      query: "source_table=u_import_stage",
      activeOnly: true,
      limit: 5,
    });

    expect(getRecords).toHaveBeenCalledWith(
      "sys_transform_map",
      expect.objectContaining({
        sysparm_query: "active=true^source_table=u_import_stage",
        sysparm_limit: 5,
      })
    );
  });

  it("maps transform-entry fields to the ServiceNow payload", async () => {
    const createRecord = vi.fn().mockResolvedValue({ sys_id: "entry-1" });
    const client = { createRecord } as unknown as ServiceNowClient;

    await createTransformEntry(client, {
      transformMapSysId: "map-1",
      sourceField: "u_source",
      targetField: "short_description",
      coalesce: true,
      useSourceScript: true,
      sourceScript: "answer = source.u_source;",
      choiceAction: "create",
      data: { order: 150 },
    });

    expect(createRecord).toHaveBeenCalledWith("sys_transform_entry", {
      map: "map-1",
      source_field: "u_source",
      target_field: "short_description",
      coalesce: true,
      use_source_script: true,
      source_script: "answer = source.u_source;",
      choice_action: "create",
      order: 150,
    });
  });

  it("builds the transform worker script with the provided identifiers", async () => {
    const executeScript = vi.fn().mockResolvedValue({ success: true, runId: "run-1" });
    const client = { executeScript } as unknown as ServiceNowClient;

    const result = await executeTransformMap(client, {
      transformMapSysId: "map-99",
      importSetSysId: "set-42",
    });

    expect(executeScript).toHaveBeenCalledTimes(1);
    expect(executeScript.mock.calls[0]?.[0]).toContain(
      "new GlideImportSetTransformerWorker('set-42', 'map-99')"
    );
    expect(result).toEqual({
      success: true,
      message: "Transform execution requested",
      execution: { success: true, runId: "run-1" },
    });
  });
});
