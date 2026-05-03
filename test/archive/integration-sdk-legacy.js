/**
 * Integration test for mcp-memory-sqlite.
 * Runs twice: once for the SRC version and once for the DIST (bundled) version.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcServerPath = path.resolve(__dirname, '../src/mcp.js');
const distServerPath = path.resolve(__dirname, '../dist/mcp.js');
const dbPath = path.resolve(__dirname, 'test_memory.db');

async function runTestForServer(serverPath, label) {
  console.log(`\n🚀 Starting integration test for [${label}]: ${serverPath}`);

  // Cleanup old test DB
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  // Use StdioClientTransport directly with command/args
  const transport = new StdioClientTransport({
    command: 'node',
    args: [serverPath, dbPath],
    stderr: 'inherit'
  });

  const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });

  try {
    // 1. Connect client to server
    await client.connect(transport);
    console.log(` - [${label}] Client connected.`);

    // 2. List tools
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map(t => t.name);
    console.log(` - [${label}] Tools available: ${toolNames.join(', ')}`);
    assert.ok(toolNames.includes('add'));

    // 3. Test tool call: add
    const addRes = await client.callTool('add', { 
      content: `Test entry for ${label}`, 
      topic: 'integration-test' 
    });
    const addData = JSON.parse(addRes.content[0].text);
    assert.equal(addData.success, true);
    console.log(` - [${label}] Add tool check OK (ID: ${addData.id}).`);

    // 4. Test tool call: get
    const getRes = await client.callTool('get', { id: addData.id });
    const getData = JSON.parse(getRes.content[0].text);
    assert.equal(getData.memory.content, `Test entry for ${label}`);
    console.log(` - [${label}] Get tool check OK.`);

    console.log(`✅ [${label}] Integration test PASSED!`);
  } catch (err) {
    console.error(`❌ [${label}] Integration test FAILED!`);
    console.error(err);
    throw err;
  } finally {
    // Cleanup
    try { await client.close(); } catch (e) { /* ignore */ }
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  }
}

async function runAll() {
  try {
    await runTestForServer(srcServerPath, 'SRC VERSION');
    
    if (fs.existsSync(distServerPath)) {
      await runTestForServer(distServerPath, 'DIST VERSION');
    } else {
      console.warn('\n⚠️ DIST version (dist/mcp.js) not found. Skipping dist test.');
    }
    
    console.log('\n🌟 ALL INTEGRATION TESTS FINISHED SUCCESSFULLY!');
  } catch (err) {
    process.exit(1);
  }
}

runAll();
