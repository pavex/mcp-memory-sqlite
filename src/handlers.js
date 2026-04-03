/**
 * Tool handlers — business logic for each MCP tool.
 */

export function createHandlers(store) {
  const { stmts } = store;

  const ok  = data    => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
  const err = message => ({ content: [{ type: 'text', text: JSON.stringify({ success: false, error: message }) }], isError: true });

  function validImportance(v) {
    if (v === undefined || v === null) return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 5) return false;
    return n;
  }

  function ftsQuery(text) {
    return text.trim().split(/\s+/).slice(0, 8)
      .map(w => w.replace(/["*^]/g, '')).filter(Boolean)
      .join(' ');
  }

  return {

    add({ content, topic = 'general', keywords = '', importance = 3 }) {
      if (!content?.trim()) return err('content must not be empty');

      const imp = validImportance(importance);
      if (imp === false) return err('importance must be an integer 1–5');

      try {
        const q = ftsQuery(content);
        if (q) {
          const existing = stmts.searchInTopic.get(q, topic.trim());
          if (existing) {
            return ok({
              success: false,
              duplicate: true,
              existing_id: existing.id,
              existing_content: existing.content,
              message: `Similar memory already exists (id: ${existing.id}). Use update to update it, or call add again with force:true to insert anyway.`,
            });
          }
        }
      } catch { /* FTS chyba — pokračuj s insertem */ }

      const result = stmts.insert.run({
        topic:      topic.trim(),
        content:    content.trim(),
        keywords:   keywords.trim(),
        importance: imp ?? 3,
      });
      return ok({ success: true, id: result.lastInsertRowid, message: 'Memory added.' });
    },

    update({ id, content, keywords, importance }) {
      if (!id) return err('id is required');

      const existing = stmts.getById.get(id);
      if (!existing) return err(`Memory #${id} not found.`);

      if (content === undefined && keywords === undefined && importance === undefined) {
        return err('Provide at least one of: content, keywords, importance.');
      }

      const imp = validImportance(importance);
      if (imp === false) return err('importance must be an integer 1–5');

      stmts.update.run({
        id,
        content:    content !== undefined ? content.trim() : null,
        keywords:   keywords !== undefined ? keywords.trim() : null,
        importance: imp,
      });
      return ok({ success: true, id, message: 'Memory updated.' });
    },

    delete({ id }) {
      if (!id) return err('id is required');
      const existing = stmts.getById.get(id);
      if (!existing) return err(`Memory #${id} not found.`);
      stmts.delete.run({ id });
      return ok({ success: true, id, message: 'Memory deleted.' });
    },

    get({ id }) {
      if (!id) return err('id is required');
      const row = stmts.getById.get(id);
      if (!row) return err(`Memory #${id} not found.`);
      return ok({ success: true, memory: row });
    },

    list({ topic, min_importance, limit = 50 } = {}) {
      const lim = Math.min(Math.max(1, Number(limit) || 50), 200);
      let rows;
      if (topic && min_importance) {
        rows = stmts.listByTopicAndMinImportance.all(topic, Number(min_importance), lim);
      } else if (topic) {
        rows = stmts.listByTopic.all(topic, lim);
      } else if (min_importance) {
        rows = stmts.listByMinImportance.all(Number(min_importance), lim);
      } else {
        rows = stmts.listAll.all(lim);
      }
      return ok({ success: true, count: rows.length, memories: rows });
    },

    search({ query, limit = 20 }) {
      if (!query?.trim()) return err('query must not be empty');
      const lim = Math.min(Math.max(1, Number(limit) || 20), 100);
      try {
        const rows = stmts.search.all(query.trim(), lim);
        return ok({ success: true, count: rows.length, memories: rows });
      } catch (e) {
        return err(`FTS error: ${e.message}`);
      }
    },

    topics() {
      const rows = stmts.listTopics.all();
      return ok({ success: true, topics: rows.map(r => r.topic) });
    },

    dreaming({ limit = 20, offset = 0 } = {}) {
      const lim = Math.min(Math.max(1, Number(limit) || 20), 50);
      const off = Math.max(0, Number(offset) || 0);

      const { total } = stmts.countAll.get();
      const rows      = stmts.dreamingPage.all(lim, off);
      const has_more  = (off + rows.length) < total;

      return ok({
        success:  true,
        total,
        offset:   off,
        limit:    lim,
        count:    rows.length,
        has_more,
        next_offset: has_more ? off + lim : null,
        memories: rows,
        instructions:
          'Reorganize this batch: remove duplicates, merge related entries, ' +
          'assign consistent topics and keywords, adjust importance (1–5). ' +
          'Use delete, update, add to apply changes. ' +
          (has_more
            ? `Then call dreaming(limit=${lim}, offset=${off + lim}) to process the next batch.`
            : 'This is the last batch — dreaming complete.'),
      });
    },

  };
}
