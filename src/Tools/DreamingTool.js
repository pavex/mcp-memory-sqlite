import { Schemas } from '../Utils/Schemas.js';

export const DreamingTool = {
  name: 'dreaming',
  description: 'Get memories for cleanup and reorganization.',
  inputSchema: Schemas.dreaming,
  handler: async (args, { repo }) => {
    const d = { limit: 20, offset: 0, ...args };
    const total = repo.countAll();
    const rows = repo.dreamingPage(d.limit, d.offset);
    const has_more = (d.offset + rows.length) < total;

    const instructions = [
      `DREAMING WORKFLOW (Batch ${Math.floor(d.offset / d.limit) + 1}):`,
      '1. ANALYZE: Review the batch. Identify entries to Delete (🔴), Merge (🟡), Update (🟠), or Keep (🟢).',
      '2. REPORT: Present your proposed cleanup plan to the user before execution.',
      '3. EXECUTE: Apply changes using delete, update, and add tools.',
      `4. NEXT: ${has_more ? `Call dreaming(offset=${d.offset + d.limit}) for the next batch.` : 'Dreaming complete.'}`,
      '',
      'IMPORTANCE SCALE:',
      '5: CRITICAL (Identity, core workflow rules, active high-priority projects).',
      '4: IMPORTANT (Active projects, architecture, coding standards).',
      '3: USEFUL (Stable/finished projects, historical milestones).',
      '2: LOW PRIORITY (Historical trivia, deferred ideas).',
      '1: CLEANUP CANDIDATE (Redundant or obsolete).',
      '',
      'STRATEGY:',
      '- MERGING: Consolidate related entries into one "Main Project" entry. Move finished TODOs/plans into project notes, then delete the originals.',
      '- PRESERVING: Always keep historical milestones, bug fixes with root cause analysis, and architectural principles.'
    ].join('\n');

    return {
      success: true,
      total,
      memories: rows,
      has_more,
      next_offset: has_more ? d.offset + d.limit : null,
      instructions
    };
  }
};
