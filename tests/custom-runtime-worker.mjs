// Executed with an operator custom profile; in-memory devices only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Client,InMemoryTransport} from '@modelcontextprotocol/client';
import {createProductsServer} from '../modules/dynamixel/server.mjs';
import {modelFor,encode} from '../modules/dynamixel/registry.mjs';
import {writeItem,readItems} from '../modules/dynamixel/table.mjs';
import {swapIds} from '../modules/dynamixel/swap.mjs';
import {syncReadItems} from '../modules/dynamixel/group.mjs';
import {sdkProvider} from '../modules/dynamixel/provider.mjs';
import {chmod,writeFile,readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const target=id=>({port:'/MOCK',model:65000,firmware:6,id,baud:6000000,protocol:2,catalogId:'custom/synthetic',addressingVerified:true,allowScan:true,allowConfigure:true});
function bus({torque=0,failStage=0,ackLost=false}={}){
 const motors=new Map([2,5].map(id=>[id,new Map([[0,65000],[6,6],[7,id],[8,8],[52,id===2?433:-433],[512,torque],[513,0],[552,-2634]])]));
 const writes=[];let closes=0;
 const connect=async(baud,timeout,protocol)=>{
  assert.equal(baud,6000000);assert.equal(protocol,2);
  const ping=async id=>motors.has(id)?{id,modelNumber:65000,firmwareVersion:6}:null;
  return {ping,probe:ping,canBaud:async()=>true,
   syncRead:async(ids,address,width)=>ids.map(id=>({id,bytes:[...encode(motors.get(id).get(address)??0,width,address===52||address===552?'twos-complement':'unsigned')]})),
   read:async(id,address,width)=>{assert.ok(motors.has(id),'read missing motor');const value=motors.get(id).get(address)??0;return encode(value,width,value<0?'twos-complement':'unsigned');},
   write:async(id,address,bytes)=>{
    assert.ok(motors.has(id));writes.push([id,address,[...bytes]]);
    if(failStage===writes.length)throw Error('Injected pre-apply uncertainty');
    const value=bytes.reduce((n,b,i)=>n+b*2**(8*i),0),m=motors.get(id);m.set(address,value);
    if(address===7){assert.ok(!motors.has(value));motors.delete(id);motors.set(value,m);}
    if(ackLost)throw Error('ACK lost after application');
   },close:async()=>{closes++;}};
 };
 return {motors,writes,connect,get closes(){return closes;}};
}

test('custom profile is executable without inventing a bundled catalog identity',async()=>{
 const m=modelFor(65000,6,'custom/synthetic',2);assert.equal(m.registers['Torque Enable'].address,512);
 assert.throws(()=>modelFor(65000,7,'custom/synthetic',2),/Firmware/);
 const f=bus();const result=await readItems(f.connect,target(2),['Present Position','Homing Offset']);
 assert.equal(result.outcome,'read',result.error);assert.equal(result.items[0].value,-2634);assert.equal(result.items[1].value,433);assert.equal(result.closureConfirmed,true);
 const write=await writeItem(f.connect,target(2),'Homing Offset',-433);assert.equal(write.outcome,'verified',write.error);assert.equal(write.observed,-433);
 await assert.rejects(writeItem(f.connect,target(2),'Present Position',0),/read-only/);
});
test('custom torque preconditions and firmware bounds stop writes',async()=>{
 const f=bus({torque:1});const result=await writeItem(f.connect,target(2),'Homing Offset',0);
 assert.equal(result.outcome,'not_written');assert.equal(f.writes.length,0);
 await assert.rejects(readItems(f.connect,{...target(2),firmware:7},['Present Position']),/Firmware/);
});
test('native synchronized custom reads preserve signed values and reject mixed layout/bus',async()=>{
 const f=bus(),r=await syncReadItems(f.connect,[target(2),target(5)],'Homing Offset');
 assert.equal(r.outcome,'read',r.error);assert.deepEqual(r.items.map(i=>i.value),[433,-433]);assert.equal(r.closureConfirmed,true);assert.equal(f.writes.length,0);
 await assert.rejects(syncReadItems(f.connect,[target(2),target(2)],'Homing Offset'),/distinct/);
 await assert.rejects(syncReadItems(f.connect,[target(2),{...target(5),baud:1000000}],'Homing Offset'),/one selected/);
});
test('native swap preserves each motor offset, uses temporary ID and verifies lost ACK',async()=>{
 const f=bus({ackLost:true}),r=await swapIds(f.connect,target(2),target(5),250);
 assert.equal(r.outcome,'verified',r.error);assert.equal(r.stages.length,3);assert.equal(f.writes.length,3);assert.equal(f.motors.has(250),false);
 assert.equal(f.motors.get(5).get(52),433);assert.equal(f.motors.get(2).get(52),-433);assert.equal(r.closureConfirmed,true);
});
test('swap stops at first uncertain stage and preserves partial locations',async()=>{
 const f=bus({failStage:2}),r=await swapIds(f.connect,target(2),target(5),250);
 assert.equal(r.outcome,'uncertain');assert.equal(f.writes.length,2);assert.equal(f.motors.has(250),true);assert.equal(f.motors.has(2),false);assert.equal(f.motors.has(5),true);
});
test('swap rejects occupied temporary IDs, invalid mapping and torque-on without writes',async()=>{
 for(const temporaryId of[2,5,254]){const f=bus();await assert.rejects(swapIds(f.connect,target(2),target(5),temporaryId));assert.equal(f.writes.length,0);}
 const otherOn=bus();otherOn.motors.get(5).set(512,1);assert.equal((await swapIds(otherOn.connect,target(2),target(5),250)).outcome,'not_written');assert.equal(otherOn.writes.length,0);
 const f=bus({torque:1});assert.equal((await swapIds(f.connect,target(2),target(5),250)).outcome,'not_written');assert.equal(f.writes.length,0);
 const occupied=bus();occupied.motors.set(250,new Map(occupied.motors.get(2)));assert.equal((await swapIds(occupied.connect,target(2),target(5),250)).outcome,'not_written');assert.equal(occupied.writes.length,0);
});
test('MCP custom scan/select/table/read/write uses the standalone provider',async t=>{
 const f=bus();const server=await createProductsServer({}, {provider:{ports:async()=>[],connect:async(port,...args)=>f.connect(...args)},lease:async()=>({port:'/MOCK',verify:async()=>{},release:async()=>true})});
 const[a,b]=InMemoryTransport.createLinkedPair();await server.connect(b);const c=new Client({name:'custom',version:'1'});await c.connect(a);t.after(()=>c.close());
 const call=(name,args)=>c.callTool({name,arguments:args});
 const scan=await call('dynamixel_scan',{port:'/MOCK',catalogId:'custom/synthetic',ids:[2,5],bauds:[6000000],protocols:[2],dryRun:false,confirmed:true});
 assert.equal(scan.isError,undefined,JSON.stringify(scan));assert.equal(scan.structuredContent.candidates.length,2);
 const candidates=scan.structuredContent.candidates;
 const selected=await call('dynamixel_select',{scanId:scan.structuredContent.scanId,candidateId:candidates[0].candidateId,name:'custom',catalogId:'custom/synthetic',confirmed:true,addressingVerified:true});assert.equal(selected.isError,undefined,JSON.stringify(selected));
 const table=await call('dynamixel_table',{catalogId:'custom/synthetic',query:'Present Position'});assert.equal(table.structuredContent.items[0].address,552);
 const read=await call('dynamixel_read_items',{target:'custom',items:['Present Position'],dryRun:false,confirmed:true});assert.equal(read.structuredContent.items[0].value,-2634);
 const preview=await call('dynamixel_write_item',{target:'custom',item:'Homing Offset',value:-433});assert.equal(preview.structuredContent.executed,false);assert.equal(f.writes.length,0);
 const write=await call('dynamixel_write_item',{target:'custom',item:'Homing Offset',value:-433,dryRun:false,confirmed:true});assert.equal(write.structuredContent.outcome,'verified',JSON.stringify(write));
});
test('Node provider and independent Python bridge agree on custom hash and signed writes at 6 Mbps',async()=>{
 const root=fileURLToPath(new URL('..',import.meta.url)),python=join(dirname(process.env.CYCLO_PRODUCTS_CUSTOM_TABLES),'mock-bridge-python');
 const source=`#!/usr/bin/env python3
import importlib.util
spec=importlib.util.spec_from_file_location('packets',${JSON.stringify(join(root,'validation/test_sdk_packets.py'))})
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Port(m.FakePort):
 def __init__(self,name):
  super().__init__(name)
  self.model=65000;self.firmware=6;self.baudrate=6000000
  self.values.update({0:[232,253],6:[6],7:[2],8:[8],512:[0],52:[0]*4,552:[246,255,255,255]})
m.api.PortHandler=Port
m.bridge.sdk=lambda:m.api
m.bridge.main()
`;
 await writeFile(python,source);await chmod(python,0o700);
 const p=await sdkProvider({CYCLO_PRODUCTS_PYTHON:python,CYCLO_PRODUCTS_CUSTOM_TABLES:process.env.CYCLO_PRODUCTS_CUSTOM_TABLES});
 const connect=(baud,timeout,protocol)=>p.connect('/MOCK',baud,timeout,protocol);
 const read=await readItems(connect,target(2),['Present Position']);assert.equal(read.outcome,'read',read.error);assert.equal(read.items[0].value,-10);
 const write=await writeItem(connect,target(2),'Homing Offset',-433);assert.equal(write.outcome,'verified',write.error);assert.equal(write.observed,-433);assert.equal(write.closureConfirmed,true);
});

test('MCP swap checks confirmation, restores only verified handles and blocks uncertain partial state',async t=>{
 const directory=dirname(process.env.CYCLO_PRODUCTS_CUSTOM_TABLES),config=join(directory,'operator.json');
 await writeFile(config,JSON.stringify({targets:{a:target(2),b:target(5)}}));
 for(const failed of[false,true]){
  const f=bus(failed?{failStage:2}:{});let released=0;
  const server=await createProductsServer({CYCLO_PRODUCTS_CONFIG:config},{provider:{connect:async(port,...args)=>f.connect(...args)},lease:async()=>({port:'/MOCK',verify:async()=>{},release:async()=>{released++;return true;}})});
  const[a,b]=InMemoryTransport.createLinkedPair();await server.connect(b);const c=new Client({name:'swap',version:'1'});await c.connect(a);t.after(()=>c.close());
  const args={targetA:'a',targetB:'b',temporaryId:250};
  const call=(name,args)=>c.callTool({name,arguments:args});
  const preview=await call('dynamixel_swap_ids',args);assert.equal(preview.structuredContent.executed,false);assert.equal(f.writes.length,0);
  assert.equal((await call('dynamixel_swap_ids',{...args,dryRun:false})).isError,true);assert.equal(f.writes.length,0);
  const r=await call('dynamixel_swap_ids',{...args,dryRun:false,confirmed:true});assert.equal(r.structuredContent.outcome,failed?'uncertain':'verified',JSON.stringify(r));assert.equal(released,1);
  const targets=(await call('dynamixel_targets',{})).structuredContent.targets;
  if(failed)assert.ok(targets.every(x=>x.status==='reconciliation-required'));
  else{assert.equal(targets[0].id,5);assert.equal(targets[1].id,2);assert.ok(targets.every(x=>x.status==='ready'));}
 }
});

test('editing a custom contract after Node startup blocks bridge writes until reload',async()=>{
 const path=process.env.CYCLO_PRODUCTS_CUSTOM_TABLES,original=await readFile(path,'utf8');
 try{
  const changed=JSON.parse(original);changed.models[0].items.find(i=>i.name==='Homing Offset').write.bounds=[-1000,1000];await writeFile(path,JSON.stringify(changed));
  const python=join(dirname(path),'mock-bridge-python'),provider=await sdkProvider({CYCLO_PRODUCTS_PYTHON:python,CYCLO_PRODUCTS_CUSTOM_TABLES:path});
  const result=await writeItem((baud,timeout,protocol)=>provider.connect('/MOCK',baud,timeout,protocol),target(2),'Homing Offset',-433);
  assert.equal(result.outcome,'not_written');assert.match(result.error,/hash\/firmware changed/);assert.equal(result.closureConfirmed,true);
 }finally{await writeFile(path,original);}
});
