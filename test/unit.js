import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { InstallerDatastore } from '../src/Datastore/InstallerDatastore.js';
import { MemoryDatastore } from '../src/Datastore/MemoryDatastore.js';
import { ToolDefinitions } from '../src/Tools/ToolDefinitions.js';

// ---------------------------------------------------------------------------
// Helper: in-memory repo with schema created manually (no InstallerDatastore)
// ---------------------------------------------------------------------------

function makeRepo() {
  const repo = new MemoryDatastore(':memory:');
  repo.db.exec(`
    CREATE TABLE memories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      topic       TEXT    NOT NULL DEFAULT 'general',
      content     TEXT    NOT NULL,
      keywords    TEXT    NOT NULL DEFAULT '',
      importance  INTEGER NOT NULL DEFAULT 3,
      created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );
    CREATE VIRTUAL TABLE memories_fts
      USING fts5(content, topic, keywords, content='memories', content_rowid='id');
    CREATE TRIGGER tr_fts_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content, topic, keywords)
        VALUES (new.id, new.content, new.topic, new.keywords);
    END;
    CREATE TRIGGER tr_fts_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, topic, keywords)
        VALUES ('delete', old.id, old.content, old.topic, old.keywords);
      INSERT INTO memories_fts(rowid, content, topic, keywords)
        VALUES (new.id, new.content, new.topic, new.keywords);
    END;
    CREATE TRIGGER tr_fts_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, topic, keywords)
        VALUES ('delete', old.id, old.content, old.topic, old.keywords);
    END;
  `);
  return repo;
}

// ---------------------------------------------------------------------------
// Test: InstallerDatastore — verifies schema is created correctly
// ---------------------------------------------------------------------------

function testInstaller() {
  console.log('--- InstallerDatastore ---');

  const dir  = mkdtempSync(join(tmpdir(), 'mcp-test-'));
  const path = join(dir, 'test.db');

  try {
    console.log(' - Running installer...');
    new InstallerDatastore(path);

    console.log(' - Verifying schema...');
    const repo = new MemoryDatastore(path);

    const tables = repo.db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
      .all()
      .map(r => r.name);

    assert.ok(tables.includes('memories'),     'table memories missing');
    assert.ok(tables.includes('memories_fts'), 'table memories_fts missing');

    const triggers = repo.db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name`)
      .all()
      .map(r => r.name);

    assert.ok(triggers.includes('tr_fts_ai'), 'trigger tr_fts_ai missing');
    assert.ok(triggers.includes('tr_fts_au'), 'trigger tr_fts_au missing');
    assert.ok(triggers.includes('tr_fts_ad'), 'trigger tr_fts_ad missing');

    repo.close();
    console.log(' ✓ InstallerDatastore OK');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Test: MemoryDatastore + Tools (uses makeRepo, no InstallerDatastore)
// ---------------------------------------------------------------------------

async function testDatastore() {
  console.log('--- MemoryDatastore + Tools ---');

  const repo = makeRepo();
  const context = { repo };
  const handlers = new Map(ToolDefinitions.map(t => [t.name, t.handler]));

  const add      = handlers.get('add');
  const get      = handlers.get('get');
  const list     = handlers.get('list');
  const search   = handlers.get('search');
  const update   = handlers.get('update');
  const del      = handlers.get('delete');
  const dreaming = handlers.get('dreaming');

  console.log(' - add...');
  const addRes = await add({ content: 'Coffee', topic: 'pref', importance: 4 }, context);
  assert.equal(addRes.success, true);
  const id = addRes.id;

  console.log(' - get...');
  assert.equal((await get({ id }, context)).memory.content, 'Coffee');

  console.log(' - list...');
  assert.equal((await list({ topic: 'pref' }, context)).memories.length, 1);

  console.log(' - search...');
  assert.equal((await search({ query: 'Coffee', limit: 5 }, context)).memories[0].id, id);

  console.log(' - update...');
  await update({ id, content: 'Espresso' }, context);
  assert.equal((await get({ id }, context)).memory.content, 'Espresso');

  console.log(' - dreaming...');
  const dr = await dreaming({ limit: 10, offset: 0 }, context);
  assert.equal(dr.success, true);
  assert.ok(Array.isArray(dr.memories));

  console.log(' - delete...');
  await del({ id }, context);
  await assert.rejects(get({ id }, context));

  repo.close();
  console.log(' ✓ MemoryDatastore + Tools OK');
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function run() {
  console.log('Starting tests...\n');
  testInstaller();
  await testDatastore();
  console.log('\nAll tests passed!');
}

run().catch(err => { console.error(err); process.exit(1); });
