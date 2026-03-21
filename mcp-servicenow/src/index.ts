#!/usr/bin/env node
/**
 * MCP ServiceNow Server
 * Main entry point for the Model Context Protocol server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as dotenv from 'dotenv';

import { ServiceNowClient } from './client/sn-client.js';
import { ALL_TOOLS } from './tool-definitions.js';
import { executeToolCall } from './tool-registry.js';
import type { SNAuthType } from './types/index.js';

// Load environment variables
dotenv.config();

// Initialize ServiceNow client
function createClient(): ServiceNowClient {
  const instanceUrl = process.env.SN_INSTANCE_URL;
  const username = process.env.SN_USERNAME;
  const password = process.env.SN_PASSWORD;
  const authType = (process.env.SN_AUTH_TYPE as SNAuthType | undefined) || 'basic';
  const clientId = process.env.SN_CLIENT_ID;
  const clientSecret = process.env.SN_CLIENT_SECRET;
  const accessToken = process.env.SN_ACCESS_TOKEN;
  const refreshToken = process.env.SN_REFRESH_TOKEN;

  if (!instanceUrl) {
    throw new Error('Missing required environment variable: SN_INSTANCE_URL');
  }

  if (authType === 'basic') {
    if (!username || !password) {
      throw new Error('Missing required environment variables for basic auth: SN_INSTANCE_URL, SN_USERNAME, SN_PASSWORD');
    }

    return new ServiceNowClient({
      instanceUrl,
      username,
      password,
      authType,
      defaultScope: process.env.SN_DEFAULT_SCOPE || 'global'
    });
  }

  if (authType === 'oauth_client_credentials') {
    if (!clientId || !clientSecret) {
      throw new Error('Missing required environment variables for oauth_client_credentials: SN_CLIENT_ID, SN_CLIENT_SECRET');
    }

    return new ServiceNowClient({
      instanceUrl,
      authType,
      clientId,
      clientSecret,
      username,
      password,
      defaultScope: process.env.SN_DEFAULT_SCOPE || 'global'
    });
  }

  if (authType === 'bearer' || authType === 'oauth_authorization_code') {
    if (!accessToken && !refreshToken) {
      throw new Error(`Missing required environment variables for ${authType}: SN_ACCESS_TOKEN or SN_REFRESH_TOKEN`);
    }

    return new ServiceNowClient({
      instanceUrl,
      authType,
      username,
      accessToken,
      refreshToken,
      clientId,
      clientSecret,
      defaultScope: process.env.SN_DEFAULT_SCOPE || 'global'
    });
  }

  throw new Error(`Unsupported SN_AUTH_TYPE: ${authType}`);
}

// Create the MCP server
const server = new Server(
  { name: 'mcp-servicenow', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

let client: ServiceNowClient | null = null;

function getClient(): ServiceNowClient {
  if (!client) {
    client = createClient();
  }
  return client;
}

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: ALL_TOOLS };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const snClient = getClient();

  try {
    const result = await executeToolCall(name, args, snClient);

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, error: errorMessage }, null, 2) }],
      isError: true
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP ServiceNow server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

