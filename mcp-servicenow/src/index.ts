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

// Load environment variables
dotenv.config();

// Initialize ServiceNow client
function createClient(): ServiceNowClient {
  const instanceUrl = process.env.SN_INSTANCE_URL;
  const username = process.env.SN_USERNAME;
  const password = process.env.SN_PASSWORD;

  if (!instanceUrl || !username || !password) {
    throw new Error('Missing required environment variables: SN_INSTANCE_URL, SN_USERNAME, SN_PASSWORD');
  }

  return new ServiceNowClient({
    instanceUrl,
    username,
    password,
    defaultScope: process.env.SN_DEFAULT_SCOPE || 'global'
  });
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

