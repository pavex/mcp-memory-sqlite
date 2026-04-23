import { z } from 'zod';

export const Schemas = {
  add: z.object({
    content: z.string().min(1, 'content must not be empty'),
    topic: z.string().default('general'),
    keywords: z.string().default(''),
    importance: z.number().int().min(1).max(5).default(3)
  }),
  update: z.object({
    id: z.number().int().positive(),
    content: z.string().optional(),
    keywords: z.string().optional(),
    importance: z.number().int().min(1).max(5).optional()
  }).refine(d => d.content !== undefined || d.keywords !== undefined || d.importance !== undefined, {
    message: 'Provide at least one of: content, keywords, importance.'
  }),
  delete: z.object({ id: z.number().int().positive() }),
  get: z.object({ id: z.number().int().positive() }),
  list: z.object({
    topic: z.string().optional(),
    min_importance: z.number().int().min(1).max(5).optional(),
    limit: z.number().int().min(1).max(200).default(50)
  }),
  search: z.object({
    query: z.string().min(1, 'query must not be empty'),
    limit: z.number().int().min(1).max(100).default(20)
  }),
  topics: z.object({}),
  dreaming: z.object({
    limit: z.number().int().min(1).max(50).default(20),
    offset: z.number().int().nonnegative().default(0)
  })
};
