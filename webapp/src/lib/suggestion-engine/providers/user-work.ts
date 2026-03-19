import type { PromptProvider, ProviderContext, ProviderResult } from "../types";
import { emptyResult } from "../types";

const INCIDENT_TEMPLATES_FORYOU = [
  (n: number, p1: number) =>
    p1 > 0
      ? `You have ${n} open incident(s) including ${p1} P1 — triage and review them`
      : `You have ${n} open incident(s) assigned to you — review their status`,
  (n: number, _p1: number) => `Review your ${n} open incidents by priority and age`,
  (n: number, _p1: number) => `Which of your ${n} incidents have breached SLA?`,
];

const INCIDENT_TEMPLATES_QUICK = [
  (n: number) => `List my ${n} open incidents with priority and state`,
  (n: number) => `Show my ${n} oldest open incidents`,
  (n: number) => `Which of my ${n} incidents are P1 or P2?`,
];

const CHANGE_TEMPLATES_FORYOU = [
  (n: number) => `You have ${n} active change request(s) — check implementation status`,
  (n: number) => `Review your ${n} changes for upcoming CAB dates`,
  (n: number) => `Which of your ${n} changes need risk assessment?`,
];

const CHANGE_TEMPLATES_QUICK = [
  (n: number) => `Show my ${n} active change requests and their states`,
  (n: number) => `List my ${n} pending changes with scheduled dates`,
];

const APPROVAL_TEMPLATES = [
  (n: number) => `You have ${n} pending approval(s) waiting for your review`,
  (n: number) => `Review and action your ${n} pending approvals`,
];

const GROUP_TEMPLATES_FORYOU = [
  (n: number, g: string) => `${n} unassigned incident(s) in ${g} — pick up or assign them`,
  (n: number, g: string) => `Review ${n} unassigned tickets in ${g} by priority`,
];

const GROUP_TEMPLATES_QUICK = [
  (n: number, g: string) => `List unassigned incidents in ${g}`,
  (n: number, g: string) => `Show ${n} unassigned incidents in ${g} sorted by priority`,
];

function pick<T>(arr: T[]): T {
  if (arr.length === 0) throw new Error("pick() called on empty array");
  return arr[Math.floor(Math.random() * arr.length)];
}

export const userWorkProvider: PromptProvider = {
  id: "user-work",
  name: "User Work",

  async fetch(ctx: ProviderContext): Promise<ProviderResult> {
    const result = emptyResult();
    const { snClient, userContext } = ctx;
    if (!userContext?.sysId) return result;

    const groupSysIds = userContext.assignmentGroups?.map((g) => g.sysId).filter(Boolean) || [];

    const queries = [
      snClient.getRecords("incident", {
        sysparm_query: `assigned_to=${userContext.sysId}^state!=7^state!=8`,
        sysparm_fields: "number,short_description,priority,state",
        sysparm_limit: 20,
      }),
      snClient.getRecords("change_request", {
        sysparm_query: `assigned_to=${userContext.sysId}^stateNOT IN3,4,7`,
        sysparm_fields: "number,short_description,type,state",
        sysparm_limit: 15,
      }),
      snClient.getRecords("sysapproval_approver", {
        sysparm_query: `approver=${userContext.sysId}^state=requested`,
        sysparm_fields: "sysapproval,state,sys_created_on",
        sysparm_limit: 15,
      }),
      ...(groupSysIds.length > 0
        ? [
            snClient.getRecords("incident", {
              sysparm_query: `assignment_groupIN${groupSysIds.join(",")}^assigned_toISEMPTY^state!=7^state!=8`,
              sysparm_fields: "number,short_description,priority,assignment_group",
              sysparm_limit: 20,
            }),
          ]
        : []),
    ];

    const settled = await Promise.allSettled(queries);
    const get = (i: number) =>
      settled[i]?.status === "fulfilled"
        ? (settled[i] as PromiseFulfilledResult<Record<string, unknown>[]>).value
        : [];

    const myIncidents = get(0);
    const myChanges = get(1);
    const myApprovals = get(2);
    const groupUnassigned = groupSysIds.length > 0 ? get(3) : [];

    if (myIncidents.length > 0) {
      const p1Count = myIncidents.filter((i) => String(i.priority) === "1").length;
      const tpl = pick(INCIDENT_TEMPLATES_FORYOU);
      result.foryou.push({ icon: "🚨", text: tpl(myIncidents.length, p1Count), desc: "My incidents", priority: 10 });
      const qtpl = pick(INCIDENT_TEMPLATES_QUICK);
      result.quick.push({ icon: "📋", text: qtpl(myIncidents.length), desc: "My work", priority: 10 });
    }

    if (myChanges.length > 0) {
      const tpl = pick(CHANGE_TEMPLATES_FORYOU);
      result.foryou.push({ icon: "🔄", text: tpl(myChanges.length), desc: "My changes", priority: 10 });
      const qtpl = pick(CHANGE_TEMPLATES_QUICK);
      result.quick.push({ icon: "🔄", text: qtpl(myChanges.length), desc: "My work", priority: 10 });
    }

    if (myApprovals.length > 0) {
      const tpl = pick(APPROVAL_TEMPLATES);
      result.foryou.push({ icon: "✅", text: tpl(myApprovals.length), desc: "My approvals", priority: 10 });
    }

    if (groupUnassigned.length > 0) {
      const groups = userContext.assignmentGroups || [];
      const groupName = groups.length > 1
        ? `${groups[0]?.name || "your group"} (+${groups.length - 1} more)`
        : groups[0]?.name || "your group";
      const tpl = pick(GROUP_TEMPLATES_FORYOU);
      result.foryou.push({ icon: "📥", text: tpl(groupUnassigned.length, groupName), desc: "Group work", priority: 9 });
      const qtpl = pick(GROUP_TEMPLATES_QUICK);
      result.quick.push({ icon: "📥", text: qtpl(groupUnassigned.length, groupName), desc: "Group work", priority: 9 });
    }

    return result;
  },
};
