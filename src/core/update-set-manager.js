/**
 * Update Set Manager
 * Creates and manages ServiceNow Update Sets
 * Packages artifacts for deployment
 */

import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import xml2js from 'xml2js';

export class UpdateSetManager {
  constructor(snClient) {
    this.client = snClient;
    this.updateSet = null;
    this.customerUpdates = [];
  }

  /**
   * Create a new Update Set in ServiceNow
   */
  async createUpdateSet(name, description = '') {
    const updateSetName = name || this.generateUpdateSetName();
    
    logger.info(`Creating Update Set: ${updateSetName}`);
    
    try {
      // Create update set via REST API
      const response = await this.client.createRecord('sys_update_set', {
        name: updateSetName,
        description: description,
        state: 'in progress',
        application: config.get('development.default_scope', 'global')
      });

      this.updateSet = {
        sysId: response.sys_id,
        name: updateSetName,
        description,
        state: 'in progress',
        createdAt: new Date().toISOString()
      };

      logger.success(`Update Set created: ${updateSetName} (${this.updateSet.sysId})`);
      return this.updateSet;
    } catch (error) {
      logger.error('Failed to create Update Set', error);
      throw error;
    }
  }

  /**
   * Set as current update set for the session
   */
  async setAsCurrent() {
    if (!this.updateSet) {
      throw new Error('No update set created. Call createUpdateSet first.');
    }

    try {
      // Set current update set via user preference
      await this.client.post('/api/now/ui/user_preference', {
        name: 'sys_update_set',
        value: this.updateSet.sysId
      });

      logger.success(`Set ${this.updateSet.name} as current update set`);
      return true;
    } catch (error) {
      logger.warn('Could not set current update set via API (may require UI)', error);
      return false;
    }
  }

  generateUpdateSetName() {
    const prefix = config.get('development.update_set_prefix', 'AI_DEV') || 'AI_DEV';
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const id = uuidv4().substring(0, 8).toUpperCase();
    return `${prefix}_${date}_${id}`;
  }

  /**
   * Add an artifact to the update set
   */
  async addArtifact(artifact) {
    if (!this.updateSet) {
      throw new Error('No update set created. Call createUpdateSet first.');
    }

    const customerUpdate = this.createCustomerUpdate(artifact);
    this.customerUpdates.push(customerUpdate);
    
    return customerUpdate;
  }

  createCustomerUpdate(artifact) {
    const tableMapping = {
      'script_include': 'sys_script_include',
      'business_rule': 'sys_script',
      'client_script': 'sys_script_client',
      'ui_policy': 'sys_ui_policy',
      'ui_action': 'sys_ui_action',
      'scheduled_job': 'sysauto_script',
      'flow': 'sys_hub_flow',
      'acl': 'sys_security_acl'
    };

    return {
      name: artifact.name,
      type: artifact.type,
      table: tableMapping[artifact.type] || artifact.table,
      targetName: `${tableMapping[artifact.type]}_${artifact.sysId}`,
      action: 'INSERT_OR_UPDATE',
      payload: this.buildPayload(artifact),
      sysId: artifact.sysId
    };
  }

  buildPayload(artifact) {
    const basePayload = {
      sys_id: artifact.sysId,
      name: artifact.name,
      active: artifact.active !== false
    };

    switch (artifact.type) {
      case 'script_include':
        return { ...basePayload, script: artifact.script, 
                 api_name: artifact.apiName, client_callable: artifact.clientCallable };
      case 'business_rule':
        return { ...basePayload, script: artifact.script, collection: artifact.collection,
                 when: artifact.when, order: artifact.order, action_insert: artifact.actionInsert,
                 action_update: artifact.actionUpdate, action_delete: artifact.actionDelete };
      case 'client_script':
        return { ...basePayload, script: artifact.script, table: artifact.table,
                 type: artifact.scriptType, ui_type: artifact.uiType };
      default:
        return { ...basePayload, ...artifact };
    }
  }

  /**
   * Deploy artifacts to ServiceNow instance
   */
  async deployArtifacts(artifacts) {
    logger.info(`Deploying ${artifacts.length} artifacts...`);
    const results = [];

    for (const artifact of artifacts) {
      try {
        await this.addArtifact(artifact);
        const result = await this.deployArtifact(artifact);
        results.push({ artifact: artifact.name, success: true, sysId: result.sys_id });
        logger.success(`  Deployed: ${artifact.name}`);
      } catch (error) {
        results.push({ artifact: artifact.name, success: false, error: error.message });
        logger.error(`  Failed: ${artifact.name} - ${error.message}`);
      }
    }

    return results;
  }

  async deployArtifact(artifact) {
    const table = this.createCustomerUpdate(artifact).table;
    const payload = this.buildPayload(artifact);

    // Try to update existing, or create new
    try {
      const existing = await this.client.getRecords(table, `name=${artifact.name}`, ['sys_id'], 1);
      if (existing.length > 0) {
        return await this.client.updateRecord(table, existing[0].sys_id, payload);
      }
    } catch (e) { /* Continue to create */ }

    return await this.client.createRecord(table, payload);
  }

  /**
   * Complete the update set
   */
  async complete() {
    if (!this.updateSet) throw new Error('No update set to complete');

    await this.client.updateRecord('sys_update_set', this.updateSet.sysId, { state: 'complete' });
    this.updateSet.state = 'complete';
    logger.success(`Update Set ${this.updateSet.name} marked as complete`);
    return this.updateSet;
  }

  /**
   * Export update set to XML file
   */
  async exportToXML(outputPath) {
    const xml = await this.buildUpdateSetXML();
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, xml);
    logger.success(`Update Set exported to ${outputPath}`);
    return outputPath;
  }

  async buildUpdateSetXML() {
    const builder = new xml2js.Builder({ rootName: 'unload', headless: false });
    const xmlObj = { sys_update_set: { name: this.updateSet?.name || 'AI_DEV_UpdateSet',
        description: this.updateSet?.description || '', state: 'complete' },
      sys_update_xml: this.customerUpdates.map(cu => ({ name: cu.targetName,
        action: cu.action, type: cu.table, payload: JSON.stringify(cu.payload) })) };
    return builder.buildObject(xmlObj);
  }

  getSummary() {
    return { updateSet: this.updateSet, artifactCount: this.customerUpdates.length,
      artifacts: this.customerUpdates.map(cu => ({ name: cu.name, type: cu.type, table: cu.table })) };
  }
}

export default UpdateSetManager;

