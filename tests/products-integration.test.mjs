import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {fileURLToPath} from 'node:url';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
async function client(t,fixture=false){
 const dir=await mkdtemp(join(tmpdir(),'cyclo-products-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const config=join(dir,'operator.json');await writeFile(config,JSON.stringify({allowPortDiscovery:true,targets:{synthetic:{port:'/MOCK-ONLY',model:1200,firmware:52,id:1,baud:57600,isolatedBus:true,allowScan:true,allowConfigure:true}}}));
 const path=fixture?'./products-fixture.mjs':'../modules/dynamixel/server.mjs';
 const c=new Client({name:'offline-products-test',version:'0.4.0'});
 const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL(path,import.meta.url))],stderr:'pipe',env:{CYCLO_PRODUCTS_ENABLE_HARDWARE:fixture?'1':'0',CYCLO_PRODUCTS_CONFIG:config}});
 let stderr='';transport.stderr.on('data',b=>stderr+=b);t.after(async()=>{await c.close();assert.equal(stderr,'');});await c.connect(transport);await c.listTools();return c;
}
test('default stdio: official routes/registry work; discovery and execution stay blocked',async t=>{
 const c=await client(t);
 const tools=(await c.listTools()).tools.map(t=>t.name).sort();assert.deepEqual(tools,['robotis_sources','dynamixel_registry','dynamixel_ports','dynamixel_scan','dynamixel_configure'].sort());
 for(const query of ['전류기반 위치제어','cascade','OMY','TurtleBot3','Zenoh','dynamixel_hardware_interface','DREAM','cyclo_control','physical_ai_tools']){
  const r=await c.callTool({name:'robotis_sources',arguments:{query}});assert.ok(r.structuredContent.sources.length>0,query);assert.equal(r.structuredContent.completePortfolio,false);
 }
 const unknown=await c.callTool({name:'robotis_sources',arguments:{query:'nonexistent-product-xyz'}});assert.equal(unknown.structuredContent.sources.length,0);
 const registry=await c.callTool({name:'dynamixel_registry',arguments:{}});assert.equal(registry.structuredContent.hardwareEnabled,false);
 const plan=await c.callTool({name:'dynamixel_configure',arguments:{target:'synthetic',changes:{id:7}}});assert.equal(plan.structuredContent.executed,false);assert.ok(plan.structuredContent.pending.includes('destination ID collision check'));
 for(const [name,args] of [['dynamixel_ports',{}],['dynamixel_scan',{target:'synthetic',ids:[1],bauds:[57600],dryRun:false}],['dynamixel_configure',{target:'synthetic',changes:{led:1},dryRun:false}]]){const r=await c.callTool({name,arguments:args});assert.equal(r.isError,true);assert.match(r.content[0].text,/disabled/);}
 const raw=await c.callTool({name:'dynamixel_configure',arguments:{target:'synthetic',changes:{address:64,value:1}}});assert.equal(raw.isError,true);
});
test('injected mock stdio: bounded scan, LED and new-ID readback',async t=>{
 const c=await client(t,true);
 const ports=await c.callTool({name:'dynamixel_ports',arguments:{}});assert.equal(ports.structuredContent.ports[0].path,'/MOCK-ONLY');
 const scan=await c.callTool({name:'dynamixel_scan',arguments:{target:'synthetic',ids:[1,2],bauds:[57600,1000000],dryRun:false}});assert.equal(scan.structuredContent.devices.length,1);assert.equal(scan.structuredContent.complete,true);
 const led=await c.callTool({name:'dynamixel_configure',arguments:{target:'synthetic',changes:{led:1},dryRun:false}});assert.equal(led.structuredContent.outcome,'verified');assert.equal(led.structuredContent.busReservationReleased,true);
 const id=await c.callTool({name:'dynamixel_configure',arguments:{target:'synthetic',changes:{id:7},dryRun:false}});assert.equal(id.structuredContent.outcome,'verified');assert.equal(id.structuredContent.location.id,7);
 const stale=await c.callTool({name:'dynamixel_configure',arguments:{target:'synthetic',changes:{led:0},dryRun:false}});assert.equal(stale.structuredContent.outcome,'not_written');
});
