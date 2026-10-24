import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,symlink,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Adapter,configSchema} from '../src/adapter.mjs';
import {mockBus} from './fixtures/workflow.mjs';
import {listSerialPorts,resolveSerialPort} from '../../cyclo_firmware_sdk/dist/serial-discovery.js';
import {scanSerialDevices} from '../../cyclo_firmware_sdk/dist/device-workflow.js';
// /dev/zero is only a fake catalog entry; injected packet transport never opens it.
const catalog = async()=>[{path:'/dev/zero',vendorId:'1234',productId:'5678',serialNumber:'mock-only'}];
const serial={list:async()=>({ports:await listSerialPorts(catalog)}),resolve:port=>resolveSerialPort(port,catalog)};
test('empty local config permits dynamic new ID state and named writes in one call',async()=>{
  const bus=mockBus();const adapter=new Adapter({},bus.runner,serial);
  assert.equal(adapter.capabilities().policyMode,'local');
  assert.equal((await adapter.call('cyclo_serial_ports',{})).data.ports[0].serialNumber,'mock-only');
  assert.equal(bus.events.length,0);
  const read=await adapter.call('cyclo_device_state',{port:'/dev/zero',id:7});
  assert.equal(read.data.identity.id,7);assert.equal(read.data.outcome,'read');
  const write=await adapter.call('cyclo_configure',{port:'/dev/zero',id:7,changes:{returnDelayTime:0,baudRate:2000000}});
  assert.equal(write.data.outcome,'verified');assert.equal(write.data.snapshot.returnDelayTime,250);
  assert.deepEqual(write.data.changes.map(x=>x.status),['verified','verified']);
});
test('actual unsupported model refuses dynamic writes before register access',async()=>{
  const bus=mockBus({model:6030});const result=await new Adapter({},bus.runner,serial).call('cyclo_configure',{port:'/dev/zero',id:77,changes:{led:1}});
  assert.equal(result.data.outcome,'not_written');assert.equal(result.data.identity.modelNumber,6030);assert.match(result.data.error,/observed ID77|observed ID 77/);
  assert.equal(bus.events.filter(x=>x.instruction===3||x.instruction===2).length,0);
});
test('OS enumeration reports identity/permissions and aliases resolve; nonserial and absent paths refuse',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'cyclo-local-'));
  try {
    const alias=join(dir,'alias');await symlink('/dev/zero',alias);
    assert.equal((await resolveSerialPort(alias,catalog)).canonicalPath,'/dev/zero');
    const file=join(dir,'file');await writeFile(file,'');
    await assert.rejects(resolveSerialPort(file,async()=>[{path:file}]),/serial device/);
    await assert.rejects(resolveSerialPort('/dev/full',catalog),/serial device/);
    await assert.rejects(resolveSerialPort(join(dir,'absent'),catalog),/absent/);
    await assert.rejects(resolveSerialPort('--eval',catalog),/absolute/);
    const ports=await listSerialPorts(catalog);assert.equal(ports[0].permission,'read_write');assert.equal(ports[0].vendorId,'1234');
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('legacy config retains restricted grants; local policy is explicit and endpoint arguments unambiguous',async()=>{
  assert.throws(()=>configSchema.parse(null));
  assert.equal(configSchema.parse({targets:{}}).mode,'restricted');assert.equal(configSchema.parse({targets:{}}).allowHardwareReads,false);
  assert.equal(configSchema.parse({mode:'local',targets:{}}).allowHardwareReads,true);
  const restricted=new Adapter({mode:'restricted',allowHardwareReads:true},()=>assert.fail('must not launch'),serial);
  await assert.rejects(restricted.call('cyclo_device_state',{port:'/dev/zero',id:7}),/restricted/);
  const local=new Adapter({},()=>assert.fail('must not launch'),serial);
  await assert.rejects(local.call('cyclo_ping',{port:'/dev/zero',target:'x',id:7}),/exactly one/);
  await assert.rejects(local.call('cyclo_ping',{id:7}),/exactly one/);
  await assert.rejects(local.call('cyclo_configure',{port:'/dev/zero',id:7,changes:{torqueEnable:1}}));
});
test('scan accepts full practical ranges and returns budget/cancel progress with closure',async()=>{
  const bus=mockBus();const adapter=new Adapter({},bus.runner,serial);
  const result=await adapter.call('cyclo_serial_scan',{port:'/dev/zero',minId:0,maxId:40,bauds:[1000000]});
  assert.equal(result.data.completed,41);assert.equal(result.data.total,41);assert.equal(result.data.complete,true);
  const limited=await scanSerialDevices(bus.connect,Array.from({length:253},(_,i)=>i),[57600],20,{budgetMs:60});
  assert.equal(limited.complete,false);assert.equal(limited.stopped,'budget_exhausted');assert.ok(limited.probes.length>0);assert.ok(limited.probes.length<253);
  const controller=new AbortController();let progress=0;
  const cancelled=await scanSerialDevices(bus.connect,[1,2,3],[1000000],20,{signal:controller.signal,onProgress:()=>{progress++;controller.abort();}});
  assert.equal(progress,1);assert.equal(cancelled.completed,1);assert.equal(cancelled.stopped,'cancelled');
  assert.equal(bus.events.at(-1).close,1000000);
  await assert.rejects(adapter.call('cyclo_serial_scan',{port:'/dev/zero',minId:5,maxId:4}));
  await assert.rejects(adapter.call('cyclo_serial_scan',{port:'/dev/zero',ids:[1],minId:0}));
});

test('scan callback failure retains actual counts and closes session',async()=>{
  const bus=mockBus();const result=await scanSerialDevices(bus.connect,[1,2],[1000000],20,{onProgress:()=>{throw Error('progress failed');}});
  assert.equal(result.completed,1);assert.equal(result.total,2);assert.equal(result.probes.length,1);assert.match(result.stopped,/progress failed/);assert.equal(bus.events.at(-1).close,1000000);
});

test('scan process cancellation preserves checkpoints even when next ping outlasts kill grace',async()=>{
  const {captureJson}=await import('../src/process.mjs');
  const {fileURLToPath}=await import('node:url');
  const controller=new AbortController();let progress=0;
  const start=performance.now();
  await assert.rejects(captureJson(fileURLToPath(new URL('./fixtures/workflow-command.mjs',import.meta.url)),['serial-scan','--ids','7,8,9','--bauds','1000000','--scan-delay'],controller.signal,15000,512*1024,{streamScan:true,onProgress:()=>{progress++;controller.abort();}}),error=>{
    assert.equal(error.evidence.completed,1);assert.equal(error.evidence.total,3);assert.equal(error.evidence.probes[0].id,7);assert.equal(error.evidence.complete,false);return true;
  });
  assert.equal(progress,1);assert.ok(performance.now()-start>=200);
});
test('failed scan rate checkpoint remains in later interruption evidence',async()=>{
  const events=[];const bus=mockBus();
  const result=await scanSerialDevices(async baud=>{if(baud===57600)throw Error('connection failed');return bus.connect(baud);},[1,2],[57600,1000000],20,{onProgress:(completed,total,probe)=>events.push({completed,total,probe})});
  assert.equal(events[0].completed,2);assert.equal(events[0].probe.outcome,'connection_failed');assert.equal(result.completed,4);
});

test('maximum scan checkpoint stream fits bounded cap and returns all1771 probes',async()=>{
  const {captureJson}=await import('../src/process.mjs');const {fileURLToPath}=await import('node:url');
  const result=await captureJson(fileURLToPath(new URL('./fixtures/workflow-command.mjs',import.meta.url)),['--bulk-scan'],undefined,15000,512*1024,{streamScan:true});
  assert.equal(result.probes.length,1771);assert.equal(result.complete,true);
});
test('dynamic selected alias/binding changes refuse before launch',async()=>{
  const {acquireBusLease}=await import('../src/bus-lease.mjs');
  const dir=await mkdtemp(join(tmpdir(),'cyclo-binding-'));const alias=join(dir,'port');
  try {
    await symlink('/dev/full',alias);
    const lease=await acquireBusLease({port:'/dev/full',dynamic:true,selectedAlias:alias});
    try {await rm(alias);await symlink('/dev/random',alias);await assert.rejects(lease.verify(),/alias changed/);}finally{await lease.release();}
    await assert.rejects(acquireBusLease({port:'/dev/full',dynamic:true,selection:{dev:'-1',ino:'-1',rdev:'-1',ctimeNs:'-1'}}),/changed after discovery/);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('failed-rate progress callback error returns bounded accumulated evidence',async()=>{
 const result=await scanSerialDevices(async()=>{throw Error('connection failed');},[1,2],[57600,1000000],20,{onProgress:()=>{throw Error('notify failed');}});
 assert.equal(result.completed,2);assert.equal(result.total,4);assert.equal(result.probes.length,1);assert.match(result.stopped,/notify failed/);
});
