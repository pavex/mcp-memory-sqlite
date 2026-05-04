#!/usr/bin/env node

/**
 * stats.js — Memory Stats CLI
 *
 * Displays a visual overview of the memory database directly in the terminal.
 * Uses the same DB path resolution as mcp.js (via Config.js).
 *
 * Usage — identical to mcp.js:
 *   node dist/stats.js                  → .var/memory.db (default)
 *   node dist/stats.js work             → .var/work.db
 *   node dist/stats.js /abs/path/to.db  → direct path
 */

import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { Config } from '../Config.js';
import { SqliteNativeBinding } from '../Datastore/SqliteNativeBinding.js';

// ── Open DB ──────────────────────────────────────────────────────────────────

if (!existsSync(Config.DB_PATH)) {
  console.error(`ERROR: Database not found: ${Config.DB_PATH}`);
  process.exit(1);
}

const db = new Database(Config.DB_PATH, { ...SqliteNativeBinding.options(), readonly: true });

// ── Queries ──────────────────────────────────────────────────────────────────

const total = db.prepare('SELECT COUNT(*) AS n FROM memories').get().n;

const topics = db.prepare(`
  SELECT
    topic,
    COUNT(*)        AS count,
    AVG(importance) AS avg_imp,
    MAX(updated_at) AS last_active,
    GROUP_CONCAT(keywords, ' ') AS all_keywords
  FROM memories
  GROUP BY topic
  ORDER BY count DESC
`).all();

const noKeywords = db.prepare(
  "SELECT COUNT(*) AS n FROM memories WHERE TRIM(keywords) = ''"
).get().n;

const lowImportance = db.prepare(
  'SELECT COUNT(*) AS n FROM memories WHERE importance = 1'
).get().n;

db.close();

// ── Helpers ──────────────────────────────────────────────────────────────────

const W        = process.stdout.columns || 80;
const BAR_MAX  = Math.max(20, W - 52);
const maxCount = Math.max(...topics.map(t => t.count));

const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';

function color(avg_imp) {
  if (avg_imp >= 4.5) return RED;
  if (avg_imp >= 3.5) return YELLOW;
  return GREEN;
}

function bar(count) {
  const filled = Math.round((count / maxCount) * BAR_MAX);
  return '█'.repeat(filled) + '░'.repeat(BAR_MAX - filled);
}

function relativeDate(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

function topKeywords(raw, n = 8) {
  if (!raw) return '';
  const freq = {};
  raw.split(/[,;\s]+/).map(k => k.trim().toLowerCase()).filter(Boolean).forEach(k => {
    freq[k] = (freq[k] || 0) + 1;
  });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k)
    .join(', ');
}

// ── Output ───────────────────────────────────────────────────────────────────

console.log();
console.log(`${BOLD}=== MEMORY STATS ===${RESET}  ${CYAN}${total} records · ${topics.length} topics${RESET}  ${DIM}${Config.DB_PATH}${RESET}`);
console.log('─'.repeat(W));

for (const t of topics) {
  const c     = color(t.avg_imp);
  const label = t.topic.substring(0, 16).padEnd(17);
  const imp   = t.avg_imp.toFixed(1).padStart(3);
  const cnt   = String(t.count).padStart(3);
  const date  = relativeDate(t.last_active).padEnd(10);
  const kws   = topKeywords(t.all_keywords);

  console.log(`${c}${label}${RESET} ${c}${bar(t.count)}${RESET} ${cnt}  imp:${imp}  ${DIM}${date}${RESET}`);
  if (kws) {
    console.log(`${''.padEnd(17)} ${DIM}↳ ${kws}${RESET}`);
  }
}

console.log('─'.repeat(W));

const warnings = [];
if (noKeywords > 0)    warnings.push(`${YELLOW}⚠  ${noKeywords} records without keywords${RESET}`);
if (lowImportance > 0) warnings.push(`${YELLOW}⚠  ${lowImportance} records with importance=1 (deletion candidates)${RESET}`);

if (warnings.length === 0) {
  console.log(`${GREEN}✓  Memory looks healthy${RESET}`);
} else {
  warnings.forEach(w => console.log(w));
}

console.log('─'.repeat(W));
console.log();
