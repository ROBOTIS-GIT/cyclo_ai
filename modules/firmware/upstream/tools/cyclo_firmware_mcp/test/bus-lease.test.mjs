import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,symlink,unlink,stat,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Adapter} from '../src/adapter.mjs';
import {acquireBusLease} from '../src/bus-lease.mjs';
const holder=fileURLToPath(new URL('./fixtures/lease-holder.mjs',import.meta.url));
async function fixture(t) {
  const directory=await mkdtemp('/tmp/cyclo-bus-test-');
  const port=join(directory,'port'), alias=join(directory,'alias'), alternate=join(directory,'other');
  await writeFile(port,'');await writeFile(alternate,'');await symlink(port,alias);
  t.after(()=>rm(directory,{recursive:true,force:true}));
  return {directory,port,alias,alternate,config:path=>({allowHardwareReads:true,targets:{bench:{transport:'uart-rs485',port:path}}})};
}
async function heldChild(t,path,env={}) {
  const child=spawn(process.execPath,[holder,path],{env:{...process.env,...env},stdio:['pipe','pipe','pipe']});
  let text='';await new Promise((resolve,reject)=>{
    child.stdout.on('data',chunk=>{text+=chunk;if(text.includes('\n'))resolve();});
    child.once('error',reject);child.once('exit',code=>reject(Error('Lease child exited early '+code)));
  });
  t.after(async()=>{if(child.exitCode===null && child.signalCode===null){const closed=once(child,'close');child.stdin.end('release');await closed;}});
  return child;
}
test('two adapters and physical aliases share ownership; CLI receives canonical path',async t=>{
  const f=await fixture(t);let finish,started;
  const ready=new Promise(r=>started=r);
  const first=new Adapter(f.config(f.alias),(args)=>new Promise(resolve=>{assert.equal(args[args.indexOf('--port')+1],f.port);finish=resolve;started();}));
  const second=new Adapter(f.config(f.port),async()=>({id:1}));
  const pending=first.call('cyclo_ping',{target:'bench',id:1});await ready;
  await assert.rejects(second.call('cyclo_ping',{target:'bench',id:1}),/already in progress/);
  finish({id:1});assert.equal((await pending).busReservationReleased,true);
  assert.equal((await second.call('cyclo_ping',{target:'bench',id:1})).executed,true);
});
test('different processes, aliases and TMPDIR values cannot bypass the lease',async t=>{
  const f=await fixture(t);const child=await heldChild(t,f.alias,{TMPDIR:f.directory});
  const adapter=new Adapter(f.config(f.port),async()=>assert.fail('Overlapping runner'));
  await assert.rejects(adapter.call('cyclo_ping',{target:'bench',id:1}),/already in progress/);
  const closed=once(child,'close');child.stdin.end('release');await closed;
  const result=await new Adapter(f.config(f.port),async()=>({})).call('cyclo_ping',{target:'bench',id:1});
  assert.equal(result.busReservationReleased,true);
});
test('a crashed owner leaves fail-closed stale reservations, never automatically reclaimed',async t=>{
  const f=await fixture(t);const info=await stat(f.port);const child=await heldChild(t,f.port);
  const closed=once(child,'close');child.kill('SIGKILL');await closed;
  const keys=['serial-path:'+f.port,'serial-inode:'+info.dev+':'+info.ino];
  t.after(async()=>{
    for(const key of keys){const path=join('/tmp','cyclo-firmware-mcp-'+process.getuid(),createHash('sha256').update(key).digest('hex')+'.lease');const owner=JSON.parse(await readFile(path,'utf8'));assert.equal(owner.pid,child.pid);await unlink(path);}
  });
  await assert.rejects(new Adapter(f.config(f.alias),async()=>assert.fail('Stale lease bypass')).call('cyclo_ping',{target:'bench',id:1}),/stale host reservation/);
});
test('operator busId supplements physical keys and cannot override alias ownership',async t=>{
  const f=await fixture(t);const lease=await acquireBusLease({port:f.port,busId:'a-'+process.pid});
  try {await assert.rejects(acquireBusLease({port:f.alias,busId:'b-'+process.pid}),/already in progress/);}
  finally {await lease.release();}
  const grouped=await acquireBusLease({port:f.port,busId:'same-'+process.pid});
  try {await assert.rejects(acquireBusLease({port:f.alternate,busId:'same-'+process.pid}),/already in progress/);}
  finally {await grouped.release();}
});
test('symlink retargeting cannot move a pinned command; missing/device-replaced binding fails closed',async t=>{
  const f=await fixture(t);const lease=await acquireBusLease({port:f.alias});
  try {await unlink(f.alias);await symlink(f.alternate,f.alias);await lease.verify();assert.equal(lease.port,f.port);}
  finally {await lease.release();}
  const pinned=await acquireBusLease({port:f.port});
  try {await unlink(f.port);await writeFile(f.port,'replacement');await assert.rejects(pinned.verify(),/binding changed/);}
  finally {await pinned.release();}
  await assert.rejects(acquireBusLease({port:join(f.directory,'absent')}),/absent/);
});
