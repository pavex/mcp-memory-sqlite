import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { InstallerDatastore } from './Datastore/InstallerDatastore.js';
import { MemoryDatastore } from './Datastore/MemoryDatastore.js';
import { ToolDefinitions } from './Tools/ToolDefinitions.js';
import { Config } from './Config.js';

new InstallerDatastore(Config.DB_PATH);
const repo = new MemoryDatastore(Config.DB_PATH);
const context = { repo };

const server = new Server(
  { name: Config.MCP_SERVER_NAME, version: Config.MCP_SERVER_VERSION },
  { capabilities: { tools: {} } }
);

const handlers = new Map(ToolDefinitions.map(t => [t.name, t.handler]));

import { zodToJsonSchema } from 'zod-to-json-schema';
// ...
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ToolDefinitions.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: zodToJsonSchema(t.inputSchema)
  }))
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const handler = handlers.get(name);
  if (!handler) return { content: [{ type: 'text', text: `Error: Unknown tool ${name}` }], isError: true };

  try {
    const result = await handler(args, context);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (e) {
    return {
      content: [{ type: 'text', text: e instanceof z.ZodError ? `Validation Error: ${e.message}` : `Error: ${e.message}` }],
      isError: true
    };
  }
});

await server.connect(new StdioServerTransport());
