/**
 * Tool definitions — plain JSON Schema, no external dependencies.
 */

export const tools = {

  add: {
    name: 'add',
    description:
      'Store a new piece of information in memory. ' +
      'IMPORTANT: Before calling this, always run search to check if similar ' +
      'information already exists. If it does, use update instead to avoid duplicates. ' +
      'Use a consistent topic name — call topics first to see existing topics.',
    inputSchema: {
      type: 'object',
      properties: {
        content:    { type: 'string',  description: 'The information to remember.' },
        topic:      { type: 'string',  description: 'Category (e.g. "identity", "projects", "preferences"). Check topics first.', default: 'general' },
        keywords:   { type: 'string',  description: 'Space-separated keywords for search (e.g. "php mcp sqlite"). Included in full-text search.', default: '' },
        importance: { type: 'integer', description: 'Importance 1–5 (1=trivial, 3=normal, 5=critical). Default 3.', default: 3 },
      },
      required: ['content'],
    },
  },

  update: {
    name: 'update',
    description:
      'Update an existing memory entry by ID. ' +
      'Only the fields you provide will be changed — omit fields you want to keep unchanged. ' +
      'Use this instead of add when similar information already exists.',
    inputSchema: {
      type: 'object',
      properties: {
        id:         { type: 'integer', description: 'ID of the entry to update (from list or search).' },
        content:    { type: 'string',  description: 'New text content. Omit to keep existing.' },
        keywords:   { type: 'string',  description: 'New keywords (space-separated). Omit to keep existing.' },
        importance: { type: 'integer', description: 'New importance 1–5. Omit to keep existing.' },
      },
      required: ['id'],
    },
  },

  delete: {
    name: 'delete',
    description: 'Permanently delete a memory entry by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'ID of the entry to delete.' },
      },
      required: ['id'],
    },
  },

  get: {
    name: 'get',
    description: 'Fetch a single memory entry by its ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'ID of the memory entry to retrieve.' },
      },
      required: ['id'],
    },
  },

  list: {
    name: 'list',
    description:
      'List memory entries, sorted by importance then recency. ' +
      'Call at the start of each conversation to load context. ' +
      'Filter by topic and/or minimum importance to reduce output size.',
    inputSchema: {
      type: 'object',
      properties: {
        topic:          { type: 'string',  description: 'Filter by topic. Omit to list all.' },
        min_importance: { type: 'integer', description: 'Only return entries with importance >= this value (1–5).' },
        limit:          { type: 'integer', description: 'Max entries to return. Default 50.', default: 50 },
      },
    },
  },

  search: {
    name: 'search',
    description:
      'Full-text search across all memory entries (content, topic, keywords). ' +
      'Searches for exact words — use list for browsing. ' +
      'Run this before add to detect potential duplicates.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string',  description: 'Words to search for (FTS5 — exact word match).' },
        limit: { type: 'integer', description: 'Max results to return. Default 20.', default: 20 },
      },
      required: ['query'],
    },
  },

  topics: {
    name: 'topics',
    description:
      'List all distinct topics currently used in memory. ' +
      'Call before add to pick a consistent topic name and avoid variants like ' +
      '"project" vs "projects" vs "Project".',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  dreaming: {
    name: 'dreaming',
    description:
      'Retrieve a batch of memories for reorganization (defragmentation). ' +
      'Use periodically to clean up memory: remove duplicates, merge related entries, ' +
      'assign consistent topics and keywords, adjust importance levels. ' +
      'WORKFLOW: ' +
      '1. Call dreaming() — receive first batch + total/has_more info. ' +
      '2. Reorganize this batch: call delete, update, add as needed. ' +
      '3. If has_more is true, call dreaming(offset=next_offset) for the next batch. ' +
      '4. Repeat until has_more is false.',
    inputSchema: {
      type: 'object',
      properties: {
        limit:  { type: 'integer', description: 'Entries per batch. Default 20, max 50.', default: 20 },
        offset: { type: 'integer', description: 'Skip this many entries (for pagination). Default 0.', default: 0 },
      },
    },
  },

};
