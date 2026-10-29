import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {fileURLToPath} from 'node:url';
for(const mode of ['legacy','auto'])test(`standalone products stdio ${mode}: documentation works offline; live I/O is blocked`,async()=>{
 const c=new Client({name:'standalone-test',version:'0.10.0'},{versionNegotiation:{mode}});
 const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../modules/dynamixel/server.mjs',import.meta.url))],stderr:'pipe',env:{CYCLO_OFFLINE:'1'}});
 let stderr='';transport.stderr.on('data',b=>stderr+=b);
 try{
  await c.connect(transport);const tools=(await c.listTools()).tools;assert.equal(tools.length,17);assert.ok(tools.some(t=>t.name==='dynamixel_swap_ids'));
  assert.equal((await c.callTool({name:'dynamixel_registry',arguments:{}})).structuredContent.hardwareEnabled,false);
  assert.equal((await c.callTool({name:'dynamixel_ports',arguments:{confirmed:true}})).isError,true);
  assert.equal((await c.callTool({name:'dynamixel_scan',arguments:{port:'/DO-NOT-OPEN',ids:[1],bauds:[6000000],protocols:[2],confirmed:true,dryRun:false}})).isError,true);
  assert.equal(stderr,'');
 }finally{await c.close();}
});
