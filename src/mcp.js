#!/usr/bin/env node
/**
 * mcp-memory-sqlite — Entry Point
 *
 * Usage:
 *   node src/mcp.js [name_or_path]
 *
 *   name_or_path:
 *     - omitted            → .storage/memory.db  (next to mcp.js)
 *     - plain name         → .storage/<name>.db
 *     - path with / or \   → used directly (absolute or cwd-relative)
 */

import { resolve, dirname, join } from 'node:path';
import { fileURLToPath }          from 'node:url';
import { existsSync, mkdirSync }  from 'node:fs';

import { openDatabase }   from './db.js';
import { tools }          from './tools.js';
import { createHandlers } from './handlers.js';
import { McpStdioServer } from './server.js';

// --- resolve DB path ---
const __dir = dirname(fileURLToPath(import.meta.url));
const raw   = process.argv[2] ?? 'memory';

let dbPath;
if (raw.includes('/') || raw.includes('\\')) {
  dbPath = resolve(raw);
} else {
  const storageDir = join(__dir, '.storage');
  if (!existsSync(storageDir)) mkdirSync(storageDir, { recursive: true });
  dbPath = join(storageDir, `${raw}.db`);
}

// --- open DB ---
const store    = openDatabase(dbPath);
const handlers = createHandlers(store);

// --- register tools & start ---
const server = new McpStdioServer('mcp-memory-sqlite', '0.1.0');

for (const tool of Object.values(tools)) {
  server.tool(tool.name, tool.description, tool.inputSchema, handlers[tool.name]);
}

server.start();
