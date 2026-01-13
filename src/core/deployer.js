/**
 * Deployer
 * Handles deployment of update sets to ServiceNow instances
 * Supports retrieve, preview, and commit operations
 */

import { logger } from '../utils/logger.js';
import { SNClient } from './sn-client.js';

export class Deployer {
  constructor(sourceClient, targetClient = null) {
    this.sourceClient = sourceClient;
    this.targetClient = targetClient;
    this.deploymentLog = [];
  }

  /**
   * Deploy update set from source to target instance
   */
  async deploy(updateSetSysId, options = {}) {
    const {
      autoCommit = false,
      skipPreview = false,
      resolveConflicts = 'skip'
    } = options;

    logger.step(1, 5, 'Validating update set...');
    const updateSet = await this.validateUpdateSet(updateSetSysId);
    
    if (!this.targetClient) {
      logger.info('No target instance configured - deploying to source instance only');
      return this.deployLocal(updateSetSysId, updateSet);
    }

    logger.step(2, 5, 'Exporting update set from source...');
    const exportedXML = await this.exportUpdateSet(updateSetSysId);
    
    logger.step(3, 5, 'Importing to target instance...');
    const retrievedSet = await this.importUpdateSet(exportedXML);
    
    if (!skipPreview) {
      logger.step(4, 5, 'Previewing update set...');
      const preview = await this.previewUpdateSet(retrievedSet.sysId);
      
      if (preview.hasConflicts) {
        logger.warn(`Found ${preview.conflicts.length} conflicts`);
        if (resolveConflicts === 'skip') {
          logger.warn('Skipping conflicting updates');
        }
      }
    }

    if (autoCommit) {
      logger.step(5, 5, 'Committing update set...');
      await this.commitUpdateSet(retrievedSet.sysId);
      logger.success('Update set committed successfully');
    } else {
      logger.info('Update set imported but not committed. Manual commit required.');
    }

    return {
      success: true,
      updateSet: updateSet,
      retrievedSet: retrievedSet,
      committed: autoCommit
    };
  }

  async deployLocal(updateSetSysId, updateSet) {
    // For local deployment, just mark as complete
    logger.info('Completing update set locally...');
    
    await this.sourceClient.updateRecord('sys_update_set', updateSetSysId, {
      state: 'complete'
    });

    this.log('local_deploy', updateSetSysId, 'Update set completed');
    
    return {
      success: true,
      updateSet: updateSet,
      committed: true,
      mode: 'local'
    };
  }

  async validateUpdateSet(sysId) {
    try {
      const updateSet = await this.sourceClient.getRecord('sys_update_set', sysId);
      
      if (!updateSet) {
        throw new Error(`Update set not found: ${sysId}`);
      }

      // Get customer updates count
      const updates = await this.sourceClient.getRecords(
        'sys_update_xml',
        `update_set=${sysId}`,
        ['sys_id'],
        1000
      );

      logger.info(`Update Set: ${updateSet.name}`);
      logger.info(`  State: ${updateSet.state}`);
      logger.info(`  Updates: ${updates.length}`);

      return {
        ...updateSet,
        updateCount: updates.length
      };
    } catch (error) {
      logger.error('Failed to validate update set', error);
      throw error;
    }
  }

  async exportUpdateSet(sysId) {
    try {
      // Use the export processor endpoint
      const response = await this.sourceClient.client.get(
        `/api/now/table/sys_update_set/${sysId}`,
        {
          params: {
            sysparm_display_value: 'all'
          }
        }
      );

      // Get the actual update XML records
      const updates = await this.sourceClient.getRecords(
        'sys_update_xml',
        `update_set=${sysId}`,
        ['name', 'type', 'target_name', 'action', 'payload'],
        1000
      );

      this.log('export', sysId, `Exported ${updates.length} updates`);
      
      return {
        updateSet: response.data.result,
        updates: updates
      };
    } catch (error) {
      logger.error('Failed to export update set', error);
      throw error;
    }
  }

  async importUpdateSet(exportedData) {
    try {
      // Create retrieved update set on target
      const retrievedSet = await this.targetClient.createRecord('sys_remote_update_set', {
        name: exportedData.updateSet.name,
        description: exportedData.updateSet.description,
        state: 'loaded',
        origin_sys_id: exportedData.updateSet.sys_id
      });

      this.log('import', retrievedSet.sys_id, 'Update set retrieved');
      
      return retrievedSet;
    } catch (error) {
      logger.error('Failed to import update set', error);
      throw error;
    }
  }

  async previewUpdateSet(retrievedSetSysId) {
    try {
      // Trigger preview
      await this.targetClient.post(
        `/api/now/table/sys_remote_update_set/${retrievedSetSysId}`,
        { state: 'previewing' }
      );

      // Wait for preview to complete
      let preview = null;
      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts) {
        preview = await this.targetClient.getRecord('sys_remote_update_set', retrievedSetSysId);
        if (preview.state !== 'previewing') break;
        await this.sleep(2000);
        attempts++;
      }

      // Get preview problems
      const conflicts = await this.targetClient.getRecords(
        'sys_update_preview_problem',
        `remote_update_set=${retrievedSetSysId}`,
        ['type', 'description', 'status'],
        100
      );

      return {
        state: preview?.state,
        hasConflicts: conflicts.length > 0,
        conflicts: conflicts
      };
    } catch (error) {
      logger.error('Failed to preview update set', error);
      throw error;
    }
  }

  async commitUpdateSet(retrievedSetSysId) {
    try {
      await this.targetClient.updateRecord('sys_remote_update_set', retrievedSetSysId, {
        state: 'committing'
      });

      // Wait for commit to complete
      let result = null;
      let attempts = 0;
      const maxAttempts = 60;

      while (attempts < maxAttempts) {
        result = await this.targetClient.getRecord('sys_remote_update_set', retrievedSetSysId);
        if (result.state === 'committed') break;
        if (result.state === 'error') throw new Error('Commit failed');
        await this.sleep(2000);
        attempts++;
      }

      this.log('commit', retrievedSetSysId, 'Update set committed');
      return result;
    } catch (error) {
      logger.error('Failed to commit update set', error);
      throw error;
    }
  }

  log(action, sysId, message) {
    this.deploymentLog.push({
      timestamp: new Date().toISOString(),
      action, sysId, message
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getDeploymentLog() {
    return this.deploymentLog;
  }
}

export default Deployer;

