import {SCAN_BAUDS,modelFor,capability,readsFor,encode,decode} from './registry.mjs';
import {identify} from './identity.mjs';
const integer=(v,min,max,label)=>{if(!Number.isInteger(v)||v<min||v>max)throw Error(`Invalid ${label}`);return v;};
const resolve=r=>modelFor(r.model,r.firmware,r.catalogId,r.protocol);
export function validateRequest(request){
 const {id,baud,changes}=request,m=resolve(request);integer(id,0,252,'unicast ID (plugin bound 0..252)');
 if(!Object.hasOwn(m.bauds,String(baud)))throw Error('Unsupported current baud for this model');
 if(!changes||!Object.keys(changes).length||Object.keys(changes).some(k=>!['id','baud','led','profile'].includes(k)))throw Error('Only named ID, baud, LED or profile changes are permitted');
 for(const op of Object.keys(changes))capability(m,op);
 if('id'in changes){integer(changes.id,0,252,'new ID');if(changes.id===id)throw Error('ID is unchanged');}
 if('baud'in changes&&(!Object.hasOwn(m.bauds,String(changes.baud))||changes.baud===baud))throw Error('Invalid or unchanged destination baud');
 if('id'in changes&&'baud'in changes)throw Error('Change ID and baud in separate verified transactions');
 if('led'in changes){
  const c=capability(m,'led');
  if(typeof changes.led==='object'&&changes.led!==null&&c.colorMask){if(Object.keys(changes.led).join(',')!=='mask')throw Error('Specify an exact LED color mask');integer(changes.led.mask,0,7,'LED color mask');}
  else if(typeof changes.led==='object'&&changes.led!==null){if(!c.channels||Object.keys(changes.led).sort().join(',')!=='blue,green,red')throw Error('RGB LED requires exact red, green and blue channels on an RGB model');for(const v of Object.values(changes.led))integer(v,0,255,'LED channel');}
  else if(changes.led===1&&(c.channels||c.colorMask))throw Error('Specify intended LED color/intensity explicitly for this model');
  else if(![0,1].includes(changes.led))throw Error('LED must be 0 or 1, or explicit RGB on an RGB model');
 }
 if('profile'in changes){
  const c=capability(m,'profile'),p=changes.profile;
  if(!p||typeof p!=='object'||Array.isArray(p)||!['time','velocity'].includes(p.mode))throw Error('Choose a structured time or velocity profile explicitly');
  if(request.firmware<c.driveMinimumFirmware)throw Error('Firmware does not support this profile Drive Mode register');
  if(p.mode==='time'){
   if(request.firmware<c.timeMinimumFirmware)throw Error('Time-based profile is not supported by this observed firmware');
   if(Object.keys(p).some(k=>!['mode','totalMs','accelerationMs'].includes(k)))throw Error('Unexpected time profile field');
   integer(p.totalMs,c.timeRange[0],c.timeRange[1],'total time in ms');integer(p.accelerationMs,1,Math.floor(p.totalMs/2),'acceleration time in ms');
  }else{
   if(Object.keys(p).some(k=>!['mode','rpm','accelerationRpm2','maxRpm','maxAccelerationRpm2'].includes(k)))throw Error('Unexpected velocity profile field');
   for(const k of ['rpm','accelerationRpm2','maxRpm','maxAccelerationRpm2'])if(!Number.isFinite(p[k])||p[k]<=0)throw Error('Positive RPM, RPM/min and explicit application limits required');
   if(p.rpm>p.maxRpm||p.accelerationRpm2>p.maxAccelerationRpm2)throw Error('Profile exceeds application limits');
   integer(Math.floor(p.rpm/c.velocityScale),...c.velocityRange,'profile velocity raw value');integer(Math.floor(p.accelerationRpm2/c.accelerationScale),...c.accelerationRange,'profile acceleration raw value');
  }
 }
 return request;
}
function typedOp(m,name,register,value){
 const r=m.registers[register];if(!r||r.access!=='RW'||![1,2,4].includes(r.width)||!['EEPROM','RAM','Hybrid'].includes(r.memory)||!Number.isInteger(r.address)||r.address<0||r.address+r.width>65536)throw Error('Unresolved writable register semantics');
 if(r.range&&(value<r.range[0]||value>r.range[1]))throw Error(`Value outside source range: ${register}`);
 encode(value,r.width,'unsigned');
 return {name,register,value,address:r.address,size:r.width,eeprom:r.memory==='EEPROM',memory:r.memory,source:r.source};
}
function plan(request,s){
 const m=resolve(request),c=request.changes,ops=[];
 if('led'in c){const p=capability(m,'led');if(p.channels){const v=typeof c.led==='object'?c.led:{red:c.led?p.onRaw:0,green:0,blue:0};for(const channel of ['red','green','blue'])ops.push(typedOp(m,'led'+channel,`LED ${channel[0].toUpperCase()+channel.slice(1)}`,v[channel]));}else ops.push(typedOp(m,'led','LED',typeof c.led==='object'?c.led.mask:c.led?p.onRaw:0));}
 if(c.profile){
  const f=capability(m,'profile'),p=c.profile;
  if(!f.operatingModes.includes(s.operatingMode))throw Error('Profile unsupported in observed operating mode; operating-mode changes are outside this tool');
  if(s.drive&~f.allowedDriveMask)throw Error('Unresolved Drive Mode bits');
  if(s.drive&f.forbiddenDriveBits)throw Error('Torque-on-by-goal is configured; no profile writes');
  const a=p.mode==='time'?p.accelerationMs:Math.floor(p.accelerationRpm2/f.accelerationScale),v=p.mode==='time'?p.totalMs:Math.floor(p.rpm/f.velocityScale);
  if(p.mode==='velocity'&&s.velocityLimit!==undefined&&v>s.velocityLimit)throw Error('Profile exceeds observed velocity-limit ceiling');
  ops.push(typedOp(m,'profileAcceleration','Profile Acceleration',a),typedOp(m,'profileVelocity','Profile Velocity',v));
  const drive=(s.drive&~f.profileBit)|(p.mode==='time'?f.profileBit:0);
  if(drive!==s.drive)throw Error('Requested profile type differs from observed Drive Mode; no mode-selection writes are permitted');
 }
 if('id'in c)ops.push(typedOp(m,'id','ID',c.id));
 if('baud'in c)ops.push(typedOp(m,'baud','Baud Rate',m.bauds[String(c.baud)]));
 return ops.filter(op=>s[op.name]!==op.value);
}
export function configurationPlan(request,snapshot){validateRequest(request);return plan(request,snapshot);}
const checkAbort=s=>{if(s?.aborted)throw Error('Operation interrupted; no further writes');};
export async function configure(connect,request,{signal}={}){
 validateRequest(request);const m=resolve(request),reads=readsFor(m),protocol=m.protocol;
 if(request.isolatedBus!==true)throw Error('Confirm a physically isolated single-device bus; scans cannot exclude duplicate IDs or secondary listeners');
 if(request.peerIds!==undefined&&(!Array.isArray(request.peerIds)||request.peerIds.length>1||request.peerIds.some(id=>!Number.isInteger(id)||id<0||id>252)||!m.dualAxis&&request.peerIds.length))throw Error('Invalid or inapplicable explicit peer endpoint');
 if(m.dualAxis&&(!Array.isArray(request.peerIds)||request.peerIds.length!==1||request.peerIds[0]===request.id))throw Error('Dual-axis unit requires explicit other-axis ID and both torque states; do not guess the factory peer ID');
 const result={outcome:'not_written',snapshot:{},changes:[],location:{id:request.id,baud:request.baud,protocol},catalogId:m.catalogId,recovery:[],warnings:[]};
 let connection,attempted=false,closureUnconfirmed=false;
 const close=async()=>{if(connection){const old=connection;connection=undefined;try{await old.close();}catch{closureUnconfirmed=true;throw Error('Transport closure unconfirmed: stop; do not reopen or retry');}}};
 const pingIdentity=async(id=result.location.id)=>{
  const p=await identify(connection,id,protocol);
  if(!p?.identityComplete||p.modelNumber!==request.model||p.firmwareVersion!==request.firmware)throw Error(p?.identityError??'Observed identity differs from selected model/firmware/ID');
 };
 const snapshot=async id=>{const s={};for(const [name,[a,w]]of Object.entries(reads)){checkAbort(signal);s[name]=decode(await connection.read(id,a,w));}
  // RGB channels are independent registers and participate in continuity checks.
  for(const [name,r]of Object.entries(m.registers))if(/^LED (Red|Green|Blue)$/.test(name))s['led'+name.slice(4).toLowerCase()]=decode(await connection.read(id,r.address,r.width));
  return s;};
 const torqueOff=async()=>{
  const r=m.registers['Torque Enable'];for(const id of [result.location.id,...(request.peerIds??[])]){
   checkAbort(signal);if(id!==result.location.id)await pingIdentity(id);
   if(decode(await connection.read(id,r.address,r.width))!==0)throw Error('Torque must already be off on every axis; this tool never changes torque');
  }
 };
 try{
  checkAbort(signal);connection=await connect(result.location.baud,100,protocol);await pingIdentity();
  if('baud'in request.changes&&(!connection.canBaud||!await connection.canBaud(request.changes.baud)))throw Error('Transport does not support destination baud; no register write occurred');
  const s=result.snapshot=await snapshot(result.location.id);
  if(s.model!==request.model||s.firmware!==request.firmware||s.id!==request.id||s.protocol!==undefined&&s.protocol!==protocol||s.baud!==m.bauds[String(request.baud)])throw Error('Control-table identity/protocol/baud mismatch');
  if(s.secondaryId!==undefined&&s.secondaryId<253)throw Error('Secondary ID is active; duplicate/group listeners cannot be excluded');
  if(s.lock!==undefined&&s.lock!==0)throw Error('EEPROM lock is active; lock changes are not permitted');
  await torqueOff();
  const peers={};for(const id of request.peerIds??[]){
   const peer=peers[id]=await snapshot(id);
   if(peer.model!==request.model||peer.firmware!==request.firmware||peer.id!==id||peer.protocol!==undefined&&peer.protocol!==protocol||peer.baud!==m.bauds[String(request.baud)])throw Error('Other-axis control-table identity/protocol/baud mismatch');
   if(peer.secondaryId!==undefined&&peer.secondaryId<253)throw Error('Other-axis Secondary ID is active; RAM writes could reach multiple axes');
   if(peer.lock!==undefined&&peer.lock!==0)throw Error('Other-axis EEPROM lock is active');
  }
  const ops=plan(request,s);
  if(connection.bind)await connection.bind({catalogId:m.catalogId,model:request.model,firmware:request.firmware,id:request.id,peerIds:request.peerIds??[],profileMode:request.changes.profile?.mode});
  if('id'in request.changes&&await connection.probe(request.changes.id))throw Error('Destination ID is occupied; no writes occurred');
  for(const op of ops){
   checkAbort(signal);await torqueOff();
   const record={name:op.name,before:s[op.name],requested:op.value,verified:false,source:op.source};result.changes.push(record);attempted=true;
   try{await connection.write(result.location.id,op.address,encode(op.value,op.size));}catch(e){record.ackError=String(e.message);}
   if(op.name==='id')result.location.id=request.changes.id;
   if(op.name==='baud'){result.location.baud=request.changes.baud;await close();checkAbort(signal);connection=await connect(result.location.baud,100,protocol);}
   checkAbort(signal);await pingIdentity();const actual=decode(await connection.read(result.location.id,op.address,op.size));record.actual=actual;
   if(actual!==op.value)throw Error('Readback mismatch; stop without retry or rollback');record.verified=true;
   if(op.name==='id'||op.name==='baud'){
    const expected={...s,...Object.fromEntries(result.changes.filter(c=>c.verified).map(c=>[c.name,c.requested]))},observed=await snapshot(result.location.id);
    for(const[name,value]of Object.entries(expected))if(observed[name]!==value)throw Error(`Transition continuity mismatch: ${name}; stop without retargeting`);
    for(const[id,previous]of Object.entries(peers)){
     await pingIdentity(Number(id));const now=await snapshot(Number(id)),expect={...previous,...(op.name==='baud'?{baud:op.value}:{})};
     for(const[k,v]of Object.entries(expect))if(now[k]!==v)throw Error(`Other-axis continuity mismatch: ${k}`);
    }
   }
  }
  result.outcome='verified';
 }catch(e){if(e.name==='TransportClosureError')closureUnconfirmed=true;result.error=e.message;result.outcome=attempted?'uncertain':'not_written';}
 try{await close();}catch(e){result.error=e.message;result.outcome=attempted?'uncertain':'not_written';}
 if(closureUnconfirmed)result.warnings.push('Bus reservation must remain held until operator confirms closure');
 result.closureConfirmed=!closureUnconfirmed;
 if(result.outcome==='uncertain')result.recovery.push({action:'read-only reconciliation',candidates:[{id:request.id,baud:request.baud,protocol},{...result.location}],instruction:'Confirm closure and exclusive ownership; inspect both locations once. Never repeat a write after lost acknowledgement.'});
 return result;
}
export function scanPlan({ids,bauds,protocols=[1,2],timeoutMs=30,budgetMs=5000}){
 if(!Array.isArray(ids)||!ids.length||ids.length>253||new Set(ids).size!==ids.length)throw Error('Provide unique bounded unicast IDs (0..252)');ids.forEach(id=>integer(id,0,252,'scan ID'));
 if(!Array.isArray(bauds)||!bauds.length||bauds.length>8||new Set(bauds).size!==bauds.length||bauds.some(b=>!SCAN_BAUDS.includes(b)))throw Error('Unsupported or duplicate documented scan baud');
 if(!Array.isArray(protocols)||!protocols.length||protocols.length>2||new Set(protocols).size!==protocols.length||protocols.some(p=>![1,2].includes(p)))throw Error('Choose bounded Protocol 1 and/or 2');
 integer(timeoutMs,10,200,'packet timeout');integer(budgetMs,100,15000,'scan budget');
 const probes=ids.length*bauds.length*protocols.length;
 if(probes*timeoutMs*3>budgetMs)throw Error('Probe/identity packet matrix exceeds budget; narrow IDs/rates/protocols explicitly');
 return {ids,bauds,protocols,timeoutMs,budgetMs,probes,maxIdentityPackets:3};
}
export async function scan(connect,args,{signal,clock=()=>Date.now()}={}){
 const p=scanPlan(args),start=clock(),devices=[],errors=[];let completed=0,closureConfirmed=true;
 outer:for(const baud of p.bauds)for(const protocol of p.protocols){
  if(signal?.aborted||clock()-start>=p.budgetMs)break outer;let c;
  try{c=await connect(baud,p.timeoutMs,protocol);
   for(const id of p.ids){if(signal?.aborted||clock()-start>=p.budgetMs)break;const info=await identify(c,id,protocol,{probe:true});completed++;
    if(info)devices.push({...info,baud,configurationSupported:info.identityComplete&&info.catalogCandidates.length===1,capabilityCheckRequired:true});
   }
  }catch(e){if(e.name==='TransportClosureError')closureConfirmed=false;errors.push({baud,protocol,error:e.message});}
  finally{if(c)try{await c.close();}catch{closureConfirmed=false;errors.push({baud,protocol,error:'Closure unconfirmed; no further connection opened'});}}
  if(!closureConfirmed)break outer;
 }
 return {devices,completed,planned:p.probes,complete:completed===p.probes&&errors.length===0,errors,closureConfirmed,selectionRequired:devices.length!==1,warning:'A scan cannot prove uniqueness, exclude duplicate IDs or discover every unscanned protocol/rate. Identity-read failures preserve observed presence; no Status Return Level changes.'};
}
