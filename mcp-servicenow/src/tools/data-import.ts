import { z } from "zod";

import { ServiceNowClient } from "../client/sn-client.js";

const coerceJsonObject = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  },
  z.record(z.unknown())
);

function mergeQuery(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join("^");
}

export const listDataSourcesSchema = z.object({
  query: z.string().optional(),
  activeOnly: z.boolean().optional().default(true),
  limit: z.number().optional().default(20),
});

export const getDataSourceSchema = z.object({
  sys_id: z.string(),
});

export const createDataSourceSchema = z.object({
  name: z.string(),
  importSetTable: z.string().describe("Import set table name or sys_db_object sys_id"),
  format: z.string().optional().default("CSV"),
  retrievalMethod: z.string().optional().default("Attachment"),
  data: coerceJsonObject.optional().default({}),
});

export const listImportSetsSchema = z.object({
  query: z.string().optional(),
  limit: z.number().optional().default(20),
});

export const getImportSetRowsSchema = z.object({
  importSetSysId: z.string(),
  limit: z.number().optional().default(50),
});

export const listTransformMapsSchema = z.object({
  query: z.string().optional(),
  activeOnly: z.boolean().optional().default(true),
  limit: z.number().optional().default(20),
});

export const getTransformMapSchema = z.object({
  sys_id: z.string(),
});

export const createTransformMapSchema = z.object({
  name: z.string(),
  sourceTable: z.string(),
  targetTable: z.string(),
  order: z.number().optional().default(100),
  active: z.boolean().optional().default(true),
  runBusinessRules: z.boolean().optional().default(false),
  copyEmptyFields: z.boolean().optional().default(false),
  enforceMandatoryFields: z.boolean().optional().default(false),
  data: coerceJsonObject.optional().default({}),
});

export const listTransformEntriesSchema = z.object({
  transformMapSysId: z.string(),
  limit: z.number().optional().default(50),
});

export const createTransformEntrySchema = z.object({
  transformMapSysId: z.string(),
  sourceField: z.string(),
  targetField: z.string(),
  coalesce: z.boolean().optional().default(false),
  useSourceScript: z.boolean().optional().default(false),
  sourceScript: z.string().optional(),
  choiceAction: z.string().optional().default("ignore"),
  data: coerceJsonObject.optional().default({}),
});

export const listTransformScriptsSchema = z.object({
  transformMapSysId: z.string(),
  when: z.string().optional(),
  limit: z.number().optional().default(20),
});

export const createTransformScriptSchema = z.object({
  transformMapSysId: z.string(),
  name: z.string(),
  when: z.string().optional().default("onBefore"),
  order: z.number().optional().default(100),
  script: z.string(),
  data: coerceJsonObject.optional().default({}),
});

export const executeTransformMapSchema = z.object({
  transformMapSysId: z.string(),
  importSetSysId: z.string(),
});

export const getTransformRunHistorySchema = z.object({
  transformMapSysId: z.string().optional(),
  importSetSysId: z.string().optional(),
  limit: z.number().optional().default(20),
});

export async function listDataSources(
  client: ServiceNowClient,
  input: z.infer<typeof listDataSourcesSchema>
) {
  const records = await client.getRecords("sys_data_source", {
    sysparm_query: mergeQuery(input.activeOnly ? "active=true" : undefined, input.query),
    sysparm_limit: input.limit,
    sysparm_fields:
      "sys_id,name,import_set_table,format,file_retrieval_method,active,sys_updated_on",
  });

  return { success: true, count: records.length, dataSources: records };
}

export async function getDataSource(
  client: ServiceNowClient,
  input: z.infer<typeof getDataSourceSchema>
) {
  const record = await client.getRecord("sys_data_source", input.sys_id);
  if (!record) return { success: false, error: "Data source not found" };
  return { success: true, dataSource: record };
}

export async function createDataSource(
  client: ServiceNowClient,
  input: z.infer<typeof createDataSourceSchema>
) {
  const record = await client.createRecord("sys_data_source", {
    name: input.name,
    import_set_table: input.importSetTable,
    format: input.format,
    file_retrieval_method: input.retrievalMethod,
    ...input.data,
  });

  return { success: true, sys_id: record.sys_id, dataSource: record };
}

export async function listImportSets(
  client: ServiceNowClient,
  input: z.infer<typeof listImportSetsSchema>
) {
  const records = await client.getRecords("sys_import_set", {
    sysparm_query: input.query,
    sysparm_limit: input.limit,
    sysparm_fields:
      "sys_id,table_name,state,mode,load_completed,rows_loaded,sys_created_on,sys_updated_on",
  });

  return { success: true, count: records.length, importSets: records };
}

export async function getImportSetRows(
  client: ServiceNowClient,
  input: z.infer<typeof getImportSetRowsSchema>
) {
  const rows = await client.getRecords("sys_import_set_row", {
    sysparm_query: `sys_import_set=${input.importSetSysId}`,
    sysparm_limit: input.limit,
  });

  return { success: true, count: rows.length, rows };
}

export async function listTransformMaps(
  client: ServiceNowClient,
  input: z.infer<typeof listTransformMapsSchema>
) {
  const records = await client.getRecords("sys_transform_map", {
    sysparm_query: mergeQuery(input.activeOnly ? "active=true" : undefined, input.query),
    sysparm_limit: input.limit,
    sysparm_fields:
      "sys_id,name,source_table,target_table,active,order,run_business_rules,copy_empty_fields,enforce_mandatory_fields",
  });

  return { success: true, count: records.length, transformMaps: records };
}

export async function getTransformMap(
  client: ServiceNowClient,
  input: z.infer<typeof getTransformMapSchema>
) {
  const record = await client.getRecord("sys_transform_map", input.sys_id);
  if (!record) return { success: false, error: "Transform map not found" };
  return { success: true, transformMap: record };
}

export async function createTransformMap(
  client: ServiceNowClient,
  input: z.infer<typeof createTransformMapSchema>
) {
  const record = await client.createRecord("sys_transform_map", {
    name: input.name,
    source_table: input.sourceTable,
    target_table: input.targetTable,
    order: input.order,
    active: input.active,
    run_business_rules: input.runBusinessRules,
    copy_empty_fields: input.copyEmptyFields,
    enforce_mandatory_fields: input.enforceMandatoryFields,
    ...input.data,
  });

  return { success: true, sys_id: record.sys_id, transformMap: record };
}

export async function listTransformEntries(
  client: ServiceNowClient,
  input: z.infer<typeof listTransformEntriesSchema>
) {
  const records = await client.getRecords("sys_transform_entry", {
    sysparm_query: `map=${input.transformMapSysId}`,
    sysparm_limit: input.limit,
    sysparm_fields:
      "sys_id,map,source_field,target_field,coalesce,use_source_script,choice_action,order",
  });

  return { success: true, count: records.length, entries: records };
}

export async function createTransformEntry(
  client: ServiceNowClient,
  input: z.infer<typeof createTransformEntrySchema>
) {
  const record = await client.createRecord("sys_transform_entry", {
    map: input.transformMapSysId,
    source_field: input.sourceField,
    target_field: input.targetField,
    coalesce: input.coalesce,
    use_source_script: input.useSourceScript,
    source_script: input.sourceScript,
    choice_action: input.choiceAction,
    ...input.data,
  });

  return { success: true, sys_id: record.sys_id, entry: record };
}

export async function listTransformScripts(
  client: ServiceNowClient,
  input: z.infer<typeof listTransformScriptsSchema>
) {
  const records = await client.getRecords("sys_transform_script", {
    sysparm_query: mergeQuery(`map=${input.transformMapSysId}`, input.when ? `when=${input.when}` : undefined),
    sysparm_limit: input.limit,
    sysparm_fields: "sys_id,map,name,when,order,active,run_script",
  });

  return { success: true, count: records.length, scripts: records };
}

export async function createTransformScript(
  client: ServiceNowClient,
  input: z.infer<typeof createTransformScriptSchema>
) {
  const record = await client.createRecord("sys_transform_script", {
    map: input.transformMapSysId,
    name: input.name,
    when: input.when,
    order: input.order,
    run_script: input.script,
    active: true,
    ...input.data,
  });

  return { success: true, sys_id: record.sys_id, script: record };
}

export async function executeTransformMap(
  client: ServiceNowClient,
  input: z.infer<typeof executeTransformMapSchema>
) {
  const result = await client.executeScript(`
var output = {};
try {
  var worker = new GlideImportSetTransformerWorker('${input.importSetSysId}', '${input.transformMapSysId}');
  worker.setBackground(true);
  output.runId = worker.start();
  output.success = true;
  output.importSetSysId = '${input.importSetSysId}';
  output.transformMapSysId = '${input.transformMapSysId}';
} catch (e) {
  output.success = false;
  output.error = e + '';
}
output;
  `);

  return {
    success: true,
    message: "Transform execution requested",
    execution: result,
  };
}

export async function getTransformRunHistory(
  client: ServiceNowClient,
  input: z.infer<typeof getTransformRunHistorySchema>
) {
  const records = await client.getRecords("sys_import_set_run", {
    sysparm_query: mergeQuery(
      input.transformMapSysId ? `transform_map=${input.transformMapSysId}` : undefined,
      input.importSetSysId ? `set=${input.importSetSysId}` : undefined
    ),
    sysparm_limit: input.limit,
    sysparm_fields:
      "sys_id,set,transform_map,state,started,completed,inserted,updated,ignored,error_message",
  });

  return { success: true, count: records.length, runs: records };
}
