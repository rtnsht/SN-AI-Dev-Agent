/**
 * Context Gatherer
 * Pulls existing context from ServiceNow instance for brownfield analysis
 * Gathers schema, existing code, business rules, and related artifacts
 */

import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';
import fs from 'fs';
import path from 'path';

export class ContextGatherer {
  constructor(snClient) {
    this.client = snClient;
    this.context = {
      tables: [],
      fields: {},
      businessRules: [],
      scriptIncludes: [],
      clientScripts: [],
      uiPolicies: [],
      acls: [],
      flows: [],
      choices: {},
      relationships: []
    };
  }

  /**
   * Gather all context for a given scope/table
   */
  async gatherContext(options = {}) {
    const { 
      tables = [],           // Specific tables to analyze
      scope = 'global',      // Application scope
      includeOOTB = false,   // Include out-of-box artifacts
      depth = 'full'         // 'minimal', 'standard', 'full'
    } = options;

    logger.step(1, 6, 'Gathering table definitions...');
    await this.gatherTables(tables, scope);

    logger.step(2, 6, 'Gathering field definitions...');
    await this.gatherFields();

    logger.step(3, 6, 'Gathering business rules...');
    await this.gatherBusinessRules(scope, includeOOTB);

    logger.step(4, 6, 'Gathering script includes...');
    await this.gatherScriptIncludes(scope, includeOOTB);

    if (depth === 'full') {
      logger.step(5, 6, 'Gathering client scripts & UI policies...');
      await this.gatherClientSideArtifacts(scope, includeOOTB);

      logger.step(6, 6, 'Gathering ACLs and security...');
      await this.gatherSecurityArtifacts(scope);
    }

    logger.success('Context gathering complete');
    return this.context;
  }

  async gatherTables(tableNames, scope) {
    let query = 'super_class!=NULL';
    
    if (tableNames.length > 0) {
      query = `nameIN${tableNames.join(',')}`;
    } else if (scope !== 'global') {
      query = `sys_scope.scope=${scope}`;
    }

    this.context.tables = await this.client.getRecords(
      'sys_db_object',
      query,
      ['name', 'label', 'super_class', 'sys_scope', 'is_extendable', 'sys_id'],
      config.get('context.max_records', 100)
    );

    logger.info(`Found ${this.context.tables.length} tables`);
    return this.context.tables;
  }

  async gatherFields() {
    for (const table of this.context.tables) {
      const fields = await this.client.getRecords(
        'sys_dictionary',
        `name=${table.name}^elementISNOTEMPTY`,
        ['element', 'column_label', 'internal_type', 'max_length', 'mandatory', 
         'reference', 'default_value', 'choice', 'sys_id'],
        500
      );
      
      this.context.fields[table.name] = fields;
      logger.debug(`  ${table.name}: ${fields.length} fields`);
    }
    return this.context.fields;
  }

  async gatherBusinessRules(scope, includeOOTB) {
    let query = 'active=true';
    if (!includeOOTB) {
      query += '^sys_policy=';  // Exclude protected OOTB rules
    }

    const tableNames = this.context.tables.map(t => t.name);
    if (tableNames.length > 0) {
      query += `^collectionIN${tableNames.join(',')}`;
    }

    this.context.businessRules = await this.client.getRecords(
      'sys_script',
      query,
      ['name', 'collection', 'when', 'order', 'script', 'condition', 
       'filter_condition', 'action_insert', 'action_update', 'action_delete', 
       'action_query', 'sys_id'],
      config.get('context.max_records', 100)
    );

    logger.info(`Found ${this.context.businessRules.length} business rules`);
    return this.context.businessRules;
  }

  async gatherScriptIncludes(scope, includeOOTB) {
    let query = 'active=true';
    if (scope !== 'global') {
      query += `^sys_scope.scope=${scope}`;
    }

    this.context.scriptIncludes = await this.client.getRecords(
      'sys_script_include',
      query,
      ['name', 'api_name', 'script', 'client_callable', 'access', 'sys_id'],
      config.get('context.max_records', 100)
    );

    logger.info(`Found ${this.context.scriptIncludes.length} script includes`);
    return this.context.scriptIncludes;
  }

  async gatherClientSideArtifacts(scope, includeOOTB) {
    const tableNames = this.context.tables.map(t => t.name);
    let tableQuery = tableNames.length > 0 ? `^tableIN${tableNames.join(',')}` : '';

    // Client Scripts
    this.context.clientScripts = await this.client.getRecords(
      'sys_script_client',
      `active=true${tableQuery}`,
      ['name', 'table', 'type', 'script', 'field', 'sys_id'],
      config.get('context.max_records', 100)
    );

    // UI Policies
    this.context.uiPolicies = await this.client.getRecords(
      'sys_ui_policy',
      `active=true${tableQuery}`,
      ['short_description', 'table', 'conditions', 'on_load', 'reverse_if_false', 'sys_id'],
      config.get('context.max_records', 100)
    );

    logger.info(`Found ${this.context.clientScripts.length} client scripts`);
    logger.info(`Found ${this.context.uiPolicies.length} UI policies`);
  }

  async gatherSecurityArtifacts(scope) {
    const tableNames = this.context.tables.map(t => t.name);
    if (tableNames.length === 0) return;

    this.context.acls = await this.client.getRecords(
      'sys_security_acl',
      `active=true^nameIN${tableNames.join(',')}`,
      ['name', 'operation', 'script', 'condition', 'role', 'sys_id'],
      config.get('context.max_records', 100)
    );

    logger.info(`Found ${this.context.acls.length} ACLs`);
  }

  // Export context to JSON file for reference
  async exportContext(outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(this.context, null, 2));
    logger.success(`Context exported to ${outputPath}`);
  }

  // Get summary of gathered context
  getSummary() {
    return {
      tables: this.context.tables.length,
      fields: Object.values(this.context.fields).reduce((a, b) => a + b.length, 0),
      businessRules: this.context.businessRules.length,
      scriptIncludes: this.context.scriptIncludes.length,
      clientScripts: this.context.clientScripts.length,
      uiPolicies: this.context.uiPolicies.length,
      acls: this.context.acls.length
    };
  }
}

export default ContextGatherer;

