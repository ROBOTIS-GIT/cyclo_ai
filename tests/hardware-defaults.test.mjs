import test from 'node:test';
import assert from 'node:assert/strict';
import {Client,InMemoryTransport} from '@modelcontextprotocol/client';
import {createProductsServer} from '../modules/dynamixel/server.mjs';
import {hardwareEnabled} from '../modules/hardware-mode.mjs';
import {TargetSession} from '../modules/dynamixel/selection.mjs';
import {fixture} from './fixtures/device.mjs';
import {configure} from '../modules/dynamixel/workflow.mjs';
async function client(t,server){const [a,b]=InMemoryTransport.createLinkedPair();await server.connect(b);const c=new Client({name:'no-hardware-default-test',version:'0.9.0'});await c.connect(a);t.after(()=>c.close());return c;}
test('default availability and explicit offline/legacy opt-outs',()=>{
 for(const flag of ['CYCLO_PRODUCTS_ENABLE_HARDWARE']){
  assert.equal(hardwareEnabled({},flag),true);assert.equal(hardwareEnabled({CYCLO_OFFLINE:'1',[flag]:'1'},flag),false);assert.equal(hardwareEnabled({[flag]:'0'},flag),false);
 }
});
for(const offline of [false,true])test(`products startup/docs/confirmation never touch injected provider; offline=${offline}`,async t=>{
 let calls=0;const provider={ports:async()=>{calls++;throw Error('TEST GUARD');},connect:async()=>{calls++;throw Error('TEST GUARD');}};
 const c=await client(t,await createProductsServer(offline?{CYCLO_OFFLINE:'1'}:{},{provider}));
 assert.equal((await c.callTool({name:'dynamixel_registry',arguments:{}})).structuredContent.hardwareEnabled,!offline);
 assert.equal((await c.callTool({name:'dynamixel_ports',arguments:{}})).isError,true);
 assert.equal((await c.callTool({name:'dynamixel_ports',arguments:{confirmed:true}})).isError,true,'offline gate or injected provider guard stops I/O');
 assert.equal(calls,offline?0:1);
});
test('multi-device selection picks exact candidate, not first responder, and rejects duplicate address',async()=>{
 const s=new TargetSession({});const bus={port:'/MOCK',allowScan:true,allowConfigure:true};
 const device=id=>({id,modelNumber:1200,firmwareVersion:52,baud:57600,protocol:2,identityComplete:true});
 const record=devices=>s.recordScan(bus,{complete:true,closureConfirmed:true,busReservationReleased:true,devices},async()=>{});
 const ticket=record([device(1),device(2),device(3)]);
 const args={scanId:ticket.scanId,candidateId:ticket.candidates[1].candidateId,name:'selected',confirmed:true,addressingVerified:true};
 assert.equal((await s.select(args)).id,2);
 const dup=record([device(1),device(1)]);await assert.rejects(s.select({...args,scanId:dup.scanId,candidateId:dup.candidates[0].candidateId,name:'ambiguous'}),/Ambiguous/);
});
test('multi-device LED only writes selected endpoint, secondary listeners and baud collisions stop writes',async()=>{
 const a=fixture(),b=fixture({state:{id:2}});const connect=async(baud,timeout,protocol)=>{
  const ca=await a.connect(baud,timeout,protocol),cb=await b.connect(baud,timeout,protocol);
  return {...ca,probe:async id=>id===2?cb.probe(id):ca.probe(id),ping:async id=>id===2?cb.ping(id):ca.ping(id),read:(id,...args)=>id===2?cb.read(id,...args):ca.read(id,...args),write:(id,...args)=>id===2?cb.write(id,...args):ca.write(id,...args),close:async()=>{await ca.close();await cb.close();}};
 };
 const r=await configure(connect,{model:1200,firmware:52,protocol:2,id:2,baud:57600,addressingVerified:true,changes:{led:1}});
 assert.equal(r.outcome,'verified',r.error);assert.equal(a.writes.length,0);assert.equal(b.writes.length,1);
 const occupied=await configure(connect,{model:1200,firmware:52,protocol:2,id:2,baud:57600,addressingVerified:true,changes:{id:1}});assert.equal(occupied.outcome,'not_written');assert.match(occupied.error,/occupied/);
 const secondary=fixture({state:{secondaryId:7}});const blocked=await configure(secondary.connect,{model:1200,firmware:52,id:1,baud:57600,addressingVerified:true,changes:{led:1}});assert.equal(blocked.outcome,'verified');assert.equal(secondary.writes.length,1);
 const f=fixture();const mixed=async(baud,...rest)=>{const c=await f.connect(baud,...rest);return baud===1000000?{...c,probe:async id=>({id,present:true})}:c;};
 const collision=await configure(mixed,{model:1200,firmware:52,id:1,baud:57600,addressingVerified:true,changes:{baud:1000000}});assert.equal(collision.outcome,'not_written');assert.match(collision.error,/Destination baud/);assert.equal(f.writes.length,0);
});
test('dual-axis peer resolution allows unrelated responders',async()=>{
 const s=new TargetSession({}),bus={port:'/MOCK',allowScan:true,allowConfigure:true};
 const axis=id=>({id,modelNumber:1090,firmwareVersion:52,baud:57600,protocol:2,identityComplete:true});
 const ticket=s.recordScan(bus,{complete:true,closureConfirmed:true,busReservationReleased:true,devices:[axis(1),axis(2),{...axis(9),modelNumber:1200}]},async()=>{});
 const selected=await s.select({scanId:ticket.scanId,candidateId:ticket.candidates[0].candidateId,name:'dual',confirmed:true,addressingVerified:true,peerIds:[2]});assert.deepEqual(selected.peerIds,[2]);
});
test('configured default-enabled products block missing confirmation and offline blocks confirmed calls before provider',async t=>{
 const {mkdtemp,writeFile,rm}=await import('node:fs/promises');const {join}=await import('node:path');const {tmpdir}=await import('node:os');
 const dir=await mkdtemp(join(tmpdir(),'cyclo-confirm-'));t.after(()=>rm(dir,{recursive:true,force:true}));const path=join(dir,'operator.json');
 await writeFile(path,JSON.stringify({allowPortDiscovery:true,buses:{bench:{port:'/MOCK-ONLY',allowScan:true,allowConfigure:true}},targets:{motor:{port:'/MOCK-ONLY',model:1200,firmware:52,id:1,baud:57600,protocol:2,addressingVerified:true,allowScan:true,allowConfigure:true}}}));
 for(const offline of [false,true]){
  let calls=0;const provider={ports:async()=>{calls++;return[];},connect:async()=>{calls++;throw Error('TEST GUARD');}};
  const c=await client(t,await createProductsServer({CYCLO_PRODUCTS_CONFIG:path,...(offline?{CYCLO_OFFLINE:'1'}:{})},{provider}));
  for(const [name,args]of [['dynamixel_ports',{}],['dynamixel_scan',{bus:'bench',ids:[1],bauds:[57600],protocols:[2],dryRun:false}],['dynamixel_configure',{target:'motor',changes:{led:1},dryRun:false}]]){
   const denied=await c.callTool({name,arguments:args});assert.equal(denied.isError,true);assert.match(denied.content[0].text,/confirmation/);
   if(offline){const blocked=await c.callTool({name,arguments:{...args,confirmed:true}});assert.equal(blocked.isError,true);assert.match(blocked.content[0].text,/disabled/);}
  }
  assert.equal(calls,0);
 }
});
test('baud reconnection to wrong model stops once without rewriting',async()=>{
 const f=fixture();let wrote=false;const connect=async(...args)=>{const c=await f.connect(...args);return {...c,write:async(...w)=>{await c.write(...w);wrote=true;},probe:async id=>wrote?{id,present:true,modelNumber:999,firmwareVersion:52}:c.probe(id),ping:async id=>wrote?{id,modelNumber:999,firmwareVersion:52}:c.ping(id)};};
 const result=await configure(connect,{model:1200,firmware:52,id:1,baud:57600,addressingVerified:true,changes:{baud:1000000}});assert.equal(result.outcome,'uncertain');assert.equal(f.writes.length,1);
});
test('default-enabled products support explicitly selected port without a global config unlock',async t=>{
 const f=fixture();const c=await client(t,await createProductsServer({}, {provider:f.provider,lease:async()=>({port:'/MOCK-ONLY',verify:async()=>{},release:async()=>true})}));
 const ports=await c.callTool({name:'dynamixel_ports',arguments:{confirmed:true}});assert.equal(ports.structuredContent.ports[0].path,'/MOCK-ONLY');
 const planned=await c.callTool({name:'dynamixel_scan',arguments:{port:'/MOCK-ONLY',ids:[1],bauds:[57600],protocols:[2]}});assert.equal(planned.structuredContent.executed,false);assert.equal(f.calls.length,0);
 const scan=await c.callTool({name:'dynamixel_scan',arguments:{port:'/MOCK-ONLY',ids:[1],bauds:[57600],protocols:[2],dryRun:false,confirmed:true}});const {scanId,candidates}=scan.structuredContent;
 const selected=await c.callTool({name:'dynamixel_select',arguments:{scanId,candidateId:candidates[0].candidateId,name:'motor',confirmed:true,addressingVerified:true}});assert.equal(selected.structuredContent.target.id,1);
 const write=await c.callTool({name:'dynamixel_write_item',arguments:{target:'motor',item:'Torque Enable',value:1,dryRun:false,confirmed:true}});assert.equal(write.structuredContent.outcome,'verified');assert.deepEqual(f.writes,[['write',1,64,1]]);
});
test('dual-axis cannot select itself as its peer',async()=>{
 const s=new TargetSession({}),bus={port:'/MOCK',allowScan:true,allowConfigure:true};
 const ticket=s.recordScan(bus,{complete:true,closureConfirmed:true,busReservationReleased:true,devices:[{id:1,modelNumber:1090,firmwareVersion:52,baud:57600,protocol:2,identityComplete:true}]},async()=>{});
 await assert.rejects(s.select({scanId:ticket.scanId,candidateId:ticket.candidates[0].candidateId,name:'self-peer',confirmed:true,addressingVerified:true,peerIds:[1]}),/peer endpoint/);
});
test('explicit operator policy cannot be bypassed with a dynamic alias port',()=>{
 const s=new TargetSession({buses:{readonly:{port:'/MOCK-CANONICAL',allowScan:true,allowConfigure:false}}},{dynamicPorts:false});
 for(const port of ['/MOCK-CANONICAL','/MOCK-ALIAS-OF-CANONICAL'])assert.throws(()=>s.resolve({port}),/operator policy/);
 assert.equal(s.resolve({bus:'readonly'}).allowConfigure,false);
});

test('known secondary listeners block only addressed RAM across earlier and later selections',async()=>{
 const base={port:'/MOCK',model:1200,firmware:52,id:1,baud:57600,protocol:2};const s=new TargetSession({targets:{a:base,b:{...base,id:7}}});
 const settle=value=>s.settle('a',{outcome:'verified',closureConfirmed:true,busReservationReleased:true,location:{id:1,baud:57600,protocol:2},effectItem:'Secondary ID',requested:value});
 settle(7);assert.throws(()=>s.assertWriteAddress(s.target('b'),{ram:true}),/secondary listeners/);s.assertWriteAddress(s.target('b'),{ram:false});s.assertWriteAddress(s.target('a'),{ram:true});
 s.targets.delete('b');const ticket=s.recordScan({port:'/MOCK',allowConfigure:true},{complete:true,closureConfirmed:true,busReservationReleased:true,devices:[{id:7,modelNumber:1200,firmwareVersion:52,baud:57600,protocol:2,identityComplete:true}]},async()=>{});
 await s.select({scanId:ticket.scanId,candidateId:ticket.candidates[0].candidateId,name:'later',confirmed:true,addressingVerified:true});assert.throws(()=>s.assertWriteAddress(s.target('later'),{ram:true}),/secondary listeners/);
 s.assertWriteAddress({...s.target('later'),baud:1000000},{ram:true});s.assertWriteAddress({...s.target('later'),protocol:1},{ram:true});settle(255);s.assertWriteAddress(s.target('later'),{ram:true});
});

test('known listeners use verified canonical bus binding across port aliases',()=>{
 const base={port:'/MOCK-A',canonicalPort:'/MOCK-CANONICAL',model:1200,firmware:52,id:1,secondaryId:7,baud:57600,protocol:2};const s=new TargetSession({targets:{a:base,b:{...base,port:'/MOCK-B',id:7,secondaryId:255}}});
 assert.throws(()=>s.assertWriteAddress(s.target('b'),{ram:true}),/secondary listeners/);s.assertWriteAddress(s.target('b'),{ram:false});
});
