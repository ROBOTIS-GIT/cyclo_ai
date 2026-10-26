import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,chmod,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sdkProvider} from '../modules/dynamixel/provider.mjs';
import {configure} from '../modules/dynamixel/workflow.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
test('official provider supports explicit offline opt-out',async()=>{
 await assert.rejects(sdkProvider({CYCLO_OFFLINE:'1'}),/disabled/);
});
for(const protocol of [1,2])test(`Node provider -> Python stdio -> official SDK Protocol ${protocol} over fake bytes`,async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cyclo SDK mock with spaces ')),python=join(dir,'mock-python');
 // Test-only interpreter wrapper: real bridge/SDK code, in-memory ports only.
 // No production test switch, serial module or OS port function is enabled.
 const source=`#!/usr/bin/env python3
import importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('packet_fixture',${JSON.stringify(join(root,'validation/test_sdk_packets.py'))})
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Port(m.FakePort):
 def __init__(self,name):
  super().__init__(name)
  self.model=${protocol===1?12:350}
  self.values[0]=[self.model&255,self.model>>8]
  self.values[4]=[${protocol===1?34:1}]
m.api.PortHandler=Port
m.bridge.sdk=lambda:m.api
m.bridge.main()
`;
 try{
  await writeFile(python,source);await chmod(python,0o700);
  const provider=await sdkProvider({CYCLO_PRODUCTS_ENABLE_HARDWARE:'1',CYCLO_PRODUCTS_PYTHON:python});
  const result=await configure((baud,timeout,wire)=>provider.connect('/MOCK-NO-SERIAL',baud,timeout,wire),{id:1,baud:57600,model:protocol===1?12:350,firmware:42,protocol,isolatedBus:true,changes:{led:protocol===1?1:{mask:1}}});
  assert.equal(result.outcome,'verified',result.error);assert.equal(result.changes.length,1);assert.equal(result.changes[0].actual,1);assert.equal(result.closureConfirmed,true);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('failed close reaps only the owned bridge and still reports closure uncertainty',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cyclo close error fixture ')),python=join(dir,'mock-python'),pidfile=join(dir,'pid');
 const source=`#!/usr/bin/env python3
import os,json,sys
open(${JSON.stringify(pidfile)},'w').write(str(os.getpid()))
for line in sys.stdin:
 r=json.loads(line)
 print(json.dumps({'ok':False,'error':'close uncertainty'} if r['op']=='close' else {'ok':True,'result':True}),flush=True)
`;
 let pid;
 try{await writeFile(python,source);await chmod(python,0o700);const p=await sdkProvider({CYCLO_PRODUCTS_ENABLE_HARDWARE:'1',CYCLO_PRODUCTS_PYTHON:python});const c=await p.connect('/MOCK',57600,30,2);pid=Number(await readFile(pidfile,'utf8'));await assert.rejects(c.close(),/close uncertainty/);assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');}
 finally{if(pid)try{process.kill(pid,'SIGTERM');}catch{}await rm(dir,{recursive:true,force:true});}
});
