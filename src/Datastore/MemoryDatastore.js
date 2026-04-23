import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { SqliteNativeBinding } from './SqliteNativeBinding.js';

// ---------------------------------------------------------------------------

export class MemoryDatastore {
  constructor(dbPath) {
    if (dbPath !== ':memory:') {
      const dir = dirname(dbPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath, SqliteNativeBinding.options());
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  // --- Write ----------------------------------------------------------------

  add(d) {
    return this.db
      .prepare('INSERT INTO memories (topic, content, keywords, importance) VALUES (@topic, @content, @keywords, @importance)')
      .run(d);
  }

  update(d) {
    return this.db
      .prepare(`UPDATE memories
                   SET content    = COALESCE(@content,    content),
                       keywords   = COALESCE(@keywords,   keywords),
                       importance = COALESCE(@importance, importance),
                       updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
                 WHERE id = @id`)
      .run(d);
  }

  delete(id) {
    return this.db
      .prepare('DELETE FROM memories WHERE id = @id')
      .run({ id });
  }

  // --- Read -----------------------------------------------------------------

  getById(id) {
    return this.db
      .prepare('SELECT * FROM memories WHERE id = ?')
      .get(id);
  }

  countAll() {
    return this.db
      .prepare('SELECT COUNT(*) AS total FROM memories')
      .get().total;
  }

  listTopics() {
    return this.db
      .prepare('SELECT DISTINCT topic FROM memories ORDER BY topic')
      .all()
      .map(r => r.topic);
  }

  list({ topic, min_importance, limit }) {
    if (topic && min_importance) {
      return this.db
        .prepare('SELECT * FROM memories WHERE topic = ? AND importance >= ? ORDER BY importance DESC, updated_at DESC LIMIT ?')
        .all(topic, min_importance, limit);
    }
    if (topic) {
      return this.db
        .prepare('SELECT * FROM memories WHERE topic = ? ORDER BY importance DESC, updated_at DESC LIMIT ?')
        .all(topic, limit);
    }
    if (min_importance) {
      return this.db
        .prepare('SELECT * FROM memories WHERE importance >= ? ORDER BY importance DESC, updated_at DESC LIMIT ?')
        .all(min_importance, limit);
    }
    return this.db
      .prepare('SELECT * FROM memories ORDER BY importance DESC, updated_at DESC LIMIT ?')
      .all(limit);
  }

  // --- Search ---------------------------------------------------------------

  search(q, limit) {
    return this.db
      .prepare(`SELECT m.*
                  FROM memories m
                  JOIN memories_fts f ON f.rowid = m.id
                 WHERE memories_fts MATCH ?
                 ORDER BY rank
                 LIMIT ?`)
      .all(q, limit);
  }

  searchInTopic(q, topic) {
    return this.db
      .prepare(`SELECT m.*
                  FROM memories m
                  JOIN memories_fts f ON f.rowid = m.id
                 WHERE memories_fts MATCH ?
                   AND m.topic = ?
                 ORDER BY rank
                 LIMIT 1`)
      .get(q, topic);
  }

  // --- Dreaming -------------------------------------------------------------

  dreamingPage(limit, offset) {
    return this.db
      .prepare('SELECT * FROM memories ORDER BY topic ASC, id ASC LIMIT ? OFFSET ?')
      .all(limit, offset);
  }

  // --- Lifecycle ------------------------------------------------------------

  close() { this.db.close(); }
}
