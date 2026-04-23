import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// --- Resolution logic ------------------------------------------------------

const arg = process.argv[2];
let dbPath = path.join(rootDir, '.var/memory.db');

if (arg) {
  // If it contains a slash, treat as direct path
  if (arg.includes('/') || arg.includes('\\')) {
    dbPath = path.isAbsolute(arg) ? arg : path.resolve(process.cwd(), arg);
  } else {
    // Treat as simple name for .var/
    dbPath = path.join(rootDir, `.var/${arg.endsWith('.db') ? arg : arg + '.db'}`);
  }
}

// ---------------------------------------------------------------------------

export const Config = {
  DB_PATH: dbPath,
  MCP_SERVER_NAME: 'mcp-memory-sqlite',
  MCP_SERVER_VERSION: '0.1.0'
};
