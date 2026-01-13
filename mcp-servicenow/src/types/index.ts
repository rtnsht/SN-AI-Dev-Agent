/**
 * TypeScript types for MCP ServiceNow Server
 */

export interface SNConfig {
  instanceUrl: string;
  username: string;
  password: string;
  clientId?: string;
  clientSecret?: string;
  defaultScope?: string;
}

export interface SNRecord {
  sys_id: string;
  [key: string]: unknown;
}

export interface SNQueryParams {
  sysparm_query?: string;
  sysparm_fields?: string;
  sysparm_limit?: number;
  sysparm_offset?: number;
  sysparm_display_value?: 'true' | 'false' | 'all';
  sysparm_exclude_reference_link?: boolean;
}

export interface SNTableSchema {
  name: string;
  label: string;
  fields: SNFieldSchema[];
}

export interface SNFieldSchema {
  element: string;
  column_label: string;
  internal_type: string;
  max_length: number;
  mandatory: boolean;
  reference?: string;
  default_value?: string;
}

export interface SNBusinessRule {
  sys_id: string;
  name: string;
  collection: string;
  when: 'before' | 'after' | 'async' | 'display';
  order: number;
  script: string;
  condition?: string;
  active: boolean;
  action_insert: boolean;
  action_update: boolean;
  action_delete: boolean;
  action_query: boolean;
}

export interface SNScriptInclude {
  sys_id: string;
  name: string;
  api_name: string;
  script: string;
  client_callable: boolean;
  active: boolean;
  access: string;
}

export interface SNClientScript {
  sys_id: string;
  name: string;
  table: string;
  type: 'onLoad' | 'onChange' | 'onSubmit' | 'onCellEdit';
  script: string;
  field?: string;
  active: boolean;
}

export interface SNUpdateSet {
  sys_id: string;
  name: string;
  description: string;
  state: 'in progress' | 'complete' | 'ignore';
  application: string;
}

export interface SNApiResponse<T> {
  result: T;
}

export interface SNErrorResponse {
  error: {
    message: string;
    detail?: string;
  };
  status: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  message?: string;
}

// Tool input schemas
export interface QueryRecordsInput {
  table: string;
  query?: string;
  fields?: string[];
  limit?: number;
}

export interface GetRecordInput {
  table: string;
  sys_id: string;
  fields?: string[];
}

export interface CreateRecordInput {
  table: string;
  data: Record<string, unknown>;
}

export interface UpdateRecordInput {
  table: string;
  sys_id: string;
  data: Record<string, unknown>;
}

export interface CreateBusinessRuleInput {
  name: string;
  table: string;
  when: 'before' | 'after' | 'async' | 'display';
  script: string;
  order?: number;
  condition?: string;
  insert?: boolean;
  update?: boolean;
  delete?: boolean;
  query?: boolean;
  active?: boolean;
}

export interface CreateScriptIncludeInput {
  name: string;
  script: string;
  clientCallable?: boolean;
  active?: boolean;
}

export interface CreateUpdateSetInput {
  name: string;
  description?: string;
}

export interface ExecuteScriptInput {
  script: string;
  scope?: string;
}

