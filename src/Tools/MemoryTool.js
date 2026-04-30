import { Schemas } from '../Utils/Schemas.js';

const fts = (t) => t.replace(/[^\p{L}\p{N}]/gu, ' ').trim().split(/\s+/).slice(0, 8).join(' ');

export const MemoryTools = [
  {
    name: 'add',
    description: 'Store a new memory. Checks for duplicates in the same topic first.',
    inputSchema: Schemas.add,
    handler: async (args, { repo }) => {
      const data = { topic: 'general', keywords: '', importance: 3, ...args };
      const q = fts(data.content);
      if (q) {
        const ex = repo.searchInTopic(q, data.topic);
        if (ex) return { success: false, duplicate: true, existing_id: ex.id, message: 'Similar entry exists.' };
      }
      return { success: true, id: repo.add(data).lastInsertRowid };
    }
  },
  {
    name: 'update',
    description: 'Update content, keywords or importance of a memory by ID.',
    inputSchema: Schemas.update,
    handler: async (args, { repo }) => {
      if (!repo.getById(args.id)) throw new Error(`Memory #${args.id} not found.`);
      const data = { content: null, keywords: null, importance: null, ...args };
      repo.update(data);
      return { success: true, id: args.id };
    }
  },
  {
    name: 'delete',
    description: 'Delete a memory by ID.',
    inputSchema: Schemas.delete,
    handler: async (args, { repo }) => {
      if (!repo.getById(args.id)) throw new Error(`Memory #${args.id} not found.`);
      repo.delete(args.id);
      return { success: true, id: args.id };
    }
  },
  {
    name: 'get',
    description: 'Fetch a single memory by ID.',
    inputSchema: Schemas.get,
    handler: async (args, { repo }) => {
      const row = repo.getById(args.id);
      if (!row) throw new Error(`Memory #${args.id} not found.`);
      return { success: true, memory: row };
    }
  },
  {
    name: 'list',
    description: 'List memories. SESSION START: call list(topic="_bootstrap",limit=1) first — contains identity, workflow rules, and memory_map with exact record IDs.',
    inputSchema: Schemas.list,
    handler: async (args, { repo }) => {
      const d = { limit: 50, ...args };
      const rows = repo.list(d);
      return { success: true, count: rows.length, memories: rows };
    }
  },
  {
    name: 'search',
    description: 'Full-text search across content, topic and keywords.',
    inputSchema: Schemas.search,
    handler: async (args, { repo }) => {
      const q = fts(args.query);
      return { success: true, memories: repo.search(q ? `"${q}"` : '', args.limit || 20) };
    }
  },
  {
    name: 'topics',
    description: 'List all topics. Fallback only — prefer list(topic="_bootstrap",limit=1) at session start.',
    inputSchema: Schemas.topics,
    handler: async (_, { repo }) => ({ success: true, topics: repo.listTopics() })
  }
];
