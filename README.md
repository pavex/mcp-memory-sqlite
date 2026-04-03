# 🧠 mcp-memory-sqlite

> MCP server — persistent LLM memory backed by SQLite with full-text search.

## Features

- 💾 SQLite storage — structured, queryable, durable
- 🔍 FTS5 full-text search across content, topic and keywords
- 🗂️ Topics, keywords and importance for selective context loading
- 🚀 8 focused tools: `add`, `update`, `delete`, `get`, `list`, `search`, `topics`, `dreaming`
- 🧹 `dreaming` — paginated memory defragmentation (deduplication, reorganization)
- 📦 Zero runtime dependencies except `better-sqlite3` — no SDK, no Zod
- ⚡ Lightweight custom stdio MCP server (~80 lines, JSON-RPC 2.0)

---

## Tools

| Tool | Description |
|---|---|
| `list` | List entries sorted by importance + recency — call at conversation start |
| `add` | Add a new memory entry with topic, keywords and importance |
| `update` | Update existing entry by ID (partial — only provided fields change) |
| `delete` | Delete entry by ID |
| `get` | Fetch single entry by ID |
| `search` | FTS5 full-text search across content, topic and keywords |
| `topics` | List all distinct topics — call before `add` for consistency |
| `dreaming` | Paginated memory defragmentation — reorganize in batches |

---

## Requirements

- **Node.js 18+**
- **OS:** Linux / macOS / Windows

---

## Install & Build

```bash
npm install
npm run build   # → dist/mcp.js (~17 KB)
```

---

## Usage

```bash
# Default: src/.storage/memory.db
node src/mcp.js

# Named prefix: src/.storage/project.db
node src/mcp.js project

# Direct path (contains / or \)
node src/mcp.js /data/myproject.db
node src/mcp.js C:\notes\memory.db
```

In path mode the target directory must already exist.

---

## Claude Desktop Config

### Single instance
```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-memory-sqlite/src/mcp.js"]
    }
  }
}
```

### Multiple isolated instances
```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-memory-sqlite/src/mcp.js"]
    },
    "memory-project": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-memory-sqlite/src/mcp.js", "myproject"]
    }
  }
}
```

> ⚠️ Always use absolute paths in Claude Desktop config.

---

## System Prompt

```
At the start of each conversation call list to load your memory.
Before adding new information, always call search to check for duplicates.
Call topics before add to use a consistent topic name.
Use update instead of add when similar information already exists.
Periodically call dreaming to reorganize and clean up memory.
```

---

## DB Schema

```sql
CREATE TABLE memories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  topic       TEXT    NOT NULL DEFAULT 'general',
  content     TEXT    NOT NULL,
  keywords    TEXT    NOT NULL DEFAULT '',   -- space-separated, included in FTS
  importance  INTEGER NOT NULL DEFAULT 3,   -- 1=trivial … 5=critical
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
-- FTS5 virtual table (content + topic + keywords) + sync triggers
-- Indexes: topic, updated_at DESC, importance DESC
```

> ⚠️ **Breaking change from beta:** existing `.db` files are incompatible — delete them before upgrading.

---

## Dreaming Workflow

`dreaming` retrieves memories in batches for LLM-driven reorganization:

```
dreaming()              → batch 1/3, has_more: true,  next_offset: 20
  → delete duplicates, update topics/keywords/importance
dreaming(offset=20)     → batch 2/3, has_more: true,  next_offset: 40
  → continue reorganizing
dreaming(offset=40)     → batch 3/3, has_more: false
  → "This is the last batch — dreaming complete."
```

Each response includes `instructions` telling the LLM exactly what to do next.

---

## Project Structure

```
mcp-memory-sqlite/
├── src/
│   ├── mcp.js       # Entry point — DB path resolution, tool registration
│   ├── server.js    # Lightweight stdio MCP server (JSON-RPC 2.0, no SDK)
│   ├── db.js        # SQLite schema, FTS5, prepared statements
│   ├── tools.js     # Tool definitions (plain JSON Schema)
│   └── handlers.js  # Business logic for each tool
├── dist/
│   └── mcp.js       # Bundled output (esbuild, better-sqlite3 external)
├── package.json
└── README.md
```

---

## License

MIT
