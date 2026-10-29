import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,symlink,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {acquireBusLease} from '../modules/dynamixel/bus-lease.mjs';

test('canonical serial aliases share one reservation and changed bindings fail closed',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cyclo lease alias '));let lease;
 try{
  const alias=join(dir,'port');await symlink('/dev/null',alias);
  lease=await acquireBusLease({port:alias});assert.equal(lease.port,'/dev/null');await lease.verify();
  await assert.rejects(acquireBusLease({port:'/dev/null'}),/reserved/);
  await unlink(alias);await symlink('/dev/zero',alias);await assert.rejects(lease.verify(),/binding changed/);
  assert.equal(await lease.release(),true);lease=null;
 }finally{if(lease)await lease.release();await rm(dir,{recursive:true,force:true});}
});
test('TCP and UDP channels reserve the whole bridge host without network access',async()=>{
 const host=randomUUID()+'.invalid';let lease;
 try{
  lease=await acquireBusLease({port:`tcp://${host}:5001`});
  await assert.rejects(acquireBusLease({port:`udp://${host}:5005`}),/reserved/);
  assert.equal(await lease.release(),true);lease=null;
  const next=await acquireBusLease({port:`udp://${host}:5005`});assert.equal(await next.release(),true);
 }finally{if(lease)await lease.release();}
});
test('invalid endpoints and regular files are rejected before transport setup',async()=>{
 for(const port of ['tcp://user:password@127.0.0.1:1234','udp://127.0.0.1:1234/path',new URL(import.meta.url).pathname])await assert.rejects(acquireBusLease({port}));
});
