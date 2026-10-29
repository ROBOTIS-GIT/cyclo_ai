import {hardwareEnabled} from '../hardware-mode.mjs';
// One pinned official SDK packet implementation; no Cyclo SDK protocol fork.
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
function bridge(python,env){
 const child=spawn(python,[fileURLToPath(new URL('./sdk_bridge.py',import.meta.url))],{stdio:['pipe','pipe','pipe'],env:{...process.env,...env,CYCLO_PRODUCTS_ENABLE_HARDWARE:'1',PYTHONDONTWRITEBYTECODE:'1'}});
 const exited=new Promise(resolve=>child.once('exit',resolve));
 const pending=[];let stopped=false,stderr='';child.stderr.on('data',b=>{stderr=(stderr+b).slice(-2048);});
 const fail=error=>{stopped=true;for(const p of pending.splice(0)){clearTimeout(p.timer);p.reject(error);}};
 child.stdin.on('error',fail);child.on('error',fail);child.on('exit',()=>fail(Error('SDK bridge exited; closure unconfirmed: '+stderr)));
 createInterface({input:child.stdout}).on('line',line=>{const p=pending.shift();if(!p)return;clearTimeout(p.timer);try{const r=JSON.parse(line);if(r.ok)p.resolve(r.result);else{const error=Error(r.error);error.kind=r.errorKind;p.reject(error);}}catch(e){p.reject(e);fail(e);}});
 const call=payload=>new Promise((resolve,reject)=>{
  if(stopped)return reject(Error('SDK bridge unavailable; no blind restart'));
  const item={resolve,reject,timer:setTimeout(()=>{child.kill('SIGTERM');const e=Error('SDK bridge deadline exceeded; transport closure unconfirmed');e.name='TransportClosureError';fail(e);},2500)};pending.push(item);child.stdin.write(JSON.stringify(payload)+'\n');
 });
 const teardown=async()=>{
  child.stdin.end();
  const wait=ms=>Promise.race([exited,new Promise(resolve=>{const timer=setTimeout(resolve,ms);timer.unref();})]);
  await wait(500);
  if(child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await wait(500);}
  if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await wait(500);}
  if(child.exitCode===null&&child.signalCode===null)throw Error('Owned SDK child cleanup unconfirmed; retain reservation');
 };
 return {call,stop:async()=>{let error;try{await call({op:'close'});}catch(e){error=e;}finally{await teardown();}if(error)throw error;}};
}
export async function sdkProvider(env=process.env){
 if(!hardwareEnabled(env,'CYCLO_PRODUCTS_ENABLE_HARDWARE'))throw Error('Hardware provider is disabled; no process or device access occurred');
 const python=env.CYCLO_PRODUCTS_PYTHON??'python3';
 return {
  ports:async()=>{const b=bridge(python,env);try{return await b.call({op:'ports'});}finally{await b.stop();}},
  connect:async(port,baud,timeoutMs=100,protocol=2)=>{
   if(![1,2].includes(protocol))throw Error('Explicit Protocol 1 or 2 required');
   const b=bridge(python,env);
   try{await b.call({op:'open',port,baud,timeoutMs,protocol});}catch(e){try{await b.stop();}catch{const error=Error('SDK open failed and closure is unconfirmed: '+e.message);error.name='TransportClosureError';throw error;}throw e;}
   return {syncRead:(ids,address,size)=>b.call({op:'syncRead',ids,address,size}),ping:id=>b.call({op:'ping',id}),probe:id=>b.call({op:'probe',id}),read:async(id,address,size)=>Uint8Array.from(await b.call({op:'read',id,address,size})),bind:identity=>b.call({op:'bind',...identity}),canBaud:baud=>b.call({op:'canBaud',baud}),write:(id,address,data,options={})=>b.call({op:'write',id,address,data:[...data],...(options.expectStatus===false?{expectStatus:false}:{})}),close:()=>b.stop()};
  }
 };
}
