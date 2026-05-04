# Persistent SQLite Memory for Claude and LLM Agents

> **Give your AI a long-term memory it actually remembers.** `mcp-memory-sqlite` is a lightweight [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server designed for Claude and other LLM agents. It stores structured knowledge in a local SQLite database with full-text search, topic organisation, importance levels, and built-in memory defragmentation — no cloud, no vendor lock-in, no unnecessary dependencies.

**Designed for Claude Desktop. Built for every user who ever wished their AI could just... remember.** 🧠

---

# 🧠 mcp-memory-sqlite

**Keywords:** MCP server, Claude memory, persistent memory, Claude Desktop, SQLite MCP, long-term memory, Model Context Protocol, AI memory, LLM memory, claude-desktop

---

## Features

- 💾 **SQLite storage** — structured, queryable, durable, zero-config
- 🔍 **FTS5 full-text search** across content, topic and keywords (`unicode61`, diacritics-aware)
- 🗂️ **Topics, keywords and importance** for selective context loading
- 🔁 **Duplicate detection** on `add` — searches for similar entries in the same topic before inserting
- 🚀 **8 focused tools:** `add`, `update`, `delete`, `get`, `list`, `search`, `topics`, `dreaming`
- 🧹 **`dreaming`** — paginated memory defragmentation with LLM workflow instructions
- ⚡ **Bootstrap strategy** — `_bootstrap` record gives the agent identity + memory map in a single call
- 📊 **`stats.js`** — standalone CLI dashboard showing topic distribution, importance and health indicators
- 🔐 **Clean DB shutdown** — `repo.close()` is called on `SIGINT`, `SIGTERM` and `exit`, releasing WAL locks before any cleanup
- 📦 **Self-contained build** — `dist/` contains everything including the native SQLite binary
- ⚡ **Lightweight** — built on the official MCP SDK with minimal dependencies
- 🔒 **Clean DB on disk** — WAL checkpoint after every operation, safe for backups
- 🪟 **Cross-platform** — Linux, macOS and Windows

---

## Tools

| Tool | Description |
|---|---|
| `list` | List entries sorted by importance + recency. **Start here** — call `list(topic="_bootstrap", limit=1)` at session start. |
| `add` | Add a new memory entry with topic, keywords and importance. Checks for duplicates first. |
| `update` | Partially update an existing entry by ID — only the fields you provide change. |
| `delete` | Delete entry by ID. |
| `get` | Fetch a single entry by ID. |
| `search` | FTS5 full-text search across content, topic and keywords. |
| `topics` | List all distinct topics — fallback if `_bootstrap` does not exist yet. |
| `dreaming` | Paginated memory defragmentation — retrieve batches and reorganize with the LLM. |

---

## Requirements

- **Node.js 18+**
- **OS:** Linux / macOS / Windows

---

## Install & Build

Clone the repository and run the build script. It installs dependencies, bundles everything into `dist/` and runs all tests (unit + integration):

```bash
# Linux / macOS
chmod +x build.sh
./build.sh

# Windows
.\build.cmd
```

The result is a **self-contained `dist/` folder** — copy it anywhere you need. The native SQLite binary (`better_sqlite3.node`) is included alongside the bundled server.

---

## Usage

Run the server directly with Node.js. The first argument controls where the database file is stored:

```bash
# Default: .var/memory.db  (relative to the dist/ folder)
node dist/mcp.js

# Named prefix: .var/work.db
node dist/mcp.js work

# Direct path — any path containing / or \ is treated as absolute or relative path
node dist/mcp.js /data/myproject.db
node dist/mcp.js C:\notes\memory.db
```

> **Note:** In direct-path mode the target directory must already exist.

---

## Memory Stats

`stats.js` is a standalone CLI dashboard that reads the database directly — no MCP server required. It uses the **same argument convention** as `mcp.js`.

```bash
# Same DB as the default MCP instance
node dist/stats.js

# Named instance
node dist/stats.js work

# Direct path
node dist/stats.js C:\notes\memory.db
```

**Example output:**

```
=== MEMORY STATS ===  48 records · 9 topics  .var/memory.db
────────────────────────────────────────────────────────────────────────────────
projects          ████████████████████░░░░░░░░░░  12  imp:4.2  today
                  ↳ merkd, php, builder, sqlite
coding            ████████████████░░░░░░░░░░░░░░   9  imp:3.8  yesterday
                  ↳ javascript, nodejs, esbuild
workflow          ████████░░░░░░░░░░░░░░░░░░░░░░   5  imp:4.5  3d ago
────────────────────────────────────────────────────────────────────────────────
⚠  3 records without keywords
✓  No low-importance candidates
────────────────────────────────────────────────────────────────────────────────
```

Color coding: 🟢 avg importance < 3.5 · 🟡 3.5–4.4 · 🔴 ≥ 4.5

---

## Claude Desktop Config

Add the server to your `claude_desktop_config.json`. Always use **absolute paths**.

### Single instance

```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-memory-sqlite/dist/mcp.js"]
    }
  }
}
```

### Multiple isolated instances

Run separate instances with different database files — useful for keeping work and personal memories apart:

```json
{
  "mcpServers": {
    "memory-work": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-memory-sqlite/dist/mcp.js", "work"]
    },
    "memory-personal": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-memory-sqlite/dist/mcp.js", "personal"]
    }
  }
}
```

Each instance maintains a completely independent database.

---

## System Prompt

Add these instructions to Claude's system prompt to get the most out of the memory server:

```
At the start of each conversation call list(topic="_bootstrap", limit=1) to load identity and memory map.
Use the memory_map in the _bootstrap record to fetch specific records by ID — avoid blind listing.
Before adding new information always call search to check for duplicates.
Call topics before add to use a consistent topic name.
Use update instead of add when similar information already exists.
Periodically call dreaming to reorganize and clean up memory.
```

---

## Bootstrap Strategy

The `_bootstrap` record is a single high-importance entry (`topic: "_bootstrap"`) that acts as the agent's **session manifest**. It eliminates the need for broad topic scans at the start of every conversation.

### What it contains

```json
{
  "identity": { "user": "...", "ai_name": "...", "lang": "...", "style": "..." },
  "workflow":  ["rule 1", "rule 2"],
  "memory_map": {
    "active_project": 30,
    "preferences":    42
  },
  "session_strategy": "Instructions for the agent on how to proceed."
}
```

### Startup sequence (2 calls max)

```
1. list(topic="_bootstrap", limit=1)   → identity + workflow + memory_map
2. get(id=<active_project_id>)         → full project context
```

### Creating the bootstrap record

Run this once via any MCP client:

```json
{
  "tool": "add",
  "arguments": {
    "topic": "_bootstrap",
    "importance": 5,
    "keywords": "bootstrap identity workflow memory_map startup",
    "content": "{ ... your JSON manifest ... }"
  }
}
```

Keep the bootstrap record updated via `update` whenever a new project becomes active or workflow rules change. The `list` and `topics` tool descriptions contain inline bootstrap instructions visible to the agent at tool-discovery time.

---

## How It Works

### Storage

Each memory entry consists of:

| Field | Type | Description |
|---|---|---|
| `id` | integer | Auto-incremented primary key |
| `topic` | text | Category / namespace (e.g. `projects`, `workflow`) |
| `content` | text | The memory itself |
| `keywords` | text | Space or comma-separated tags included in FTS index |
| `importance` | 1–5 | Priority level — controls sort order in `list` |
| `created_at` | ISO 8601 | Creation timestamp |
| `updated_at` | ISO 8601 | Last update timestamp |

### Full-Text Search

The FTS5 virtual table indexes `content`, `topic` and `keywords` together. The tokenizer is `unicode61 remove_diacritics 1` — diacritics are normalized at index time, so searching for `"testovaci"` matches `"testovací"`. Three sync triggers (`INSERT`, `UPDATE`, `DELETE`) keep the FTS index consistent with the main table automatically.

### Duplicate Detection

`add` extracts the first 8 words from the content (stripping all non-alphanumeric characters), runs an FTS search within the same topic, and returns `duplicate: true` with the existing ID if a similar entry is found. This prevents redundant entries without extra round-trips.

### Clean DB Shutdown

`mcp.js` registers handlers for `SIGINT`, `SIGTERM` and the Node.js `exit` event. Each handler calls `repo.close()` which flushes the WAL and releases all file locks before the process exits. This ensures that any cleanup code (e.g. test teardown deleting the DB file) runs only after SQLite has fully released its handles.

### Dreaming

`dreaming` retrieves memories in pages and returns a `instructions` field telling the LLM exactly what to do next — analyse the batch, propose changes, apply them, then fetch the next page:

```
dreaming()           → batch 1, has_more: true,  next_offset: 20
  → delete duplicates, merge related, update importance
dreaming(offset=20)  → batch 2, has_more: true,  next_offset: 40
  → continue
dreaming(offset=40)  → batch 3, has_more: false
  → dreaming complete
```

---

## DB Schema

```sql
CREATE TABLE memories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  topic       TEXT    NOT NULL DEFAULT 'general',
  content     TEXT    NOT NULL,
  keywords    TEXT    NOT NULL DEFAULT '',
  importance  INTEGER NOT NULL DEFAULT 3,
  created_at  TEXT    NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT    NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- FTS5 virtual table (content + topic + keywords)
CREATE VIRTUAL TABLE memories_fts
  USING fts5(content, topic, keywords,
             content='memories', content_rowid='id',
             tokenize='unicode61 remove_diacritics 1');

-- Sync triggers keep FTS in sync with the main table
CREATE TRIGGER tr_fts_ai AFTER INSERT ON memories ...
CREATE TRIGGER tr_fts_au AFTER UPDATE ON memories ...
CREATE TRIGGER tr_fts_ad AFTER DELETE ON memories ...

-- Indexes
CREATE INDEX idx_memories_topic ON memories(topic);
```

---

## Project Structure

```
mcp-memory-sqlite/
├── src/
│   ├── mcp.js                        # Entry point — MCP server + graceful shutdown
│   ├── stats.js                      # CLI memory dashboard (topic bars, health check)
│   ├── Config.js                     # DB path resolution (argv, prefix, direct path)
│   ├── Datastore/
│   │   ├── InstallerDatastore.js     # Schema + trigger creation on first run
│   │   ├── MemoryDatastore.js        # All SQL queries + close() lifecycle method
│   │   └── SqliteNativeBinding.js    # Native .node binary resolver (src/ vs dist/)
│   ├── Tools/
│   │   ├── MemoryTool.js             # add, update, delete, get, list, search, topics
│   │   ├── DreamingTool.js           # dreaming tool with LLM workflow instructions
│   │   └── ToolDefinitions.js        # Tool registry
│   └── Utils/
│       └── Schemas.js                # Zod input schemas for all tools
├── dist/                             # Self-contained build output
│   ├── mcp.js                        # Bundled MCP server (esbuild)
│   ├── stats.js                      # Bundled CLI stats utility (esbuild)
│   └── better_sqlite3.node           # Native SQLite binary
├── test/
│   ├── unit.js                       # Unit tests
│   └── integration.js                # Integration tests — waits for process close before DB cleanup
├── build.cmd                         # Build & test script (Windows)
├── build.sh                          # Build & test script (Linux / macOS)
├── package.json
└── README.md
```

---

## See Also

- [mcp-memory-md](https://github.com/pavex/mcp-memory-md) — lightweight PHP alternative using a plain `.md` file; no database, easy to inspect and version-control.

---

## License

MIT
