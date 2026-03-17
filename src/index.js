#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import path from 'path';
import { JsonDB } from './db/json-db.js';
import { tools } from './tools.js';
import { startUploadServer } from './upload-server.js';

const dataFile = process.env.myparts_DATA ?? `parts.json`;
const db = new JsonDB(dataFile);

const uploadsDir = path.join(path.dirname(path.resolve(dataFile)), 'uploads');
const uploadPort = parseInt(process.env.MYPARTS_UPLOAD_PORT ?? '3456', 10);
startUploadServer(uploadsDir, uploadPort);

const server = new Server(
  { name: 'parts', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

const toolMap = Object.fromEntries(tools.map(t => [t.name, t]));

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = toolMap[name];
  if (!tool) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    };
  }
  try {
    return await tool.handler(db, args ?? {});
  } catch (err) {
    return {
      isError: true,
      content: [{ type: 'text', text: err.message }],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
