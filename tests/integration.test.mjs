import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {fileURLToPath} from 'node:url';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const launcher=fileURLToPath(new URL('../modules/firmware/launch.mjs',import.meta.url));
const expected=['cyclo_capabilities','cyclo_serial_ports','cyclo_device_state','cyclo_configure','cyclo_serial_scan','cyclo_ping','cyclo_read','cyclo_sync_read','cyclo_scan','cyclo_bridge_profile'].sort();
for(const mode of ['legacy','auto'])test(`packaged launcher ${mode}: initialize/list/capabilities and no hardware access`,async()=>{
 const c=new Client({name:'cyclo-plugin-offline-test',version:'0.3.0'},{versionNegotiation:{mode}});
 const transport=new StdioClientTransport({command:process.execPath,args:[launcher],stderr:'pipe',env:{CYCLO_PLUGIN_ENABLE_HARDWARE:'0'}});
 let stderr='';transport.stderr.on('data',chunk=>stderr+=chunk);
 try {
  await c.connect(transport);
  const tools=await c.listTools();assert.deepEqual(tools.tools.map(t=>t.name).sort(),expected);
  const caps=await c.callTool({name:'cyclo_capabilities',arguments:{}});
  assert.equal(caps.structuredContent.mode,'planning-only');assert.deepEqual(caps.structuredContent.targets,[]);
  for(const name of ['cyclo_serial_ports','cyclo_device_state','cyclo_serial_scan']){
   const args=name==='cyclo_serial_ports'?{}:{port:'/dev/DO-NOT-OPEN-PROART',id:1};
   if(name==='cyclo_serial_scan')delete args.id;
   const r=await c.callTool({name,arguments:args});assert.equal(r.isError,true);
  }
  const forbidden=await c.callTool({name:'cyclo_configure',arguments:{target:'absent',id:1,changes:{torqueEnable:1}}});assert.equal(forbidden.isError,true);
  await assert.rejects(c.callTool({name:'flash_firmware',arguments:{}}));
  assert.equal(stderr,'');
 }finally{await c.close();}
});
test('configured dry-run uses upstream argv without a CLI/OS/device call',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'cyclo-planning-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const config=join(dir,'config.json');await writeFile(config,JSON.stringify({mode:'restricted',allowHardwareReads:true,targets:{fixture:{transport:'uart-rs485',port:'/tmp/CYCLO-MOCK-NOT-A-DEVICE',devices:[{id:1,model:1200,writableRegisters:['led']}]}}}));
 const c=new Client({name:'plan-test',version:'0.3.0'});
 const transport=new StdioClientTransport({command:process.execPath,args:[launcher],stderr:'pipe',env:{CYCLO_PLUGIN_ENABLE_HARDWARE:'0',CYCLO_MCP_CONFIG:config}});
 try{
  await c.connect(transport);await c.listTools();
  const p=await c.callTool({name:'cyclo_configure',arguments:{target:'fixture',id:1,changes:{led:1},dryRun:true}});
  assert.equal(p.structuredContent.mode,'plan');assert.equal(p.structuredContent.executed,false);assert.ok(p.structuredContent.args.includes('device-configure'));
  const refused=await c.callTool({name:'cyclo_configure',arguments:{target:'fixture',id:1,changes:{led:1}}});assert.equal(refused.isError,true);
 }finally{await c.close();}
});
