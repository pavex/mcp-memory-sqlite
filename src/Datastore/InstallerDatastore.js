import Database from 'better-sqlite3';
import { SqliteNativeBinding } from './SqliteNativeBinding.js';

// ---------------------------------------------------------------------------

export class InstallerDatastore {
  constructor(dbPath) {
    const db = new Database(dbPath, SqliteNativeBinding.options());

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

      CREATE INDEX IF NOT EXISTS idx_memories_topic
        ON memories(topic);

      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts
        USING fts5(content, topic, keywords, content='memories', content_rowid='id', tokenize='unicode61 remove_diacritics 1');

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

    db.close();
  }
}
