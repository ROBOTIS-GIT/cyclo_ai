import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {fileURLToPath} from 'node:url';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
async function client(t,fixture=false,{unknown=false,scenario=''}={}){
 const dir=await mkdtemp(join(tmpdir(),'cyclo-products-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const config=join(dir,'operator.json');await writeFile(config,JSON.stringify({allowPortDiscovery:true,buses:{bench:{port:'/MOCK-ONLY',allowScan:true,allowConfigure:true}},targets:unknown?{}:{synthetic:{port:'/MOCK-ONLY',model:1200,firmware:52,id:1,baud:57600,isolatedBus:true,allowScan:true,allowConfigure:true}}}));
 const path=fixture?'./products-fixture.mjs':'../modules/dynamixel/server.mjs';
 const c=new Client({name:'offline-products-test',version:'0.4.0'});
 const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL(path,import.meta.url))],stderr:'pipe',env:{CYCLO_PRODUCTS_ENABLE_HARDWARE:fixture?'1':'0',CYCLO_PRODUCTS_CONFIG:config,CYCLO_TEST_SCENARIO:scenario}});
 let stderr='';transport.stderr.on('data',b=>stderr+=b);t.after(async()=>{await c.close();assert.equal(stderr,'');});await c.connect(transport);await c.listTools();return c;
}
test('default stdio: official routes/registry work; discovery and execution stay blocked',async t=>{
 const c=await client(t);
 const tools=(await c.listTools()).tools.map(t=>t.name).sort();assert.deepEqual(tools,['robotis_sources','dynamixel_registry','dynamixel_ports','dynamixel_scan','dynamixel_configure','dynamixel_select','dynamixel_targets','dynamixel_models','dynamixel_manual','dynamixel_table','dynamixel_read_items','dynamixel_write_item'].sort());
 for(const query of ['current-based position','cascade','OMY','TurtleBot3','Zenoh','dynamixel_hardware_interface','DREAM','cyclo_control','physical_ai_tools']){
  const r=await c.callTool({name:'robotis_sources',arguments:{query}});assert.ok(r.structuredContent.sources.length>0,query);assert.equal(r.structuredContent.completePortfolio,false);
 }
 const unknown=await c.callTool({name:'robotis_sources',arguments:{query:'nonexistent-product-xyz'}});assert.equal(unknown.structuredContent.sources.length,0);
 const registry=await c.callTool({name:'dynamixel_registry',arguments:{}});assert.equal(registry.structuredContent.hardwareEnabled,false);
 const plan=await c.callTool({name:'dynamixel_configure',arguments:{target:'synthetic',changes:{id:7}}});assert.equal(plan.structuredContent.executed,false);assert.ok(plan.structuredContent.pending.includes('destination ID collision check'));
 for(const [name,args] of [['dynamixel_ports',{confirmed:true}],['dynamixel_scan',{target:'synthetic',ids:[1],protocols:[2],bauds:[57600],dryRun:false,confirmed:true}],['dynamixel_configure',{target:'synthetic',changes:{led:1},dryRun:false,confirmed:true}]]){const r=await c.callTool({name,arguments:args});assert.equal(r.isError,true);assert.match(r.content[0].text,/disabled/);}
 const raw=await c.callTool({name:'dynamixel_configure',arguments:{target:'synthetic',changes:{address:64,value:1}}});assert.equal(raw.isError,true);
});
test('injected mock stdio: bounded scan, LED and new-ID readback',async t=>{
 const c=await client(t,true);
 const ports=await c.callTool({name:'dynamixel_ports',arguments:{confirmed:true}});assert.equal(ports.structuredContent.ports[0].path,'/MOCK-ONLY');
 const scan=await c.callTool({name:'dynamixel_scan',arguments:{target:'synthetic',ids:[1,2],protocols:[2],bauds:[57600,1000000],dryRun:false,confirmed:true}});assert.equal(scan.structuredContent.devices.length,1);assert.equal(scan.structuredContent.complete,true);
 const led=await c.callTool({name:'dynamixel_configure',arguments:{target:'synthetic',changes:{led:1},dryRun:false,confirmed:true}});assert.equal(led.structuredContent.outcome,'verified');assert.equal(led.structuredContent.busReservationReleased,true);
 const id=await c.callTool({name:'dynamixel_configure',arguments:{target:'synthetic',changes:{id:7},dryRun:false,confirmed:true}});assert.equal(id.structuredContent.outcome,'verified');assert.equal(id.structuredContent.location.id,7);
 const next=await c.callTool({name:'dynamixel_configure',arguments:{target:'synthetic',changes:{led:0},dryRun:false,confirmed:true}});assert.equal(next.structuredContent.outcome,'verified');assert.equal(next.structuredContent.location.id,7);
});
test('novice stdio: unknown identity -> bounded scan -> confirmed selection -> ID/baud changes -> reuse',async t=>{
 const c=await client(t,true,{unknown:true});
 const call=(name,args)=>c.callTool({name,arguments:args});
 const plan=await call('dynamixel_scan',{bus:'bench',ids:[1,2],protocols:[2],bauds:[57600]});assert.equal(plan.structuredContent.executed,false);
 assert.deepEqual((await call('dynamixel_targets',{})).structuredContent.targets,[]);
 const result=await call('dynamixel_scan',{bus:'bench',ids:[1,2],protocols:[2],bauds:[57600],dryRun:false,confirmed:true});
 const {scanId,candidates}=result.structuredContent;assert.equal(candidates.length,1);
 const choice={scanId,candidateId:candidates[0].candidateId,name:'motor',confirmed:true,isolatedBus:true};
 const missing=await call('dynamixel_select',{...choice,confirmed:false});assert.equal(missing.isError,true);
 const selected=await call('dynamixel_select',choice);assert.equal(selected.structuredContent.target.id,1);
 await call('dynamixel_configure',{target:'motor',changes:{id:7}});
 assert.equal((await call('dynamixel_targets',{})).structuredContent.targets[0].id,1,'dry run must not move target');
 const changed=await call('dynamixel_configure',{target:'motor',changes:{id:7},dryRun:false,confirmed:true});assert.equal(changed.structuredContent.sessionTarget.id,7);
 const baud=await call('dynamixel_configure',{target:'motor',changes:{baud:1000000},dryRun:false,confirmed:true});assert.equal(baud.structuredContent.sessionTarget.baud,1000000);
 const led=await call('dynamixel_configure',{target:'motor',changes:{led:1},dryRun:false,confirmed:true});assert.equal(led.structuredContent.outcome,'verified');assert.deepEqual(led.structuredContent.location,{id:7,baud:1000000,protocol:2});
 assert.equal((await call('dynamixel_select',choice)).isError,true,'old observation cannot be reused');
});
for(const scenario of ['none','multiple','unsupported'])test(`novice ${scenario} discovery never silently configures`,async t=>{
 const c=await client(t,true,{unknown:true,scenario});const r=await c.callTool({name:'dynamixel_scan',arguments:{bus:'bench',ids:[1,2],protocols:[2],bauds:[57600],dryRun:false,confirmed:true}});
 const {scanId,candidates}=r.structuredContent;
 assert.equal(candidates.length,scenario==='none'?0:scenario==='multiple'?2:1);
 const selected=await c.callTool({name:'dynamixel_select',arguments:{scanId,candidateId:candidates[0]?.candidateId??'absent',name:'motor',confirmed:true,isolatedBus:true}});if(scenario==='multiple'){assert.equal(selected.isError,undefined);assert.equal(selected.structuredContent.target.id,1);}else {assert.equal(selected.isError,true);assert.deepEqual((await c.callTool({name:'dynamixel_targets',arguments:{}})).structuredContent.targets,[]);}
});
test('uncertain stdio write locks target and blocks subsequent write',async t=>{
 const c=await client(t,true,{scenario:'lost-write'});
 const r=await c.callTool({name:'dynamixel_configure',arguments:{target:'synthetic',changes:{id:7},dryRun:false,confirmed:true}});
 assert.equal(r.structuredContent.outcome,'uncertain');assert.equal(r.structuredContent.sessionTarget.status,'reconciliation-required');
 const next=await c.callTool({name:'dynamixel_configure',arguments:{target:'synthetic',changes:{led:1},dryRun:false,confirmed:true}});assert.equal(next.isError,true);assert.match(next.content[0].text,/reconciliation/);
});
test('occupied destination is not retargeted',async t=>{
 const c=await client(t,true,{scenario:'occupied'});
 const r=await c.callTool({name:'dynamixel_configure',arguments:{target:'synthetic',changes:{id:7},dryRun:false,confirmed:true}});
 assert.equal(r.structuredContent.outcome,'not_written');assert.equal(r.structuredContent.location.id,1);
 assert.equal(r.structuredContent.sessionTarget.id,1);assert.equal(r.structuredContent.sessionTarget.status,'reconciliation-required');
});
test('generic table stdio: explicit torque item writes use preview/confirmation and registered source metadata',async t=>{
 const c=await client(t,true);const table=await c.callTool({name:'dynamixel_table',arguments:{catalogId:'x_series/xl_series/xl330-m288',query:'Torque Enable'}});assert.equal(table.structuredContent.items[0].write.status,'resolved');
 const preview=await c.callTool({name:'dynamixel_write_item',arguments:{target:'synthetic',item:'Torque Enable',value:1}});assert.equal(preview.structuredContent.executed,false);
 const denied=await c.callTool({name:'dynamixel_write_item',arguments:{target:'synthetic',item:'Torque Enable',value:1,dryRun:false}});assert.equal(denied.isError,true);assert.match(denied.content[0].text,/confirmation/);
 const actual=await c.callTool({name:'dynamixel_write_item',arguments:{target:'synthetic',item:'Torque Enable',value:1,dryRun:false,confirmed:true}});assert.equal(actual.structuredContent.outcome,'verified');
 const read=await c.callTool({name:'dynamixel_read_items',arguments:{target:'synthetic',items:['Torque Enable'],dryRun:false,confirmed:true}});assert.equal(read.isError,undefined);assert.equal(read.structuredContent.items[0].value,1);
});
