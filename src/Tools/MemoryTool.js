import { Schemas } from '../Utils/Schemas.js';

const fts = (t) => t.replace(/[^\p{L}\p{N}]/gu, ' ').trim().split(/\s+/).slice(0, 8).join(' ');

export const MemoryTools = [
  {
    name: 'add',
    description: 'Store a new piece of information.',
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
    description: 'Update memory by ID.',
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
    description: 'Delete memory by ID.',
    inputSchema: Schemas.delete,
    handler: async (args, { repo }) => {
      if (!repo.getById(args.id)) throw new Error(`Memory #${args.id} not found.`);
      repo.delete(args.id);
      return { success: true, id: args.id };
    }
  },
  {
    name: 'get',
    description: 'Fetch memory by ID.',
    inputSchema: Schemas.get,
    handler: async (args, { repo }) => {
      const row = repo.getById(args.id);
      if (!row) throw new Error(`Memory #${args.id} not found.`);
      return { success: true, memory: row };
    }
  },
  {
    name: 'list',
    description: 'List memories.',
    inputSchema: Schemas.list,
    handler: async (args, { repo }) => {
      const d = { limit: 50, ...args };
      const rows = repo.list(d);
      return { success: true, count: rows.length, memories: rows };
    }
  },
  {
    name: 'search',
    description: 'Search memories.',
    inputSchema: Schemas.search,
    handler: async (args, { repo }) => {
      const q = fts(args.query);
      return { success: true, memories: repo.search(q ? `"${q}"` : '', args.limit || 20) };
    }
  },
  {
    name: 'topics',
    description: 'List topics.',
    inputSchema: Schemas.topics,
    handler: async (_, { repo }) => ({ success: true, topics: repo.listTopics() })
  }
];
