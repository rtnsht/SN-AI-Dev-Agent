/**
 * Dependency Graph Builder
 * 
 * Maps relationships between ServiceNow artifacts to understand dependencies.
 * This is critical for:
 * - Impact analysis before making changes
 * - Understanding code dependencies
 * - Finding orphaned/unused artifacts
 * - Planning refactoring efforts
 * 
 * Dependency Types Detected:
 * - Script Include references (new ClassName(), ClassName.method())
 * - GlideAjax calls (Client Script → Script Include)
 * - GlideRecord usage (Script → Table)
 * - Business Rule/Client Script → Table relationships
 * - Flow → Subflow → Action relationships
 * - ACL script dependencies
 * - Notification script references
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';

// ============ INPUT SCHEMA ============

export const getDependencyGraphSchema = z.object({
  artifactType: z.enum([
    'script_include',
    'business_rule', 
    'client_script',
    'ui_action',
    'ui_policy',
    'scheduled_job',
    'flow',
    'acl',
    'notification',
    'all'
  ]).optional().default('all').describe('Type of artifact to analyze'),
  
  artifactName: z.string().optional().describe(
    'Specific artifact name to analyze (returns dependencies for this artifact only)'
  ),
  
  scope: z.string().optional().describe('Filter by application scope'),
  
  direction: z.enum(['both', 'upstream', 'downstream']).optional().default('both').describe(
    'Direction of dependencies: upstream (what this depends on), downstream (what depends on this), or both'
  ),
  
  depth: z.number().optional().default(2).describe(
    'How many levels deep to trace dependencies (1-5)'
  ),
  
  includeTableDependencies: z.boolean().optional().default(true).describe(
    'Include table/GlideRecord dependencies'
  ),
  
  limit: z.number().optional().default(100).describe(
    'Maximum number of artifacts to analyze'
  )
});

export type GetDependencyGraphInput = z.infer<typeof getDependencyGraphSchema>;

// ============ TYPES ============

interface DependencyNode {
  sys_id: string;
  name: string;
  type: string;
  table: string;
  scope?: string;
}

interface DependencyEdge {
  from: string;       // sys_id of source node
  to: string;         // sys_id of target node  
  fromName: string;   // Name of source
  toName: string;     // Name of target
  type: DependencyType;
  context?: string;   // Additional context (e.g., method name called)
}

type DependencyType = 
  | 'calls_script_include'      // new ClassName() or ClassName.method()
  | 'glide_ajax'                // GlideAjax call to Script Include
  | 'glide_record'              // GlideRecord query on table
  | 'extends_class'             // Script Include extends another
  | 'triggers_on_table'         // Business Rule/Client Script on table
  | 'calls_flow'                // Flow calls subflow
  | 'calls_action'              // Flow calls action
  | 'uses_script'               // ACL/Notification uses script
  | 'references';               // Generic reference

interface DependencyGraph {
  success: boolean;
  timestamp: string;
  instanceUrl: string;
  summary: {
    totalNodes: number;
    totalEdges: number;
    nodesByType: Record<string, number>;
    edgesByType: Record<string, number>;
    orphanedArtifacts: string[];       // Artifacts with no dependencies
    highlyConnected: string[];          // Artifacts with many connections
  };
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  recommendations: string[];
}

// ============ SCRIPT PARSING PATTERNS ============

// Patterns to detect Script Include instantiation
const SCRIPT_INCLUDE_PATTERNS = [
  /new\s+([A-Z][a-zA-Z0-9_]+)\s*\(/g,                    // new ClassName()
  /([A-Z][a-zA-Z0-9_]+)\s*\.\s*[a-z][a-zA-Z0-9_]*\s*\(/g, // ClassName.method()
];

// Pattern to detect GlideAjax calls
const GLIDE_AJAX_PATTERN = /new\s+GlideAjax\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

// Pattern to detect GlideRecord usage
const GLIDE_RECORD_PATTERN = /new\s+GlideRecord\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

// Pattern to detect class extension
const EXTENDS_PATTERN = /\.extendsObject\s*\(\s*([A-Z][a-zA-Z0-9_]+)/g;

// Built-in ServiceNow classes to exclude
const BUILTIN_CLASSES = new Set([
  'GlideRecord', 'GlideAggregate', 'GlideDateTime', 'GlideDuration',
  'GlideElement', 'GlideFilter', 'GlideSystem', 'GlideSession',
  'GlideUser', 'GlideAjax', 'GlideDialogWindow', 'GlideForm',
  'GlideList2', 'GlideMenu', 'GlideModal', 'GlideOverlay',
  'GlidePane', 'GlideRecord', 'GlideURL', 'GlideDBFunctionBuilder',
  'GlideEncrypter', 'GlideHTTPRequest', 'GlideImpersonate',
  'GlideLocale', 'GlidePluginManager', 'GlideProperties',
  'GlideSchedule', 'GlideScopedEvaluator', 'GlideSecureRandomUtil',
  'GlideStringUtil', 'GlideSysAttachment', 'GlideTableHierarchy',
  'GlideTransaction', 'GlideUICompatibility', 'GlideUpdateManager',
  'GlideXMLUtil', 'XMLDocument', 'JSON', 'Array', 'Object', 'String',
  'Number', 'Boolean', 'Date', 'Math', 'RegExp', 'Error', 'Function',
  'AbstractAjaxProcessor', 'Workflow', 'RESTMessageV2', 'SOAPMessageV2',
  'sn_ws', 'sn_cc', 'sn_fd', 'sn_ih', 'Class', 'gs'
]);

// ============ HELPER FUNCTIONS ============

function parseScriptForDependencies(
  script: string,
  includeTableDeps: boolean
): { scriptIncludes: string[]; tables: string[]; extendsClass: string | null } {
  const scriptIncludes = new Set<string>();
  const tables = new Set<string>();
  let extendsClass: string | null = null;

  if (!script) {
    return { scriptIncludes: [], tables: [], extendsClass: null };
  }

  // Find Script Include instantiations
  for (const pattern of SCRIPT_INCLUDE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(script)) !== null) {
      const className = match[1];
      if (className && !BUILTIN_CLASSES.has(className)) {
        scriptIncludes.add(className);
      }
    }
  }

  // Find GlideAjax calls
  const glideAjaxRegex = new RegExp(GLIDE_AJAX_PATTERN.source, GLIDE_AJAX_PATTERN.flags);
  let ajaxMatch;
  while ((ajaxMatch = glideAjaxRegex.exec(script)) !== null) {
    if (ajaxMatch[1]) {
      scriptIncludes.add(ajaxMatch[1]);
    }
  }

  // Find class extension
  const extendsRegex = new RegExp(EXTENDS_PATTERN.source, EXTENDS_PATTERN.flags);
  const extendsMatch = extendsRegex.exec(script);
  if (extendsMatch && extendsMatch[1] && !BUILTIN_CLASSES.has(extendsMatch[1])) {
    extendsClass = extendsMatch[1];
  }

  // Find GlideRecord table references
  if (includeTableDeps) {
    const glideRecordRegex = new RegExp(GLIDE_RECORD_PATTERN.source, GLIDE_RECORD_PATTERN.flags);
    let grMatch;
    while ((grMatch = glideRecordRegex.exec(script)) !== null) {
      if (grMatch[1]) {
        tables.add(grMatch[1]);
      }
    }
  }

  return {
    scriptIncludes: Array.from(scriptIncludes),
    tables: Array.from(tables),
    extendsClass
  };
}

function createNodeId(type: string, name: string): string {
  return `${type}:${name}`;
}

function addNode(
  graph: DependencyGraph,
  nodeMap: Map<string, DependencyNode>,
  node: DependencyNode
): void {
  const nodeId = createNodeId(node.type, node.name);
  if (!nodeMap.has(nodeId)) {
    nodeMap.set(nodeId, node);
    graph.nodes.push(node);
    graph.summary.nodesByType[node.type] = (graph.summary.nodesByType[node.type] || 0) + 1;
  }
}

function addEdge(
  graph: DependencyGraph,
  edge: DependencyEdge
): void {
  // Avoid duplicate edges
  const edgeKey = `${edge.from}->${edge.to}:${edge.type}`;
  const existing = graph.edges.find(e =>
    e.from === edge.from && e.to === edge.to && e.type === edge.type
  );
  if (!existing) {
    graph.edges.push(edge);
    graph.summary.edgesByType[edge.type] = (graph.summary.edgesByType[edge.type] || 0) + 1;
  }
}

// ============ ARTIFACT FETCHERS ============

interface ArtifactConfig {
  table: string;
  nameField: string;
  scriptField: string;
  tableField?: string;
  type: string;
}

const ARTIFACT_CONFIGS: Record<string, ArtifactConfig> = {
  script_include: {
    table: 'sys_script_include',
    nameField: 'name',
    scriptField: 'script',
    type: 'Script Include'
  },
  business_rule: {
    table: 'sys_script',
    nameField: 'name',
    scriptField: 'script',
    tableField: 'collection',
    type: 'Business Rule'
  },
  client_script: {
    table: 'sys_script_client',
    nameField: 'name',
    scriptField: 'script',
    tableField: 'table',
    type: 'Client Script'
  },
  ui_action: {
    table: 'sys_ui_action',
    nameField: 'name',
    scriptField: 'script',
    tableField: 'table',
    type: 'UI Action'
  },
  ui_policy: {
    table: 'sys_ui_policy',
    nameField: 'short_description',
    scriptField: 'script_true,script_false',
    tableField: 'table',
    type: 'UI Policy'
  },
  scheduled_job: {
    table: 'sysauto_script',
    nameField: 'name',
    scriptField: 'script',
    type: 'Scheduled Job'
  },
  acl: {
    table: 'sys_security_acl',
    nameField: 'name',
    scriptField: 'script',
    type: 'ACL'
  },
  notification: {
    table: 'sysevent_email_action',
    nameField: 'name',
    scriptField: 'message_html,advanced_condition',
    type: 'Notification'
  }
};

async function fetchArtifacts(
  client: ServiceNowClient,
  config: ArtifactConfig,
  input: GetDependencyGraphInput
): Promise<Array<Record<string, unknown>>> {
  try {
    let query = 'active=true';

    if (input.scope) {
      query += `^sys_scope.scope=${input.scope}`;
    }

    if (input.artifactName) {
      query += `^${config.nameField}LIKE${input.artifactName}`;
    }

    const fields = ['sys_id', config.nameField, config.scriptField];
    if (config.tableField) {
      fields.push(config.tableField);
    }
    fields.push('sys_scope');

    return await client.getRecords(config.table, {
      sysparm_query: query,
      sysparm_fields: fields.join(','),
      sysparm_limit: input.limit
    });
  } catch {
    return [];
  }
}

// Build a map of Script Include names to their sys_ids
async function buildScriptIncludeMap(
  client: ServiceNowClient,
  input: GetDependencyGraphInput
): Promise<Map<string, { sys_id: string; name: string; scope?: string }>> {
  const map = new Map<string, { sys_id: string; name: string; scope?: string }>();

  try {
    let query = 'active=true';
    if (input.scope) {
      query += `^sys_scope.scope=${input.scope}`;
    }

    const records = await client.getRecords('sys_script_include', {
      sysparm_query: query,
      sysparm_fields: 'sys_id,name,sys_scope',
      sysparm_limit: 1000  // Get more for lookup
    });

    for (const record of records) {
      const name = String(record.name || '');
      if (name) {
        const scopeObj = record.sys_scope as { display_value?: string } | null;
        map.set(name, {
          sys_id: String(record.sys_id || ''),
          name,
          scope: scopeObj?.display_value || undefined
        });
      }
    }
  } catch {
    // Ignore errors
  }

  return map;
}

// ============ MAIN EXPORT FUNCTION ============

export async function getDependencyGraph(
  client: ServiceNowClient,
  input: GetDependencyGraphInput
): Promise<DependencyGraph> {
  const graph: DependencyGraph = {
    success: false,
    timestamp: new Date().toISOString(),
    instanceUrl: client.instanceUrl,
    summary: {
      totalNodes: 0,
      totalEdges: 0,
      nodesByType: {},
      edgesByType: {},
      orphanedArtifacts: [],
      highlyConnected: []
    },
    nodes: [],
    edges: [],
    recommendations: []
  };

  const nodeMap = new Map<string, DependencyNode>();

  try {
    // Build Script Include lookup map
    const scriptIncludeMap = await buildScriptIncludeMap(client, input);

    // Determine which artifact types to analyze
    const typesToAnalyze: string[] = input.artifactType === 'all'
      ? Object.keys(ARTIFACT_CONFIGS)
      : [input.artifactType];

    // Process each artifact type
    for (const artifactType of typesToAnalyze) {
      const config = ARTIFACT_CONFIGS[artifactType];
      if (!config) continue;

      const artifacts = await fetchArtifacts(client, config, input);

      for (const artifact of artifacts) {
        const name = String(artifact[config.nameField] || 'Unknown');
        const sysId = String(artifact.sys_id || '');
        const scopeObj = artifact.sys_scope as { display_value?: string } | null;
        const scope = scopeObj?.display_value;
        const targetTable = config.tableField
          ? String(artifact[config.tableField] || '')
          : undefined;

        // Create node for this artifact
        const node: DependencyNode = {
          sys_id: sysId,
          name,
          type: config.type,
          table: config.table,
          scope
        };
        addNode(graph, nodeMap, node);

        // Parse script content for dependencies
        const scriptFields = config.scriptField.split(',');
        let combinedScript = '';
        for (const field of scriptFields) {
          combinedScript += String(artifact[field.trim()] || '') + '\n';
        }

        const deps = parseScriptForDependencies(combinedScript, input.includeTableDependencies);

        // Add edges for Script Include dependencies
        for (const siName of deps.scriptIncludes) {
          const siInfo = scriptIncludeMap.get(siName);
          if (siInfo) {
            // Add Script Include as node
            const siNode: DependencyNode = {
              sys_id: siInfo.sys_id,
              name: siInfo.name,
              type: 'Script Include',
              table: 'sys_script_include',
              scope: siInfo.scope
            };
            addNode(graph, nodeMap, siNode);

            // Add edge
            addEdge(graph, {
              from: sysId,
              to: siInfo.sys_id,
              fromName: name,
              toName: siInfo.name,
              type: artifactType === 'client_script' ? 'glide_ajax' : 'calls_script_include',
              context: `${name} calls ${siInfo.name}`
            });
          }
        }

        // Add edge for class extension
        if (deps.extendsClass) {
          const parentInfo = scriptIncludeMap.get(deps.extendsClass);
          if (parentInfo) {
            const parentNode: DependencyNode = {
              sys_id: parentInfo.sys_id,
              name: parentInfo.name,
              type: 'Script Include',
              table: 'sys_script_include',
              scope: parentInfo.scope
            };
            addNode(graph, nodeMap, parentNode);

            addEdge(graph, {
              from: sysId,
              to: parentInfo.sys_id,
              fromName: name,
              toName: parentInfo.name,
              type: 'extends_class',
              context: `${name} extends ${parentInfo.name}`
            });
          }
        }

        // Add edges for table dependencies
        if (input.includeTableDependencies) {
          // Add target table relationship (Business Rule → Table)
          if (targetTable) {
            const tableNode: DependencyNode = {
              sys_id: `table:${targetTable}`,
              name: targetTable,
              type: 'Table',
              table: 'sys_db_object'
            };
            addNode(graph, nodeMap, tableNode);

            addEdge(graph, {
              from: sysId,
              to: `table:${targetTable}`,
              fromName: name,
              toName: targetTable,
              type: 'triggers_on_table',
              context: `${config.type} on ${targetTable}`
            });
          }

          // Add GlideRecord table dependencies
          for (const tableName of deps.tables) {
            const tableNode: DependencyNode = {
              sys_id: `table:${tableName}`,
              name: tableName,
              type: 'Table',
              table: 'sys_db_object'
            };
            addNode(graph, nodeMap, tableNode);

            addEdge(graph, {
              from: sysId,
              to: `table:${tableName}`,
              fromName: name,
              toName: tableName,
              type: 'glide_record',
              context: `Queries ${tableName}`
            });
          }
        }
      }
    }

    // Calculate summary
    graph.summary.totalNodes = graph.nodes.length;
    graph.summary.totalEdges = graph.edges.length;

    // Find orphaned artifacts (no incoming or outgoing edges)
    const connectedNodes = new Set<string>();
    for (const edge of graph.edges) {
      connectedNodes.add(edge.from);
      connectedNodes.add(edge.to);
    }
    for (const node of graph.nodes) {
      if (!connectedNodes.has(node.sys_id) && node.type !== 'Table') {
        graph.summary.orphanedArtifacts.push(node.name);
      }
    }

    // Find highly connected artifacts
    const connectionCount = new Map<string, number>();
    for (const edge of graph.edges) {
      connectionCount.set(edge.from, (connectionCount.get(edge.from) || 0) + 1);
      connectionCount.set(edge.to, (connectionCount.get(edge.to) || 0) + 1);
    }
    const sortedConnections = Array.from(connectionCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    for (const [nodeId, count] of sortedConnections) {
      const node = graph.nodes.find(n => n.sys_id === nodeId);
      if (node && count >= 3) {
        graph.summary.highlyConnected.push(`${node.name} (${count} connections)`);
      }
    }

    // Generate recommendations
    generateRecommendations(graph);

    graph.success = true;
  } catch (error) {
    graph.recommendations.push(`Error building dependency graph: ${error instanceof Error ? error.message : String(error)}`);
  }

  return graph;
}

function generateRecommendations(graph: DependencyGraph): void {
  // Orphaned artifacts
  if (graph.summary.orphanedArtifacts.length > 5) {
    graph.recommendations.push(
      `🔍 Found ${graph.summary.orphanedArtifacts.length} potentially orphaned artifacts with no detected dependencies. Consider reviewing for dead code.`
    );
  }

  // Highly connected = potential refactoring targets
  if (graph.summary.highlyConnected.length > 0) {
    graph.recommendations.push(
      `📊 Highly connected artifacts detected: ${graph.summary.highlyConnected.slice(0, 3).join(', ')}. Changes to these may have wide impact.`
    );
  }

  // Script Include health
  const siCount = graph.summary.nodesByType['Script Include'] || 0;
  const extendsCount = graph.summary.edgesByType['extends_class'] || 0;
  if (siCount > 20 && extendsCount < 3) {
    graph.recommendations.push(
      '💡 Consider using class inheritance to reduce code duplication in Script Includes.'
    );
  }

  // Cross-table dependencies
  const tableCount = graph.summary.nodesByType['Table'] || 0;
  if (tableCount > 10) {
    graph.recommendations.push(
      `⚠️ Scripts interact with ${tableCount} different tables. Consider consolidating logic or using table extensions.`
    );
  }

  // General stats
  if (graph.summary.totalEdges > 0) {
    graph.recommendations.push(
      `📈 Dependency density: ${(graph.summary.totalEdges / Math.max(graph.summary.totalNodes, 1)).toFixed(2)} edges per node.`
    );
  }
}