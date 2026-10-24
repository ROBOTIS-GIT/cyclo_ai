import {MODELS,REGISTERS,READS,SCAN_BAUDS,modelFor,encode,decode} from './registry.mjs';

const integer=(v,min,max,label)=>{if(!Number.isInteger(v)||v<min||v>max)throw Error(`Invalid ${label}`);return v;};
export function validateRequest(request) {
  const {id,baud,model,firmware,changes}=request;
  integer(id,0,252,'unicast ID');modelFor(model,firmware);
  if(!MODELS[model].bauds.includes(baud))throw Error('Unsupported current baud');
  if(!changes||!Object.keys(changes).length||Object.keys(changes).some(k=>!['id','baud','led','profile'].includes(k)))throw Error('Only named ID, baud, LED or profile changes are permitted');
  if('id' in changes){integer(changes.id,0,252,'new ID');if(changes.id===id)throw Error('ID is unchanged');}
  if('baud' in changes&&(!MODELS[model].bauds.includes(changes.baud)||changes.baud===baud))throw Error('Invalid or unchanged destination baud');
  if('id' in changes&&'baud' in changes)throw Error('Change ID and baud in separate verified transactions');
  if('led' in changes&&![0,1].includes(changes.led))throw Error('LED must be 0 or 1');
  if('profile' in changes){
    const p=changes.profile;
    if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Profile must be a structured mode-specific request');
    if(!['time','velocity'].includes(p.mode))throw Error('Choose time or velocity profile explicitly');
    if(p.mode==='time'){
      if(Object.keys(p).some(k=>!['mode','totalMs','accelerationMs'].includes(k)))throw Error('Unexpected time profile field');
      integer(p.totalMs,2,32737,'total time in ms');integer(p.accelerationMs,1,Math.floor(p.totalMs/2),'acceleration time in ms');
    }else{
      if(Object.keys(p).some(k=>!['mode','rpm','accelerationRpm2','maxRpm','maxAccelerationRpm2'].includes(k)))throw Error('Unexpected velocity profile field');
      for(const key of ['rpm','accelerationRpm2','maxRpm','maxAccelerationRpm2'])if(!Number.isFinite(p[key])||p[key]<=0)throw Error('Positive RPM, RPM/min and explicit application limits are required');
      if(p.rpm>p.maxRpm||p.accelerationRpm2>p.maxAccelerationRpm2)throw Error('Requested profile exceeds application limits');
      if(Math.floor(p.rpm/.229)<1||Math.floor(p.rpm/.229)>32767||Math.floor(p.accelerationRpm2/214.577)<1||Math.floor(p.accelerationRpm2/214.577)>32767)throw Error('Profile is below resolution or beyond documented range; zero/infinite is not accepted');
    }
  }
  return request;
}
function plan(request,snapshot) {
  const m=modelFor(request.model,request.firmware),c=request.changes,ops=[];
  if('led' in c)ops.push({name:'led',value:c.led});
  if(c.profile){
    if(!m.profileModes.includes(snapshot.operatingMode))throw Error('Profile unsupported in the observed operating mode; mode changes are outside this tool');
    if(snapshot.drive&~13)throw Error('Unreviewed Drive Mode bits; no profile writes');
    if(snapshot.drive&8)throw Error('Torque-on-by-goal is configured: review it separately before profile preparation');
    const p=c.profile;
    const acceleration=p.mode==='time'?p.accelerationMs:Math.floor(p.accelerationRpm2/214.577);
    const velocity=p.mode==='time'?p.totalMs:Math.floor(p.rpm/.229);
    // This is an additional conservative plugin ceiling, not a claim that this
    // register limits position profiles in every firmware.
    if(p.mode==='velocity'&&velocity>snapshot.velocityLimit)throw Error('Profile exceeds the observed velocity-limit ceiling');
    ops.push({name:'profileAcceleration',value:acceleration},{name:'profileVelocity',value:velocity});
    const drive=(snapshot.drive&~4)|(p.mode==='time'?4:0);
    if(drive!==snapshot.drive)ops.push({name:'drive',value:drive});
  }
  if('id' in c)ops.push({name:'id',value:c.id});
  if('baud' in c)ops.push({name:'baud',value:m.bauds.indexOf(c.baud)});
  return ops.filter(op=>snapshot[op.name]!==op.value).map(op=>({...op,...REGISTERS[op.name]}));
}
export function configurationPlan(request,snapshot) {validateRequest(request);return plan(request,snapshot);}
const checkAbort=signal=>{if(signal?.aborted)throw Error('Operation interrupted; no further writes');};

/** Backend injection is the only I/O boundary. No retries or automatic rollback.
 * Caller owns a physical bus lease through confirmed closure. */
export async function configure(connect,request,{signal}={}) {
  validateRequest(request);
  if(request.isolatedBus!==true)throw Error('Confirm a physically isolated single-device bus; scans cannot prove absence of duplicate IDs or secondary listeners');
  const result={outcome:'not_written',snapshot:{},changes:[],location:{id:request.id,baud:request.baud},recovery:[],warnings:[]};
  let connection,attempted=false,closureUnconfirmed=false;
  const close=async()=>{if(connection){const old=connection;connection=undefined;try{await old.close();}catch(e){closureUnconfirmed=true;throw Error('Transport closure unconfirmed: stop; do not reopen or retry');}}};
  const pingIdentity=async()=>{
    const p=await connection.ping(result.location.id);
    if(p.id!==result.location.id||p.modelNumber!==request.model||p.firmwareVersion!==request.firmware)throw Error('Observed identity differs from the selected model/firmware/ID');
    modelFor(p.modelNumber,p.firmwareVersion);
  };
  try{
    checkAbort(signal);connection=await connect(result.location.baud);await pingIdentity();
    for(const [name,[address,size]] of Object.entries(READS)){checkAbort(signal);result.snapshot[name]=decode(await connection.read(result.location.id,address,size));}
    const s=result.snapshot,m=modelFor(request.model,request.firmware);
    if(s.model!==request.model||s.firmware!==request.firmware||s.id!==request.id||s.protocol!==2||s.baud!==m.bauds.indexOf(request.baud))throw Error('Control-table identity/protocol/baud mismatch');
    if(s.secondaryId<253)throw Error('Secondary ID is active; group/duplicate writes cannot be excluded');
    if(s.torque!==0)throw Error('Torque must already be off; this tool never changes torque');
    const ops=plan(request,s);
    if('id' in request.changes){
      // A normal ping timeout is necessary but not sufficient: isolatedBus is also required.
      const occupied=await connection.probe(request.changes.id);
      if(occupied)throw Error('Destination ID is occupied; no writes occurred');
    }
    for(const op of ops){
      checkAbort(signal);
      if(decode(await connection.read(result.location.id,64,1))!==0)throw Error('Torque changed before write; stopped');
      const record={name:op.name,before:s[op.name],requested:op.value,verified:false};result.changes.push(record);attempted=true;
      // Only these constants reach write(); page text cannot choose address or size.
      try{await connection.write(result.location.id,op.address,encode(op.value,op.size));}catch(e){record.ackError=String(e.message);}
      if(op.name==='id')result.location.id=request.changes.id;
      if(op.name==='baud'){result.location.baud=request.changes.baud;await close();checkAbort(signal);connection=await connect(result.location.baud);}
      checkAbort(signal);await pingIdentity();
      const actual=decode(await connection.read(result.location.id,op.address,op.size));record.actual=actual;
      if(actual!==op.value)throw Error('Readback mismatch; stop without retry or rollback');
      record.verified=true;
    }
    result.outcome='verified';
  }catch(e){if(e.name==='TransportClosureError')closureUnconfirmed=true;result.error=e.message;result.outcome=attempted?'uncertain':'not_written';}
  try{await close();}catch(e){result.error=e.message;result.outcome=attempted?'uncertain':'not_written';}
  if(closureUnconfirmed)result.warnings.push('Bus reservation must remain held until an operator confirms process/port closure');
  result.closureConfirmed=!closureUnconfirmed;
  if(result.outcome==='uncertain')result.recovery.push({action:'read-only reconciliation',candidates:[{id:request.id,baud:request.baud},{...result.location}],instruction:'Confirm closure and exclusive bus ownership, then inspect both locations once. Never repeat writes because an acknowledgement was lost.'});
  return result;
}

export function scanPlan({ids,bauds,timeoutMs=30,budgetMs=5000}) {
  if(!Array.isArray(ids)||!ids.length||ids.length>253||new Set(ids).size!==ids.length)throw Error('Provide unique bounded unicast IDs');
  ids.forEach(id=>integer(id,0,252,'scan ID'));
  if(!Array.isArray(bauds)||!bauds.length||bauds.length>8||new Set(bauds).size!==bauds.length||bauds.some(b=>!SCAN_BAUDS.includes(b)))throw Error('Unsupported or duplicate scan baud');
  integer(timeoutMs,10,200,'probe timeout');integer(budgetMs,100,15000,'scan budget');
  if(ids.length*bauds.length*timeoutMs>budgetMs)throw Error('Probe matrix exceeds time budget; narrow IDs/rates or split explicitly');
  return {ids,bauds,timeoutMs,budgetMs,probes:ids.length*bauds.length};
}
export async function scan(connect,args,{signal,clock=()=>Date.now()}={}) {
  const p=scanPlan(args),start=clock(),devices=[],errors=[];let completed=0,closureConfirmed=true;
  for(const baud of p.bauds){
    if(signal?.aborted||clock()-start>=p.budgetMs)break;
    let c;
    try{
      c=await connect(baud,p.timeoutMs);
      for(const id of p.ids){
        if(signal?.aborted||clock()-start>=p.budgetMs)break;
        const info=await c.probe(id);completed++;
        if(info)devices.push({...info,baud,configurationSupported:!!MODELS[info.modelNumber]?.firmwares.includes(info.firmwareVersion)});
      }
    }catch(e){if(e.name==='TransportClosureError')closureConfirmed=false;errors.push({baud,error:e.message});}
    finally{if(c)try{await c.close();}catch(e){closureConfirmed=false;errors.push({baud,error:'Closure unconfirmed; no further baud opened'});}}
    if(!closureConfirmed)break;
  }
  return {devices,completed,planned:p.probes,complete:completed===p.probes&&errors.length===0,errors,closureConfirmed,selectionRequired:devices.length!==1,warning:'A scan cannot prove a unique physical device, detect every duplicate ID, or exclude devices at unscanned rates/protocols.'};
}
