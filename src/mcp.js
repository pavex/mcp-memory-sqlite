#!/usr/bin/env node
/**
 * mcp-memory-sqlite — Entry Point
 *
 * Usage:
 *   node src/mcp.js [name_or_path]
 *
 *   name_or_path:
 *     - omitted            → .storage/memory.db  (next to mcp.js)
 *     - plain name         → .storage/<n>.db
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

// --- DB shutdown helper ---
// Po každém tool callu zapíšeme WAL do hlavního .db souboru a ořežeme ho.
// Tím zůstane na disku vždy čistý .db bez -wal a -shm souborů.
function checkpoint() {
  try {
    store.db.pragma('wal_checkpoint(TRUNCATE)');
  } catch { /* neblokovat server */ }
}

function shutdown() {
  try {
    store.db.pragma('wal_checkpoint(TRUNCATE)');
    store.db.close();
  } catch { /* ignorovat chyby při ukončení */ }
}

// Zavřít DB při všech standardních ukončeních procesu
process.on('exit',    shutdown);
process.on('SIGINT',  () => { shutdown(); process.exit(0); });
process.on('SIGTERM', () => { shutdown(); process.exit(0); });

// --- register tools & start ---
const server = new McpStdioServer('mcp-memory-sqlite', '0.1.0', {
  onAfterCall: checkpoint,
});

for (const tool of Object.values(tools)) {
  server.tool(tool.name, tool.description, tool.inputSchema, handlers[tool.name]);
}

server.start();
