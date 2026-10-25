import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG,MODELS,modelFor,encode,decode} from '../modules/dynamixel/registry.mjs';
import {configure,scan,validateRequest} from '../modules/dynamixel/workflow.mjs';
import {catalogDevice} from './fixtures/catalog-device.mjs';
const lookup=id=>MODELS.find(m=>m.catalogId.endsWith('/'+id));
for(const m of MODELS)test(`catalog engine ${m.catalogId}: identity, ID, baud and LED capability`,async()=>{
 const f=catalogDevice(m);const id=await configure(f.connect,{...f.request,changes:{id:7}});assert.equal(id.outcome,'verified',id.error);assert.equal(f.writes.length,1);assert.equal(f.writes[0].address,m.registers.ID.address);
 const b=catalogDevice(m),rate=b.request.baud===1000000?57600:1000000;
 const baud=await configure(b.connect,{...b.request,changes:{baud:rate}});assert.equal(baud.outcome,'verified',baud.error);assert.equal(b.writes[0].value,m.bauds[String(rate)]);
 const l=catalogDevice(m),cap=m.capabilities.led;
 const led=cap.channels?{red:32,green:64,blue:0}:cap.colorMask?{mask:3}:1;
 if(cap.status==='resolved'){
  const result=await configure(l.connect,{...l.request,changes:{led}});assert.equal(result.outcome,'verified',result.error);
  assert.ok(l.writes.every(w=>Object.values(m.registers).some(r=>r.name.startsWith('LED')&&r.address===w.address)));
 }else{await assert.rejects(configure(l.connect,{...l.request,changes:{led:1}}),/Capability led/);assert.equal(l.writes.length,0);}
 // An unrelated firmware number is not a global model rejection.
 const newer=catalogDevice(m,{firmware:99});assert.equal((await configure(newer.connect,{...newer.request,changes:{id:7}})).outcome,'verified');
});
for(const protocol of [1,2])test(`bounded Protocol ${protocol} discovery keeps identity and exact firmware address`,async()=>{
 const m=lookup(protocol===1?'ax-12a':'xl320'),f=catalogDevice(m,{protocol});
 const r=await scan(f.connect,{ids:[1,2],bauds:[f.request.baud],protocols:[protocol]});assert.equal(r.devices.length,1);assert.equal(r.devices[0].identityComplete,true);assert.equal(r.devices[0].firmwareVersion,52);assert.ok(f.calls.some(c=>c[0]==='read'&&c[2]===2&&c[3]===1));
});
test('every catalog entry has the same identity pipeline; reducers have no packet identity',()=>{
 assert.equal(MODELS.length,89);assert.equal(CATALOG.models.filter(m=>m.kind!=='actuator').length,3);
 for(const m of MODELS){assert.ok(m.registers['Model Number'].source.blobSha);assert.ok(m.protocolSources.length);assert.equal(modelFor(m.modelNumbers[0],70,m.catalogId,m.protocols[0]).catalogId,m.catalogId);}
 for(const number of [1070,1080,1270])assert.throws(()=>modelFor(number,52),/Ambiguous/);
 assert.equal(modelFor(29,40).registers['Firmware Version'].address,2);assert.equal(modelFor(30,40,undefined,1).registers['Firmware Version'].address,6);
 assert.equal(modelFor(350,52).protocol,2);assert.throws(()=>modelFor(4121,52),/Modbus/);assert.throws(()=>modelFor(9999,52),/Unknown/);assert.throws(()=>modelFor(12,undefined),/firmware/);assert.equal(modelFor(12,255).observedFirmware,255);
});
test('Protocol 1 presence remains visible when model READ is denied',async()=>{
 let writes=0;const c=async()=>({probe:async id=>({id,present:true}),read:async()=>{throw Error('Status Return Level prevents identity read');},write:async()=>writes++,close:async()=>{}});
 const r=await scan(c,{ids:[1],bauds:[57600],protocols:[1]});assert.equal(r.devices.length,1);assert.equal(r.devices[0].present,true);assert.equal(r.devices[0].identityComplete,false);assert.match(r.devices[0].identityError,/Status Return/);assert.equal(writes,0);
});
test('typed little-endian integer boundaries and signed representations',()=>{
 for(const size of [1,2,4]){const value=2**(size*8)-1;assert.equal(decode(encode(value,size)),value);assert.equal(decode(encode(-1,size,'twos-complement'),'twos-complement'),-1);assert.throws(()=>encode(value+1,size));}
 assert.deepEqual([...encode(0x12345678,4)],[0x78,0x56,0x34,0x12]);assert.throws(()=>encode(-1,2));assert.throws(()=>decode([1,2,3]));
});
test('backend destination baud preflight prevents stranding a device',async()=>{
 const m=lookup('xm430-w350'),f=catalogDevice(m,{unsupportedBaud:true});const r=await configure(f.connect,{...f.request,changes:{baud:4500000}});assert.equal(r.outcome,'not_written');assert.match(r.error,/Transport.*destination baud/);assert.equal(f.writes.length,0);
});
test('dual-axis peer requirement, peer torque and destination collision block writes',async()=>{
 const m=lookup('2xl430-w250');let f=catalogDevice(m);await assert.rejects(configure(f.connect,{...f.request,peerIds:[],changes:{id:7}}),/Dual-axis/);
 f=catalogDevice(m,{peerTorque:1});let r=await configure(f.connect,{...f.request,changes:{baud:1000000}});assert.equal(r.outcome,'not_written');assert.equal(f.writes.length,0);
 f=catalogDevice(m);r=await configure(f.connect,{...f.request,changes:{id:2}});assert.equal(r.outcome,'not_written');assert.match(r.error,/occupied/);assert.equal(f.writes.length,0);
});
for(const m of MODELS.filter(m=>m.capabilities.profile.status==='resolved'))test(`profile source template ${m.catalogId}: units, existing mode and firmware gates`,async()=>{
 const f=catalogDevice(m,{drive:4});let r=await configure(f.connect,{...f.request,changes:{profile:{mode:'time',totalMs:1000,accelerationMs:200}}});assert.equal(r.outcome,'verified',r.error);assert.ok(f.writes.every(w=>[m.registers['Profile Acceleration'].address,m.registers['Profile Velocity'].address].includes(w.address)));
 const v=catalogDevice(m);r=await configure(v.connect,{...v.request,changes:{profile:{mode:'velocity',rpm:10,accelerationRpm2:500,maxRpm:20,maxAccelerationRpm2:1000}}});assert.equal(r.outcome,'verified',r.error);
 const mismatch=catalogDevice(m);r=await configure(mismatch.connect,{...mismatch.request,changes:{profile:{mode:'time',totalMs:1000,accelerationMs:200}}});assert.equal(r.outcome,'not_written');assert.equal(mismatch.writes.length,0);assert.match(r.error,/Drive Mode/);
 const min=m.capabilities.profile.timeMinimumFirmware;if(min>0)assert.throws(()=>validateRequest({...f.request,firmware:min-1,changes:{profile:{mode:'time',totalMs:1000,accelerationMs:100}}}),/Firmware|firmware/);
});
test('unresolved profile metadata blocks that capability while ID still works',async()=>{
 for(const m of MODELS.filter(m=>m.capabilities.profile.status!=='resolved')){const f=catalogDevice(m);await assert.rejects(configure(f.connect,{...f.request,changes:{profile:{mode:'time',totalMs:1000,accelerationMs:100}}}),/Capability profile/);assert.equal(f.writes.length,0);}
});
test('RGB/mask color must be explicit and source-bounded',async()=>{
 for(const key of ['xl320','h54-200-s500-r','ph42-020-s300-r']){const m=lookup(key),f=catalogDevice(m);assert.throws(()=>validateRequest({...f.request,changes:{led:1}}),/color/);await assert.rejects(configure(f.connect,{...f.request,changes:{led:{red:256,green:0,blue:0}}}));assert.equal(f.writes.length,0);}
});
test('profile mode 5 uses caller applicability, not mere Operating Mode availability',async()=>{
 const m=lookup('xl330-m288'),f=catalogDevice(m);f.endpoints.get(1).set(m.registers['Operating Mode'].address,5);
 const r=await configure(f.connect,{...f.request,changes:{profile:{mode:'velocity',rpm:10,accelerationRpm2:500,maxRpm:20,maxAccelerationRpm2:1000}}});assert.equal(r.outcome,'not_written');assert.equal(f.writes.length,0);
 assert.ok(!m.capabilities.profile.operatingModes.includes(5));assert.ok(lookup('xm430-w350').capabilities.profile.operatingModes.includes(5));
});
test('every dual-axis endpoint must have inactive shadow ID and matching table identity',async()=>{
 for(const [name,value]of [['Secondary(Shadow) ID',1],['ID',9],['Protocol Type',1],['Baud Rate',0]]){
  const m=lookup('2xl430-w250'),f=catalogDevice(m);f.endpoints.get(2).set(m.registers[name].address,value);
  const r=await configure(f.connect,{...f.request,changes:{led:1}});assert.equal(r.outcome,'not_written');assert.equal(f.writes.length,0);
 }
});
