/**
 * Connection and Instance Tools
 * Tools for testing connection and getting instance information
 */

import { z } from 'zod';
import { ServiceNowClient } from '../client/sn-client.js';
import { getHelperApisSetup } from '../deployer/HelperApisSetup.js';

// Tool schemas
export const testConnectionSchema = z.object({});

export const getInstanceInfoSchema = z.object({});

export const initializeInstanceSchema = z.object({
  deployMissingApis: z.boolean().optional().default(true)
    .describe('Deploy missing helper APIs to the instance')
});

export const getTablesSchema = z.object({
  query: z.string().optional().describe('Optional query filter for tables (e.g., "nameSTARTSWITHincident")'),
  limit: z.number().optional().default(50).describe('Maximum number of tables to return')
});

export const getTableSchemaInputSchema = z.object({
  table: z.string().describe('The table name to get schema for (e.g., "incident")')
});

// Tool implementations
export async function testConnection(client: ServiceNowClient) {
  const result = await client.testConnection();

  // Auto-initialize helper APIs on successful connection
  if (result.success && !client.helperApisInitialized) {
    try {
      const helperSetup = getHelperApisSetup(client);
      const status = await helperSetup.initializeHelperApis();

      // Store paths in client for future use
      if (status.apis.uiPolicyActionHelper.basePath) {
        client.setHelperApiPath('uiPolicyActionHelper', status.apis.uiPolicyActionHelper.basePath);
      }
      if (status.apis.updateSetHelper.basePath) {
        client.setHelperApiPath('updateSetHelper', status.apis.updateSetHelper.basePath);
      }
      if (status.apis.addToUpdateSetHelper.basePath) {
        client.setHelperApiPath('addToUpdateSetHelper', status.apis.addToUpdateSetHelper.basePath);
      }

      client.helperApisInitialized = true;

      // Add helper API info to the result
      return {
        ...result,
        helperApis: {
          uiPolicyActionHelper: {
            deployed: status.apis.uiPolicyActionHelper.deployed,
            path: status.apis.uiPolicyActionHelper.basePath
          },
          updateSetHelper: {
            deployed: status.apis.updateSetHelper.deployed,
            path: status.apis.updateSetHelper.basePath
          },
          addToUpdateSetHelper: {
            deployed: status.apis.addToUpdateSetHelper.deployed,
            path: status.apis.addToUpdateSetHelper.basePath
          }
        }
      };
    } catch (error) {
      // Don't fail the connection test if helper API setup fails
      console.warn('[testConnection] Helper API initialization warning:', error);
      return {
        ...result,
        helperApisWarning: `Helper APIs could not be initialized: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  return result;
}

export async function getInstanceInfo(client: ServiceNowClient) {
  const connectionTest = await client.testConnection();
  
  if (!connectionTest.success) {
    return connectionTest;
  }
  
  const currentUser = await client.getCurrentUser();
  
  return {
    success: true,
    instanceUrl: client.instanceUrl,
    currentUser: currentUser ? {
      user_name: currentUser.user_name,
      name: currentUser.name,
      email: currentUser.email
    } : null
  };
}

export async function getTables(client: ServiceNowClient, input: z.infer<typeof getTablesSchema>) {
  const tables = await client.getTables(input.query);
  
  return {
    success: true,
    count: tables.length,
    tables: tables.slice(0, input.limit).map(t => ({
      name: t.name,
      label: t.label,
      scope: t.sys_scope,
      extendable: t.is_extendable
    }))
  };
}

export async function getTableSchema(client: ServiceNowClient, input: z.infer<typeof getTableSchemaInputSchema>) {
  const fields = await client.getTableSchema(input.table);
  
  return {
    success: true,
    table: input.table,
    fieldCount: fields.length,
    fields: fields.map(f => ({
      name: f.element,
      label: f.column_label,
      type: f.internal_type,
      maxLength: f.max_length,
      mandatory: f.mandatory === 'true' || f.mandatory === true,
      reference: f.reference || null
    }))
  };
}

/**
 * Initialize the ServiceNow instance with required helper APIs
 * This should be called when connecting to a new instance
 *
 * Deploys:
 * - UIPolicyActionHelper API (for creating UI Policy Actions with proper references)
 * - UpdateSetHelper API (for update set capture)
 */
export async function initializeInstance(
  client: ServiceNowClient,
  input: z.infer<typeof initializeInstanceSchema>
) {
  // First test connection
  const connectionTest = await client.testConnection();
  if (!connectionTest.success) {
    return {
      success: false,
      message: connectionTest.message,
      helperApis: null
    };
  }

  // Skip if already initialized
  if (client.helperApisInitialized) {
    const uiPolicyPath = client.getHelperApiPath('uiPolicyActionHelper');
    const updateSetPath = client.getHelperApiPath('updateSetHelper');
    const addToUpdateSetPath = client.getHelperApiPath('addToUpdateSetHelper');
    return {
      success: true,
      message: 'Instance already initialized',
      instanceUrl: client.instanceUrl,
      helperApis: {
        uiPolicyActionHelper: { path: uiPolicyPath, deployed: !!uiPolicyPath },
        updateSetHelper: { path: updateSetPath, deployed: !!updateSetPath },
        addToUpdateSetHelper: { path: addToUpdateSetPath, deployed: !!addToUpdateSetPath }
      }
    };
  }

  // Initialize helper APIs
  const helperSetup = getHelperApisSetup(client);

  try {
    const status = await helperSetup.initializeHelperApis();

    // Store paths in client for future use
    if (status.apis.uiPolicyActionHelper.basePath) {
      client.setHelperApiPath('uiPolicyActionHelper', status.apis.uiPolicyActionHelper.basePath);
    }
    if (status.apis.updateSetHelper.basePath) {
      client.setHelperApiPath('updateSetHelper', status.apis.updateSetHelper.basePath);
    }
    if (status.apis.addToUpdateSetHelper.basePath) {
      client.setHelperApiPath('addToUpdateSetHelper', status.apis.addToUpdateSetHelper.basePath);
    }

    client.helperApisInitialized = true;

    return {
      success: true,
      message: 'Instance initialized successfully',
      instanceUrl: client.instanceUrl,
      helperApis: {
        uiPolicyActionHelper: {
          deployed: status.apis.uiPolicyActionHelper.deployed,
          path: status.apis.uiPolicyActionHelper.basePath
        },
        updateSetHelper: {
          deployed: status.apis.updateSetHelper.deployed,
          path: status.apis.updateSetHelper.basePath
        },
        addToUpdateSetHelper: {
          deployed: status.apis.addToUpdateSetHelper.deployed,
          path: status.apis.addToUpdateSetHelper.basePath
        }
      }
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to initialize helper APIs: ${error instanceof Error ? error.message : String(error)}`,
      helperApis: null
    };
  }
}
