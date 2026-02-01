#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join, resolve } from 'path';

import { BridgeDatabase } from './database.js';
import { createArchitectTools } from './tools/architect.js';
import { createExecutorTools } from './tools/executor.js';
import { createSharedTools } from './tools/shared.js';
import type { ServerMode, AgentRole } from './types.js';

// Determine mode from environment variable or command line
function getMode(): ServerMode {
  // Priority 1: Command line argument
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg.startsWith('--mode=')) {
      const modeValue = arg.split('=')[1];
      if (['architect', 'executor', 'full'].includes(modeValue)) {
        return modeValue as ServerMode;
      }
    }
  }

  // Priority 2: Environment variable (CLAUDE_BRIDGE_MODE)
  const envMode = process.env.CLAUDE_BRIDGE_MODE?.toLowerCase();
  if (envMode && ['architect', 'executor', 'full'].includes(envMode)) {
    return envMode as ServerMode;
  }

  // Priority 3: Default to 'full'
  return 'full';
}

// Parse command line arguments and environment
function parseArgs(): { mode: ServerMode; dbPath: string; projectPath: string } {
  const args = process.argv.slice(2);
  const mode = getMode();
  let dbPath: string | null = null;
  let projectPath: string = process.cwd();

  for (const arg of args) {
    if (arg.startsWith('--db=')) {
      dbPath = arg.split('=')[1];
    } else if (arg.startsWith('--project=')) {
      projectPath = arg.split('=')[1];
    }
  }

  // Resolve project path
  projectPath = resolve(projectPath);

  // Default database path: .claude-bridge/bridge.db in the project directory
  if (!dbPath) {
    dbPath = join(projectPath, '.claude-bridge', 'bridge.db');
  } else if (!dbPath.includes(':') && !dbPath.startsWith('/') && !dbPath.startsWith('\\')) {
    // Relative path - make it relative to project
    dbPath = join(projectPath, dbPath);
  }

  return { mode, dbPath, projectPath };
}

// Get agent role from mode
function getAgentRole(mode: ServerMode): AgentRole {
  if (mode === 'architect') return 'architect';
  if (mode === 'executor') return 'executor';
  return 'architect'; // Default for 'full' mode
}

// Build tools based on mode
function buildTools(
  db: BridgeDatabase,
  mode: ServerMode
): Record<string, { description: string; inputSchema: object; handler: (params: unknown) => unknown }> {
  const agentRole = getAgentRole(mode);
  const tools: Record<string, { description: string; inputSchema: object; handler: (params: unknown) => unknown }> = {};

  // Add shared tools for all modes
  const sharedTools = createSharedTools(db, agentRole);
  Object.assign(tools, sharedTools);

  // Add role-specific tools
  if (mode === 'architect' || mode === 'full') {
    const architectTools = createArchitectTools(db);
    Object.assign(tools, architectTools);
  }

  if (mode === 'executor' || mode === 'full') {
    const executorTools = createExecutorTools(db);
    Object.assign(tools, executorTools);
  }

  return tools;
}

async function main() {
  const { mode, dbPath, projectPath } = parseArgs();

  // Ensure the .claude-bridge directory exists in the project
  const dbDir = dirname(dbPath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  // Initialize database with project path for session tracking
  const db = new BridgeDatabase(dbPath, projectPath);

  // Build tools for this mode
  const tools = buildTools(db, mode);

  // Create MCP server
  const server = new Server(
    {
      name: `claude-bridge-${mode}`,
      version: '1.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: Object.entries(tools).map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const tool = tools[name];
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    try {
      const result = tool.handler(args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: message }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  // Handle process termination
  process.on('SIGINT', () => {
    db.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    db.close();
    process.exit(0);
  });

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log startup (to stderr so it doesn't interfere with MCP protocol)
  const modeSource = process.argv.slice(2).some(a => a.startsWith('--mode='))
    ? 'flag'
    : process.env.CLAUDE_BRIDGE_MODE
      ? 'env:CLAUDE_BRIDGE_MODE'
      : 'default';
  console.error(`Claude Bridge MCP Server v1.1.0 started`);
  console.error(`  Mode: ${mode} (from ${modeSource})`);
  console.error(`  Project: ${projectPath}`);
  console.error(`  Database: ${dbPath}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
