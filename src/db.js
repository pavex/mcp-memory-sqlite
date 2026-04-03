/**
 * Database layer — schema init and prepared statements.
 * Schema v2: keywords, importance, created_at/updated_at, FTS5, indexy, triggery.
 */

import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDatabase(dbPath) {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: false });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      topic       TEXT    NOT NULL DEFAULT 'general',
      content     TEXT    NOT NULL,
      keywords    TEXT    NOT NULL DEFAULT '',
      importance  INTEGER NOT NULL DEFAULT 3,
      created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_memories_topic      ON memories(topic);
    CREATE INDEX IF NOT EXISTS idx_memories_updated_at ON memories(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);

    CREATE TRIGGER IF NOT EXISTS tr_memories_updated_at
    AFTER UPDATE ON memories
    BEGIN
      UPDATE memories SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = NEW.id;
    END;

    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content, topic, keywords,
      content='memories',
      content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS tr_fts_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content, topic, keywords)
        VALUES (new.id, new.content, new.topic, new.keywords);
    END;

    CREATE TRIGGER IF NOT EXISTS tr_fts_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, topic, keywords)
        VALUES ('delete', old.id, old.content, old.topic, old.keywords);
      INSERT INTO memories_fts(rowid, content, topic, keywords)
        VALUES (new.id, new.content, new.topic, new.keywords);
    END;

    CREATE TRIGGER IF NOT EXISTS tr_fts_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, topic, keywords)
        VALUES ('delete', old.id, old.content, old.topic, old.keywords);
    END;
  `);

  const stmts = {
    insert: db.prepare(`
      INSERT INTO memories (topic, content, keywords, importance)
      VALUES (@topic, @content, @keywords, @importance)
    `),

    update: db.prepare(`
      UPDATE memories
      SET content    = COALESCE(@content,    content),
          keywords   = COALESCE(@keywords,   keywords),
          importance = COALESCE(@importance, importance)
      WHERE id = @id
    `),

    delete: db.prepare(`DELETE FROM memories WHERE id = @id`),

    getById: db.prepare(`SELECT * FROM memories WHERE id = ?`),

    countAll: db.prepare(`SELECT COUNT(*) AS total FROM memories`),

    listAll: db.prepare(`
      SELECT * FROM memories
      ORDER BY importance DESC, updated_at DESC
      LIMIT ?
    `),

    listByTopic: db.prepare(`
      SELECT * FROM memories
      WHERE topic = ?
      ORDER BY importance DESC, updated_at DESC
      LIMIT ?
    `),

    listByMinImportance: db.prepare(`
      SELECT * FROM memories
      WHERE importance >= ?
      ORDER BY importance DESC, updated_at DESC
      LIMIT ?
    `),

    listByTopicAndMinImportance: db.prepare(`
      SELECT * FROM memories
      WHERE topic = ? AND importance >= ?
      ORDER BY importance DESC, updated_at DESC
      LIMIT ?
    `),

    listTopics: db.prepare(`
      SELECT DISTINCT topic FROM memories ORDER BY topic
    `),

    search: db.prepare(`
      SELECT m.*
      FROM memories m
      JOIN memories_fts f ON f.rowid = m.id
      WHERE memories_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `),

    searchInTopic: db.prepare(`
      SELECT m.*
      FROM memories m
      JOIN memories_fts f ON f.rowid = m.id
      WHERE memories_fts MATCH ? AND m.topic = ?
      ORDER BY rank
      LIMIT 1
    `),

    // dreaming — stránkování přes všechny záznamy seřazené dle topic + id
    dreamingPage: db.prepare(`
      SELECT * FROM memories
      ORDER BY topic ASC, id ASC
      LIMIT ? OFFSET ?
    `),
  };

  return { db, stmts };
}
