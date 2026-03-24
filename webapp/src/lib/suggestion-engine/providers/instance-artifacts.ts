import type { PromptProvider, ProviderContext, ProviderResult } from "../types";
import { emptyResult } from "../types";

function pick<T>(arr: T[]): T {
  if (arr.length === 0) throw new Error("pick() called on empty array");
  return arr[Math.floor(Math.random() * arr.length)];
}

const TABLE_EXPLORE = [
  (label: string, name: string) => `Analyze the custom table "${label}" (${name}) — fields, rules, and ACLs`,
  (label: string, name: string) => `Show recent changes to table "${label}" (${name})`,
  (_: string, name: string) => `Check ${name} for missing indexes or performance issues`,
  (label: string, name: string) => `Compare "${label}" (${name}) with similar OOB tables`,
];
const TABLE_BUILD = [
  (label: string, name: string) => `Add validation rules or UI policies to "${label}" (${name})`,
  (label: string, name: string) => `Create a dashboard widget for "${label}" (${name}) records`,
  (label: string, name: string) => `Build an approval workflow for "${label}" (${name})`,
];
const TABLE_QUICK = [
  (_: string, name: string) => `Show schema and record count for ${name}`,
  (_: string, name: string) => `List all fields on ${name} with types`,
  (_: string, name: string) => `How many records in ${name} were created this week?`,
];

const RULE_EXPLORE = [
  (n: number, t: string) => `Review ${n} active business rule(s) on "${t}" for conflicts or performance issues`,
  (n: number, t: string) => `Find business rules on "${t}" that run on insert vs update`,
  (n: number, t: string) => `Check ${n} business rules on "${t}" for GlideRecord performance issues`,
];
const RULE_BUILD = [
  (n: number, t: string) => `Refactor and consolidate the ${n} business rules on "${t}"`,
  (n: number, t: string) => `Add logging and error handling to rules on "${t}"`,
  (n: number, t: string) => `Convert synchronous rules on "${t}" to async where safe`,
];

const CATALOG_EXPLORE = [
  (name: string) => `Analyze catalog item "${name}" — review variables, workflow, and suggest improvements`,
  (name: string) => `Check "${name}" for missing mandatory variables`,
  (name: string) => `Review "${name}" approval and fulfillment flow`,
];
const CATALOG_BUILD = [
  (name: string) => `Add approval workflow or notifications to catalog item "${name}"`,
  (name: string) => `Create order guide combining "${name}" with related items`,
  (name: string) => `Add dynamic variable visibility rules to "${name}"`,
  (name: string) => `Create a new catalog item similar to "${name}" with variables and category`,
  (name: string) => `Build a record producer based on "${name}" for a custom table`,
];

const JOB_EXPLORE = [
  (name: string) => `Review scheduled job "${name}" — check run frequency and script performance`,
  (name: string) => `Check if "${name}" has proper error handling and logging`,
  (name: string) => `Analyze "${name}" run history for failures`,
];

const KB_EXPLORE = [
  (title: string) => `Analyze knowledge base "${title}" — article count, gaps, and quality`,
  (title: string) => `Find outdated articles in "${title}"`,
];
const KB_BUILD = [
  (title: string) => `Build an article approval workflow for knowledge base "${title}"`,
  (title: string) => `Create article templates for "${title}"`,
];

const WF_EXPLORE = [
  (name: string) => `Review workflow "${name}" — check activities, conditions, and error handling`,
  (name: string) => `Analyze "${name}" for redundant or dead-end paths`,
];
const WF_BUILD = [
  (name: string) => `Extend workflow "${name}" with notification or approval steps`,
  (name: string) => `Add SLA timer activities to workflow "${name}"`,
];

export const instanceArtifactProvider: PromptProvider = {
  id: "instance-artifacts",
  name: "Instance Artifacts",

  async fetch(ctx: ProviderContext): Promise<ProviderResult> {
    const result = emptyResult();
    const { snClient } = ctx;

    const queries = [
      snClient.getRecords("sys_db_object", {
        sysparm_query: "nameSTARTSWITHu_^ORnameSTARTSWITHx_^super_class!=NULL",
        sysparm_fields: "name,label",
        sysparm_limit: 20,
      }),
      snClient.getRecords("sys_script", {
        sysparm_query: "active=true^collectionISNOTEMPTY^ORDERBYDESCsys_updated_on",
        sysparm_fields: "name,collection,when",
        sysparm_limit: 20,
      }),
      snClient.getRecords("sc_cat_item", {
        sysparm_query: "active=true^ORDERBYDESCsys_updated_on",
        sysparm_fields: "name,short_description,category",
        sysparm_limit: 15,
      }),
      snClient.getRecords("sysauto_script", {
        sysparm_query: "active=true^ORDERBYDESCsys_updated_on",
        sysparm_fields: "name,run_type,run_dayofweek",
        sysparm_limit: 15,
      }),
      snClient.getRecords("kb_knowledge_base", {
        sysparm_query: "active=true",
        sysparm_fields: "title,kb_version",
        sysparm_limit: 10,
      }),
      snClient.getRecords("wf_workflow", {
        sysparm_query: "active=true^ORDERBYDESCsys_updated_on",
        sysparm_fields: "name,table,description",
        sysparm_limit: 10,
      }),
      snClient.getRecords("sysevent_email_action", {
        sysparm_query: "active=true^ORDERBYDESCsys_updated_on",
        sysparm_fields: "name,collection,event_name",
        sysparm_limit: 15,
      }),
      snClient.getRecords("sys_security_acl", {
        sysparm_query: "active=true^ORDERBYname",
        sysparm_fields: "name,type,operation",
        sysparm_limit: 20,
      }),
    ];

    const settled = await Promise.allSettled(queries);
    const get = (i: number) =>
      settled[i]?.status === "fulfilled"
        ? (settled[i] as PromiseFulfilledResult<Record<string, unknown>[]>).value
        : [];

    const tables = get(0);
    const rules = get(1);
    const catItems = get(2);
    const schedJobs = get(3);
    const kbases = get(4);
    const workflows = get(5);
    const notifications = get(6);
    const acls = get(7);

    for (const t of tables.slice(0, 8)) {
      const label = (t.label as string) || (t.name as string);
      const name = t.name as string;
      result.explore.push({ icon: "🔍", text: pick(TABLE_EXPLORE)(label, name), desc: "Table analysis", priority: 5 });
      result.build.push({ icon: "➕", text: pick(TABLE_BUILD)(label, name), desc: "Table enhancement", priority: 5 });
      result.quick.push({ icon: "📊", text: pick(TABLE_QUICK)(label, name), desc: "Table info", priority: 5 });
    }

    const rulesByTable = new Map<string, string[]>();
    for (const r of rules) {
      const col = r.collection as string;
      if (!col) continue;
      if (!rulesByTable.has(col)) rulesByTable.set(col, []);
      rulesByTable.get(col)!.push(r.name as string);
    }
    for (const [table, names] of rulesByTable) {
      result.explore.push({ icon: "⚙️", text: pick(RULE_EXPLORE)(names.length, table), desc: "Code review", priority: 7 });
      if (names.length > 3) {
        result.build.push({ icon: "🔧", text: pick(RULE_BUILD)(names.length, table), desc: "Code optimization", priority: 5 });
      }
    }

    for (const item of catItems.slice(0, 6)) {
      const name = (item.name as string) || (item.short_description as string);
      result.explore.push({ icon: "📦", text: pick(CATALOG_EXPLORE)(name), desc: "Catalog review", priority: 5 });
      result.build.push({ icon: "🔗", text: pick(CATALOG_BUILD)(name), desc: "Catalog enhancement", priority: 5 });
    }

    for (const job of schedJobs.slice(0, 5)) {
      const name = job.name as string;
      result.explore.push({ icon: "⏰", text: pick(JOB_EXPLORE)(name), desc: "Job review", priority: 5 });
    }
    if (schedJobs.length > 0) {
      result.quick.push({ icon: "⏰", text: `List all ${schedJobs.length} active scheduled jobs and their run frequencies`, desc: "Scheduled jobs", priority: 7 });
    }

    for (const kb of kbases.slice(0, 4)) {
      const title = (kb.title as string) || "Untitled KB";
      result.explore.push({ icon: "📚", text: pick(KB_EXPLORE)(title), desc: "KB analysis", priority: 5 });
      result.build.push({ icon: "📚", text: pick(KB_BUILD)(title), desc: "KB enhancement", priority: 5 });
    }

    for (const wf of workflows.slice(0, 5)) {
      const name = wf.name as string;
      result.explore.push({ icon: "🔀", text: pick(WF_EXPLORE)(name), desc: "Workflow review", priority: 5 });
      result.build.push({ icon: "🔀", text: pick(WF_BUILD)(name), desc: "Workflow enhancement", priority: 5 });
    }

    const notifsByTable = new Map<string, number>();
    for (const n of notifications) {
      const col = n.collection as string;
      if (!col) continue;
      notifsByTable.set(col, (notifsByTable.get(col) || 0) + 1);
    }
    for (const [table, count] of notifsByTable) {
      result.explore.push({ icon: "📧", text: `Review ${count} email notification(s) on "${table}" — check conditions and recipients`, desc: "Notification review", priority: 5 });
    }
    if (notifications.length > 0) {
      result.quick.push({ icon: "📧", text: `List all ${notifications.length} active email notifications`, desc: "Notifications", priority: 6 });
    }

    if (acls.length > 0) {
      result.explore.push({ icon: "🛡️", text: `Audit ${acls.length}+ ACL rules — find overly permissive or conflicting access controls`, desc: "Security audit", priority: 7 });
    }

    return result;
  },
};
