/**
 * Lightweight stdio MCP server — zero dependencies except better-sqlite3.
 *
 * Implements JSON-RPC 2.0 over stdin/stdout per MCP spec 2025-03-26.
 * Handles: initialize, initialized, tools/list, tools/call, ping.
 */

export class McpStdioServer {
  #name;
  #version;
  #tools = new Map();   // name → { description, inputSchema, handler }
  #buffer = '';

  constructor(name, version) {
    this.#name = name;
    this.#version = version;
  }

  /** Register a tool.
   * @param {string} name
   * @param {string} description
   * @param {object} inputSchema  Plain JSON Schema object
   * @param {function} handler    (args) => { content: [...] }
   */
  tool(name, description, inputSchema, handler) {
    this.#tools.set(name, { description, inputSchema, handler });
    return this;
  }

  /** Start listening on stdin/stdout. */
  start() {
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      this.#buffer += chunk;
      let nl;
      while ((nl = this.#buffer.indexOf('\n')) !== -1) {
        const line = this.#buffer.slice(0, nl).trim();
        this.#buffer = this.#buffer.slice(nl + 1);
        if (line) this.#handleLine(line);
      }
    });
    process.stdin.on('end', () => process.exit(0));
  }

  #handleLine(line) {
    let msg;
    try { msg = JSON.parse(line); }
    catch { return; } // ignore malformed

    // Notifications (no id) — no response needed
    if (msg.id === undefined || msg.id === null) {
      return; // initialized, cancelled, etc.
    }

    try {
      const result = this.#dispatch(msg);
      this.#send({ jsonrpc: '2.0', id: msg.id, result });
    } catch (e) {
      this.#send({
        jsonrpc: '2.0', id: msg.id,
        error: { code: e.code ?? -32603, message: e.message ?? String(e) },
      });
    }
  }

  #dispatch(msg) {
    switch (msg.method) {
      case 'initialize':
        return {
          protocolVersion: '2025-03-26',
          capabilities: { tools: {} },
          serverInfo: { name: this.#name, version: this.#version },
        };

      case 'ping':
        return {};

      case 'tools/list':
        return {
          tools: [...this.#tools.entries()].map(([name, t]) => ({
            name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        };

      case 'tools/call': {
        const { name, arguments: args = {} } = msg.params ?? {};
        const tool = this.#tools.get(name);
        if (!tool) throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32601 });
        return tool.handler(args);
      }

      default:
        throw Object.assign(new Error(`Method not found: ${msg.method}`), { code: -32601 });
    }
  }

  #send(obj) {
    process.stdout.write(JSON.stringify(obj) + '\n');
  }
}
