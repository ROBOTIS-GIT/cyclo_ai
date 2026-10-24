#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { Adapter, definitions, loadConfig, workflowDataSchema } from './adapter.mjs';

export function createServer(config, runner, serial) {
  const server = new McpServer({ name: 'cyclo-firmware', version: '0.1.0' });
  const adapter = new Adapter(config, runner, serial);
  const result = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value });
  server.registerTool('cyclo_capabilities', {
    description: 'Report adapter mode, configured target names and unsupported operations. Does not access hardware.',
    inputSchema: z.strictObject({}),
    outputSchema: z.strictObject({ policyMode:z.enum(['local','restricted']), mode: z.enum(['read-enabled', 'planning-only']), targets: z.array(z.string()), targetDetails: z.array(z.object({name:z.string(),transport:z.string(),baud:z.number(),allowScan:z.boolean(),busId:z.string().optional(),devices:z.array(z.object({id:z.number(),model:z.number(),firmware:z.number().optional(),writableRegisters:z.array(z.string())}))})), tools: z.array(z.string()), unavailable: z.array(z.string()), contract: z.string() }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => result(adapter.capabilities()));
  for (const [name, definition] of Object.entries(definitions)) {
    server.registerTool(name, {
      description: definition.description,
      inputSchema: definition.schema,
      outputSchema: z.strictObject({ mode: z.enum(['plan', 'result']), executed: z.boolean(), busReservationReleased: z.boolean().optional(), busReservationWarning: z.string().optional(), command: z.literal('cyclo-firmware').optional(), args: z.array(z.string()).optional(), data: (['cyclo_configure','cyclo_device_state'].includes(name) ? workflowDataSchema : z.unknown()).optional() }),
      annotations: { readOnlyHint: !definition.write, destructiveHint: !!definition.write, idempotentHint: !definition.write, openWorldHint: true },
    }, async (args, ctx) => {
      try { const value = await adapter.call(name, args, ctx.mcpReq.signal, progress => { const token=ctx.mcpReq._meta?.progressToken ?? ctx.mcpReq.envelope?.progressToken; if(token === undefined || ctx.mcpReq.signal.aborted) return; void ctx.mcpReq.notify({method:'notifications/progress',params:{progressToken:token,progress:progress.completed,total:progress.total,message:'Serial probes completed'}}).catch(()=>{}); }); return { ...result(value), ...((value.data && value.data.error) || value.busReservationReleased === false ? {isError:true} : {}) }; }
      catch (error) {
        return { isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : 'Operation failed' }] };
      }
    });
  }
  return server;
}

// Loading configuration fails closed before the transport starts.
if (import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const config = await loadConfig(process.env.CYCLO_MCP_CONFIG);
    await serveStdio(() => createServer(config));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'MCP startup failed');
    process.exitCode = 1;
  }
}
