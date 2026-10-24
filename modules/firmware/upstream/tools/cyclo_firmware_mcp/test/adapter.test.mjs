import test from 'node:test';
import assert from 'node:assert/strict';
import { Adapter, configSchema, definitions } from '../src/adapter.mjs';
const config = { targets: { bench: { transport: 'udp', host: 'bench-' + process.pid + '.invalid', allowScan: true } } };
test('optional planning returns real argv, never synthetic device results', async () => {
  let calls = 0; const adapter = new Adapter(config, async () => calls++);
  for (const [name, input] of Object.entries({ cyclo_ping: {id:1}, cyclo_read:{id:1,address:0,length:4}, cyclo_sync_read:{ids:[1,2],address:0,length:4}, cyclo_scan:{channels:[1]}, cyclo_bridge_profile:{id:200} })) {
    const result = await adapter.call(name, {target:'bench', dryRun:true, ...input});
    assert.equal(result.executed, false); assert.equal(result.mode,'plan'); assert.ok(result.args.length); assert.equal(result.data, undefined);
    assert.ok(!result.args.some(x => /write|reset|flash|entry/.test(x)));
  }
  assert.equal(calls, 0);
  await assert.rejects(adapter.call('cyclo_ping',{target:'bench',id:1,dryRun:false}),/disabled/);
});
test('strict inputs reject injection, self-approval, invalid ranges and reserved IDs', async () => {
  const adapter = new Adapter(config);
  for (const input of [{target:'bench',id:254},{target:'bench;sh',id:1},{target:'bench',id:1,allowHardwareReads:true},{target:'bench',id:1,command:'dxl-write'},{target:'bench',id:1,extraArgs:['--reset']},{target:'bench',id:1.1}]) await assert.rejects(adapter.call('cyclo_ping',input));
  await assert.rejects(adapter.call('cyclo_read',{target:'bench',id:1,address:65535,length:2}));
  await assert.rejects(adapter.call('cyclo_sync_read',{target:'bench',ids:[1,1],address:0,length:4}));
  await assert.rejects(adapter.call('cyclo_ping',{target:'unknown',id:1}), /Unknown/);
  await assert.rejects(adapter.call('constructor',{target:'bench',id:1}));
  assert.throws(() => configSchema.parse({targets:{bench:{transport:'udp',host:'--eval'}}}));
  assert.throws(() => configSchema.parse({targets:{bench:{transport:'udp',host:'a',port:'/dev/x'}}}));
});
test('execution requires host configuration, captures result and propagates abort signal', async () => {
  const controller = new AbortController(); let called;
  const adapter = new Adapter({...config,allowHardwareReads:true}, async (args,signal) => {called={args,signal};return {modelNumber:6030};});
  const result = await adapter.call('cyclo_ping',{target:'bench',id:1,dryRun:false},controller.signal);
  assert.equal(result.executed,true); assert.deepEqual(result.data,{modelNumber:6030}); assert.equal(called.signal,controller.signal); assert.equal(called.args[0],'dxl-ping');
  controller.abort(); await assert.rejects(adapter.call('cyclo_ping',{target:'bench',id:1,dryRun:false},controller.signal),/cancelled/);
});
test('no concurrent bus operations and lock releases on success or failure', async () => {
  let resolve, started; const ready = new Promise(r => {started=r;}); const adapter = new Adapter({...config,allowHardwareReads:true}, () => new Promise(r => {resolve=r;started();}));
  const call = adapter.call('cyclo_ping',{target:'bench',id:1,dryRun:false});
  await ready;
  await assert.rejects(adapter.call('cyclo_ping',{target:'bench',id:2,dryRun:false}),/already in progress/);
  resolve({}); await call;
  adapter.runner = async()=>{throw Error('fake disconnect');};
  await assert.rejects(adapter.call('cyclo_ping',{target:'bench',id:1,dryRun:false}),/disconnect/);
  adapter.runner = async()=>({});
  await adapter.call('cyclo_ping',{target:'bench',id:1,dryRun:false});
});
test('scan is separately scoped to fixed K1 ports and explicit transport', async () => {
  const adapter = new Adapter({targets:{bench:{transport:'udp',host:'127.0.0.1'}}});
  await assert.rejects(adapter.call('cyclo_scan',{target:'bench',channels:[1]}),/does not allow/);
  assert.equal(Object.keys(definitions).length,9);
});
