import test from 'node:test';
import assert from 'node:assert/strict';
import {Adapter} from '../src/adapter.mjs';
import {Instruction} from '../../cyclo_firmware_sdk/dist/protocol.js';
import {mockBus,workflowConfig} from './fixtures/workflow.mjs';
const request={target:'bench',id:1,changes:{returnDelayTime:0,baudRate:2000000}};
const writes=bus=>bus.events.filter(x=>x.instruction===Instruction.DxlWrite);
test('one call configures RDT then baud with SDK packets, snapshot, close/reopen and verification',async()=>{
  const bus=mockBus();const result=await new Adapter(workflowConfig,bus.runner).call('cyclo_configure',request);
  assert.equal(result.data.outcome,'verified');assert.equal(result.data.snapshot.returnDelayTime,250);
  assert.deepEqual(result.data.changes.map(x=>[x.register,x.status]),[['returnDelayTime','verified'],['baudRate','verified']]);
  assert.deepEqual(writes(bus).map(x=>x.params),[[9,0,0],[8,0,4]]);
  assert.deepEqual(bus.events.filter(x=>x.open||x.close),[{open:1000000},{close:1000000},{open:2000000},{close:2000000}]);
});
test('lost acknowledgment resolved by readback never repeats write',async()=>{
  const bus=mockBus({missingAck:true});const result=await new Adapter(workflowConfig,bus.runner).call('cyclo_configure',request);
  assert.equal(result.data.outcome,'verified');assert.equal(writes(bus).length,2);assert.ok(result.data.changes.every(x=>x.writeStatusError));
});
test('baud lost after earlier success reports partial and probes both rates without retry',async()=>{
  const bus=mockBus({badBaud:true});const result=await new Adapter(workflowConfig,bus.runner).call('cyclo_configure',request);
  assert.equal(result.data.outcome,'partial');assert.deepEqual(result.data.recovery.map(x=>x.baud),[2000000,1000000]);assert.equal(writes(bus).length,2);
});
test('readback mismatch stops remaining writes with recovery evidence',async()=>{
  const bus=mockBus({ignoreWrite:true});const result=await new Adapter(workflowConfig,bus.runner).call('cyclo_configure',request);
  assert.equal(result.data.outcome,'unknown');assert.equal(writes(bus).length,1);assert.equal(result.data.changes[0].status,'verification_failed');assert.equal(result.data.recovery[0].registers.returnDelayTime,250);
});
test('torque and firmware mismatch block all writes; state read is one call',async()=>{
  for(const options of [{torque:1},{firmware:51},{model:1190}]){const bus=mockBus(options);const result=await new Adapter(workflowConfig,bus.runner).call('cyclo_configure',request);assert.equal(result.data.outcome,'not_written');assert.equal(writes(bus).length,0);}
  const bus=mockBus();const result=await new Adapter(workflowConfig,bus.runner).call('cyclo_device_state',{target:'bench',id:1});assert.equal(result.data.outcome,'read');assert.equal(result.data.identity.modelNumber,1200);assert.equal(writes(bus).length,0);
});
test('host exact-register grants cannot be widened via input or planning',async()=>{
  let calls=0;const config=structuredClone(workflowConfig);config.targets.bench.devices[0].writableRegisters=['led'];const adapter=new Adapter(config,async()=>calls++);
  for(const extra of [{},{approved:true},{dryRun:true}])await assert.rejects(adapter.call('cyclo_configure',{...request,...extra}));
  await assert.rejects(adapter.call('cyclo_configure',{target:'bench',id:1,changes:{torqueEnable:1}}));
  assert.equal(calls,0);
});
test('write process cancellation returns unknown and holds lock until closure',async()=>{
  let finish, started;const ready=new Promise(r=>started=r);const adapter=new Adapter(workflowConfig,()=>new Promise((_,reject)=>{finish=()=>reject(Error('cancelled after close'));started();}));
  const pending=adapter.call('cyclo_configure',request);
  await ready;
  await assert.rejects(adapter.call('cyclo_device_state',{target:'bench',id:1}),/already in progress/);finish();
  assert.equal((await pending).data.outcome,'unknown');
});
test('single-call serial scan returns valid identities and failed-rate evidence without writes',async()=>{
  const bus=mockBus();const result=await new Adapter(workflowConfig,bus.runner).call('cyclo_serial_scan',{target:'bench',ids:[1,4,5],bauds:[57600,1000000]});
  assert.equal(result.data.probes.length,6);assert.equal(result.data.probes.filter(x=>x.modelNumber===1200).length,3);assert.equal(writes(bus).length,0);
  assert.deepEqual(bus.events.filter(x=>x.open||x.close),[{open:57600},{close:57600},{open:1000000},{close:1000000}]);
});
test('invalid scan budget fails before any bus access',async()=>{
  let calls=0;const config=structuredClone(workflowConfig);config.targets.bench.timeoutMs=200;const adapter=new Adapter(config,async()=>calls++);
  await assert.rejects(adapter.call('cyclo_serial_scan',{target:'bench',ids:Array.from({length:16},(_,i)=>i),bauds:[1000000],budgetMs:12001}),/12000|large|<=/);assert.equal(calls,0);
});
test('documented 4 Mbps maps to index 6 and unchanged RAM skips writing',async()=>{
  const bus=mockBus();const adapter=new Adapter(workflowConfig,bus.runner);
  const result=await adapter.call('cyclo_configure',{target:'bench',id:1,changes:{led:0,baudRate:4000000}});
  assert.equal(result.data.outcome,'verified');assert.deepEqual(writes(bus).map(x=>x.params),[[8,0,6]]);assert.equal(result.data.changes[0].status,'unchanged');
});
test('missing ACK remains visible after failed baud reconnect/readback',async()=>{
  const bus=mockBus({missingAck:true,badBaud:true});const result=await new Adapter(workflowConfig,bus.runner).call('cyclo_configure',{target:'bench',id:1,changes:{baudRate:2000000}});
  assert.equal(result.data.outcome,'unknown');assert.match(result.data.changes[0].writeStatusError,/timeout/);assert.deepEqual(result.data.recovery.map(x=>x.baud),[2000000,1000000]);
});
test('unconfirmed closure preserves partial evidence and requested baud; never opens a second session',async()=>{
  const bus=mockBus({closeFailure:true});const result=await new Adapter(workflowConfig,bus.runner).call('cyclo_configure',request);
  assert.equal(result.data.outcome,'partial');assert.equal(result.data.baud,2000000);assert.equal(result.data.changes[0].status,'verified');assert.equal(result.data.snapshot.returnDelayTime,250);assert.deepEqual(result.data.cleanupErrors,['mock close failure']);assert.match(result.data.recoverySkipped,/no further session/);
  assert.deepEqual(bus.events.filter(x=>x.open).map(x=>x.open),[1000000]);assert.equal(writes(bus).length,2);assert.equal(bus.memory[9],0);assert.deepEqual(result.data.recovery,[]);
});
test('final cleanup failure keeps verified register evidence and does not reject the workflow',async()=>{
  const bus=mockBus({closeFailure:true});const result=await new Adapter(workflowConfig,bus.runner).call('cyclo_configure',{target:'bench',id:1,changes:{led:1}});
  assert.equal(result.data.outcome,'partial');assert.equal(result.data.changes[0].status,'verified');assert.equal(result.data.changes[0].observedRaw,1);assert.match(result.data.error,/closure/);assert.equal(bus.events.filter(x=>x.closeFailed).length,1);
});
test('forced child closure preserves completed bounded verification evidence',async()=>{
  const {captureJson}=await import('../src/process.mjs');const {fileURLToPath}=await import('node:url');
  const command=fileURLToPath(new URL('./fixtures/workflow-command.mjs',import.meta.url));
  const adapter=new Adapter(workflowConfig,(args,signal)=>captureJson(command,[...args,'--print-then-wait'],signal,250));
  const result=await adapter.call('cyclo_configure',{target:'bench',id:1,changes:{returnDelayTime:0}});
  assert.equal(result.data.outcome,'partial');assert.equal(result.data.changes[0].status,'verified');assert.equal(result.data.snapshot.returnDelayTime,250);assert.match(result.data.processError,/deadline/);assert.equal(result.busReservationReleased,true);
});
test('non-Error runner failure remains an actionable unknown outcome',async()=>{
  const result=await new Adapter(workflowConfig,async()=>{throw 'opaque failure';}).call('cyclo_configure',{target:'bench',id:1,changes:{led:1}});
  assert.equal(result.data.outcome,'unknown');assert.equal(result.data.error,'Execution failed');assert.equal(result.busReservationReleased,true);
});
