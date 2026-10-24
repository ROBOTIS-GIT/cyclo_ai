import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { captureJson } from '../src/process.mjs';
const fixture=fileURLToPath(new URL('./fixtures/cli.mjs',import.meta.url));
test('subprocess captures JSON, keeps args literal and strips NODE_OPTIONS',async()=>{
  const previous=process.env.NODE_OPTIONS;
  process.env.NODE_OPTIONS='--invalid-inherited-option';
  try{assert.deepEqual(await captureJson(fixture,['ok','; echo unsafe']),{args:['; echo unsafe'],nodeOptions:null});}
  finally{if(previous===undefined)delete process.env.NODE_OPTIONS;else process.env.NODE_OPTIONS=previous;}
});
test('subprocess bounds output and deadline, rejects invalid JSON and redacts stderr',async()=>{
  await assert.rejects(captureJson(fixture,['invalid']),/invalid JSON/);
  await assert.rejects(captureJson(fixture,['error']),e=>!e.message.includes('sensitive')&&/CLI operation failed/.test(e.message));
  await assert.rejects(captureJson(fixture,['large'],undefined,1000,100),/output exceeded/);
  await assert.rejects(captureJson(fixture,['wait'],undefined,50),/deadline/);
});
test('subprocess request cancellation terminates pending read',async()=>{
  const controller=new AbortController();const result=captureJson(fixture,['wait'],controller.signal);
  setTimeout(()=>controller.abort(),50);
  await assert.rejects(result,/cancelled/);
});
test('deadline waits for child close even when SIGTERM is ignored',async()=>{
  const start=performance.now();
  await assert.rejects(captureJson(fixture,['ignore-term'],undefined,150),/deadline/);
  assert.ok(performance.now()-start >= 300);
});
