import assert from "node:assert/strict";
import test from "node:test";

import { mergeHierarchicalSettings, resolveHierarchySettings, type WorkspaceContext } from "../src/lib/workspace.ts";

test("mergeHierarchicalSettings applies later layers last and ignores nullish values", () => {
  const merged = mergeHierarchicalSettings(
    { default_model: "claude-sonnet-4-6", retries: 1 },
    null,
    undefined,
    { retries: 2, default_tools: ["core"] },
    { default_model: "glm-4.5" }
  );

  assert.deepEqual(merged, {
    default_model: "glm-4.5",
    retries: 2,
    default_tools: ["core"],
  });
});

test("resolveHierarchySettings merges workspace, space, project, and chat settings in precedence order", () => {
  const context: WorkspaceContext = {
    workspace: {
      id: "workspace-1",
      user_id: "user-1",
      name: "Workspace",
      settings: {
        default_model: "claude-sonnet-4-6",
        guardrails: ["workspace"],
        nested: { source: "workspace" },
      },
      created_at: "2026-03-30T00:00:00.000Z",
      updated_at: "2026-03-30T00:00:00.000Z",
    },
    space: {
      id: "space-1",
      workspace_id: "workspace-1",
      name: "Space",
      settings: {
        default_tools: ["analysis"],
        nested: { source: "space" },
      },
      created_at: "2026-03-30T00:00:00.000Z",
      updated_at: "2026-03-30T00:00:00.000Z",
    },
    project: {
      id: "project-1",
      space_id: "space-1",
      name: "Project",
      description: null,
      settings: {
        default_model: "gemini-2.5-flash",
        nested: { source: "project" },
      },
      created_at: "2026-03-30T00:00:00.000Z",
      updated_at: "2026-03-30T00:00:00.000Z",
    },
  };

  const resolved = resolveHierarchySettings(context, {
    default_model: "glm-4.5",
    chat_override: true,
    nested: { source: "chat" },
  });

  assert.deepEqual(resolved, {
    default_model: "glm-4.5",
    guardrails: ["workspace"],
    default_tools: ["analysis"],
    chat_override: true,
    nested: { source: "chat" },
  });
});
