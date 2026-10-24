#!/usr/bin/env node
// Integration code. Upstream sources remain unchanged; see UPSTREAM.json.
import { isAbsolute } from 'node:path';
import { stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './upstream/tools/cyclo_firmware_mcp/src/server.mjs';
import { configSchema, loadConfig } from './upstream/tools/cyclo_firmware_mcp/src/adapter.mjs';
import { captureJson } from './upstream/tools/cyclo_firmware_mcp/src/process.mjs';

const disabled = async () => { throw new Error('Hardware and OS serial discovery are disabled by Cyclo Plugin. No port discovery, device access or CLI execution occurred.'); };

export async function createPluginServer(env = process.env) {
  const enabled = env.CYCLO_PLUGIN_ENABLE_HARDWARE === '1';
  const supplied = env.CYCLO_MCP_CONFIG ? await loadConfig(env.CYCLO_MCP_CONFIG) : configSchema.parse({mode:'restricted',allowHardwareReads:false,targets:{}});
  if (!enabled) {
    // Even upstream serial-ports bypasses allowHardwareReads; block it explicitly.
    return createServer({...supplied,allowHardwareReads:false},disabled,{list:disabled,resolve:disabled});
  }
  if (!env.CYCLO_MCP_CONFIG || !env.CYCLO_PLUGIN_CLI_PATH || !isAbsolute(env.CYCLO_PLUGIN_CLI_PATH)) {
    throw new Error('Hardware enablement requires an explicit operator config and absolute built upstream CLI path. No executor was started.');
  }
  if (!(await stat(env.CYCLO_PLUGIN_CLI_PATH)).isFile()) throw new Error('Configured upstream CLI must be a regular built file');
  const cli = env.CYCLO_PLUGIN_CLI_PATH;
  const run = (args,signal,onProgress) => captureJson(cli,args,signal,15000,args[0]==='serial-scan'?512*1024:256*1024,{streamScan:args[0]==='serial-scan',onProgress});
  return createServer(supplied,run,{list:signal=>run(['serial-ports'],signal),resolve:(port,signal)=>run(['serial-resolve','--port',port],signal)});
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try { await serveStdio(() => createPluginServer()); }
  catch(error) { console.error(error instanceof Error ? error.message : 'Cyclo Plugin startup failed'); process.exitCode=1; }
}
