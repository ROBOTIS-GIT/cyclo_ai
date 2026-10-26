#!/usr/bin/env node
// Integration code. Upstream sources remain unchanged; see UPSTREAM.json.
import * as z from 'zod/v4';
import { hardwareEnabled, requireConfirmation } from '../hardware-mode.mjs';
import { isAbsolute } from 'node:path';
import { stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './upstream/tools/cyclo_firmware_mcp/src/server.mjs';
import { Adapter, definitions, configSchema, loadConfig } from './upstream/tools/cyclo_firmware_mcp/src/adapter.mjs';
import { captureJson } from './upstream/tools/cyclo_firmware_mcp/src/process.mjs';

const disabled = async () => { throw new Error('Hardware and OS serial discovery are disabled by Cyclo Plugin. No port discovery, device access or CLI execution occurred.'); };

export async function createPluginServer(env = process.env) {
  const enabled = hardwareEnabled(env, 'CYCLO_PLUGIN_ENABLE_HARDWARE');
  const supplied = env.CYCLO_MCP_CONFIG ? await loadConfig(env.CYCLO_MCP_CONFIG) : configSchema.parse({});
  if (!enabled) {
    // Even upstream serial-ports bypasses allowHardwareReads; block it explicitly.
    return createServer({...supplied,allowHardwareReads:false},disabled,{list:disabled,resolve:disabled});
  }
  // Resolve the optional executor lazily: docs/listing/startup never run a CLI.
  const run = async (args,signal,onProgress) => {
    if (!env.CYCLO_PLUGIN_CLI_PATH || !isAbsolute(env.CYCLO_PLUGIN_CLI_PATH)) {
      throw new Error('Execution requires an absolute built upstream CLI path. No executor was started.');
    }
    if (!(await stat(env.CYCLO_PLUGIN_CLI_PATH)).isFile()) throw new Error('Configured upstream CLI must be a regular built file');
    return captureJson(env.CYCLO_PLUGIN_CLI_PATH,args,signal,15000,args[0]==='serial-scan'?512*1024:256*1024,{streamScan:args[0]==='serial-scan',onProgress});
  };
  return createGuardedFirmwareServer(supplied, run);

}

function createGuardedFirmwareServer(config, run) {
  const adapter = new Adapter(config,run,{list:signal=>run(['serial-ports'],signal),resolve:(port,signal)=>run(['serial-resolve','--port',port],signal)});
  const server = new McpServer({name:'cyclo-firmware',version:'0.9.0'});
  const result = value => ({content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value});
  server.registerTool('cyclo_capabilities',{description:'Report availability without hardware access.',inputSchema:z.strictObject({})},async()=>result(adapter.capabilities()));
  for (const [name,definition] of Object.entries(definitions)) {
    const fields={confirmed:z.boolean().default(false),...(name==='cyclo_serial_ports'?{}:{dryRun:z.boolean().default(true)})};
    server.registerTool(name,{description:definition.description+' Hardware calls require confirmed:true after user approval; dryRun defaults true.',inputSchema:definition.schema.safeExtend(fields),annotations:{readOnlyHint:!definition.write,destructiveHint:!!definition.write,idempotentHint:!definition.write,openWorldHint:true}},async(input,ctx)=>{
      try {
        const {confirmed,...args}=input;
        if(name==='cyclo_serial_ports'||!args.dryRun){requireConfirmation(confirmed);if(!config.allowHardwareReads)throw Error('Hardware access disabled by explicit operator policy; no executor or port access occurred');}
        // Upstream resolves dynamic ports before dryRun. Avoid that resolver
        // entirely for a device-free preview; no canonical binding is asserted.
        if(args.dryRun&&!args.target)return result({mode:'plan',executed:false,request:args,pending:['confirmed port binding','operator configuration','identity and register preconditions']});
        const value=await adapter.call(name,args,ctx.mcpReq.signal,progress=>{
          const token=ctx.mcpReq._meta?.progressToken??ctx.mcpReq.envelope?.progressToken;
          if(token!==undefined&&!ctx.mcpReq.signal.aborted)void ctx.mcpReq.notify({method:'notifications/progress',params:{progressToken:token,progress:progress.completed,total:progress.total,message:'Serial probes completed'}}).catch(()=>{});
        });
        return {...result(value),...((value.data?.error||value.busReservationReleased===false)?{isError:true}:{})};
      } catch(error) {return {isError:true,content:[{type:'text',text:error.message}]};}
    });
  }
  return server;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try { await serveStdio(() => createPluginServer()); }
  catch(error) { console.error(error instanceof Error ? error.message : 'Cyclo Plugin startup failed'); process.exitCode=1; }
}
