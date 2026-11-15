// Test harness runs outside the install ZIP; the server gets no development deps.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
const root = process.argv[2];
const version = JSON.parse(await readFile(join(root, 'plugin.json'), 'utf8')).version;
const manifests = [
  JSON.parse(await readFile(join(root, 'mcp.json'), 'utf8')).mcpServers,
  JSON.parse(await readFile(join(root, '.claude-plugin/plugin.json'), 'utf8')).mcpServers,
];
for (const [i, servers] of manifests.entries()) {
  assert.deepEqual(Object.keys(servers), ['cyclo-mcp']);
  const config = servers['cyclo-mcp'];
  const args = config.args.map((a) =>
    a.replaceAll(i ? '${CLAUDE_PLUGIN_ROOT}' : '${PLUGIN_ROOT}', root),
  );
  const env = Object.fromEntries(
    ['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'HOME']
      .filter((key) => process.env[key])
      .map((key) => [key, process.env[key]]),
  );
  Object.assign(env, config.env, { CYCLO_OFFLINE: '1', PYTHONDONTWRITEBYTECODE: '1' });
  const client = new Client({ name: 'install-zip-check', version: '0.2.1' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args,
    env,
    cwd: process.cwd(),
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr.on('data', (chunk) => (stderr += chunk));
  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion().name, 'cyclo-mcp');
    assert.equal(client.getServerVersion().version, version);
    assert.equal((await client.listTools()).tools.length, 19);
    const registry = await client.callTool({ name: 'dynamixel_registry', arguments: {} });
    assert.equal(registry.isError, undefined);
    assert.equal(registry.structuredContent.hardwareEnabled, false);
    const docs = await client.callTool({ name: 'robotis_sources', arguments: { query: 'XM430' } });
    assert.ok(docs.structuredContent.sources.length);
    const code = await client.callTool({
      name: 'robotis_code',
      arguments: { action: 'index', query: 'read' },
    });
    assert.ok(code.structuredContent.total > 0);
    const blocked = await client.callTool({
      name: 'dynamixel_ports',
      arguments: { confirmed: true },
    });
    assert.equal(blocked.isError, true);
    assert.equal(stderr, '');
  } finally {
    await client.close();
  }
}
console.log(
  'Both installed host declarations: initialize, 19 tools, source catalogs and offline guard passed.',
);
