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
    const sql = `
      INSERT INTO memories (topic, content, keywords, importance)
      VALUES (@topic, @content, @keywords, @importance)
    `;
    return this.db.prepare(sql).run(d);
  }

  update(d) {
    const sql = `
      UPDATE memories
      SET content    = COALESCE(@content,    content),
          keywords   = COALESCE(@keywords,   keywords),
          importance = COALESCE(@importance, importance),
          updated_at = STRFTIME('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = @id
    `;
    return this.db.prepare(sql).run(d);
  }

  delete(id) {
    const sql = `
      DELETE FROM memories
      WHERE id = @id
    `;
    return this.db.prepare(sql).run({ id });
  }

  // --- Read -----------------------------------------------------------------

  getById(id) {
    const sql = `
      SELECT *
      FROM memories
      WHERE id = ?
    `;
    return this.db.prepare(sql).get(id);
  }

  countAll() {
    const sql = `
      SELECT COUNT(*) AS total
      FROM memories
    `;
    return this.db.prepare(sql).get().total;
  }

  listTopics() {
    const sql = `
      SELECT DISTINCT topic
      FROM memories
      ORDER BY topic
    `;
    return this.db.prepare(sql).all().map(r => r.topic);
  }

  list({ topic, min_importance, limit }) {
    if (topic && min_importance) {
      const sql = `
        SELECT *
        FROM memories
        WHERE topic = ?
          AND importance >= ?
        ORDER BY importance DESC, updated_at DESC
        LIMIT ?
      `;
      return this.db.prepare(sql).all(topic, min_importance, limit);
    }
    if (topic) {
      const sql = `
        SELECT *
        FROM memories
        WHERE topic = ?
        ORDER BY importance DESC, updated_at DESC
        LIMIT ?
      `;
      return this.db.prepare(sql).all(topic, limit);
    }
    if (min_importance) {
      const sql = `
        SELECT *
        FROM memories
        WHERE importance >= ?
        ORDER BY importance DESC, updated_at DESC
        LIMIT ?
      `;
      return this.db.prepare(sql).all(min_importance, limit);
    }
    const sql = `
      SELECT *
      FROM memories
      ORDER BY importance DESC, updated_at DESC
      LIMIT ?
    `;
    return this.db.prepare(sql).all(limit);
  }

  // --- Search ---------------------------------------------------------------

  search(q, limit) {
    const sql = `
      SELECT m.*
      FROM memories m
      JOIN memories_fts f ON f.rowid = m.id
      WHERE memories_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `;
    return this.db.prepare(sql).all(q, limit);
  }

  searchInTopic(q, topic) {
    const sql = `
      SELECT m.*
      FROM memories m
      JOIN memories_fts f ON f.rowid = m.id
      WHERE memories_fts MATCH ?
        AND m.topic = ?
      ORDER BY rank
      LIMIT 1
    `;
    return this.db.prepare(sql).get(q, topic);
  }

  // --- Dreaming -------------------------------------------------------------

  dreamingPage(limit, offset) {
    const sql = `
      SELECT *
      FROM memories
      ORDER BY topic ASC, id ASC
      LIMIT ? OFFSET ?
    `;
    return this.db.prepare(sql).all(limit, offset);
  }

  // --- Lifecycle ------------------------------------------------------------

  close() { this.db.close(); }
}
