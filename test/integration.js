/**
 * Raw JSON-RPC integration test for mcp-memory-sqlite.
 * No SDK on the client side — pure stdio piping.
 *
 * Shutdown strategy: close stdin instead of sending SIGTERM.
 * StdioServerTransport exits on EOF, which triggers process.on('exit') in
 * mcp.js and flushes the SQLite WAL before the process terminates.
 * We wait for the 'close' event before deleting the DB file so there are
 * no EBUSY errors on Windows.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTest(serverPath, label) {
  const dbPath = path.resolve(__dirname, `raw_test_${label}.db`);
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  return new Promise((resolve, reject) => {
    const server = spawn('node', [serverPath, dbPath]);
    let output = '';
    let errorOutput = '';
    const responses = [];

    server.stdout.on('data', (data) => {
      const str = data.toString();
      output += str;
      try {
        const lines = str.trim().split('\n');
        for (const line of lines) {
          if (line.trim()) responses.push(JSON.parse(line));
        }
      } catch (e) { /* ignore partial chunks */ }
    });

    server.stderr.on('data', (data) => { errorOutput += data.toString(); });

    const send = (msg) => server.stdin.write(JSON.stringify(msg) + '\n');

    // Close stdin → server gets EOF → exits cleanly → WAL flushed → safe to delete DB.
    const shutdown = () => new Promise((res) => {
      server.on('close', () => {
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
        res();
      });
      server.stdin.end();
    });

    // 1. Handshake
    send({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'raw-test', version: '1.0.0' }
      }
    });

    setTimeout(() => {
      send({ jsonrpc: '2.0', method: 'notifications/initialized' });

      // 2. Tool call
      setTimeout(() => {
        send({
          jsonrpc: '2.0', id: 2, method: 'tools/call',
          params: {
            name: 'add',
            arguments: { content: `Test entry for ${label}`, topic: 'integration' }
          }
        });

        // 3. Validate and shut down
        setTimeout(async () => {
          await shutdown();

          const initResp = responses.find(r => r.id === 1);
          const addResp  = responses.find(r => r.id === 2);
          const success  = initResp?.result?.protocolVersion &&
                           addResp?.result?.content?.[0]?.text?.includes('"success": true');

          if (success) {
            console.log(` ✓ Integration test (${label}) OK`);
            resolve();
          } else {
            console.error(` ✗ Integration test (${label}) FAILED`);
            console.error('--- STDOUT ---');
            console.error(output);
            console.error('--- STDERR ---');
            console.error(errorOutput);
            console.error('--- RESPONSES ---');
            console.error(JSON.stringify(responses, null, 2));
            reject(new Error(`Integration test ${label} failed`));
          }
        }, 500);
      }, 500);
    }, 500);
  });
}

const target     = process.argv[2] || 'src';
const serverFile = target === 'dist' ? '../dist/mcp.js' : '../src/mcp.js';
const serverPath = path.resolve(__dirname, serverFile);

runTest(serverPath, target).catch(() => process.exit(1));
