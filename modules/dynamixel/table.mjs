import {aliasPlan} from './table-alias.mjs';
import {scalar as scalarConditions,live as liveConditions} from './conditions.mjs';
// Canonical, build-time per-item semantics. Never derive write addresses from chat.
import {ITEMS,itemsFor,descriptor} from './item-metadata.mjs';
export {ITEMS} from './item-metadata.mjs';
import {modelFor,encode,decode} from './registry.mjs';
import {identify} from './identity.mjs';
import {configure} from './workflow.mjs';

export function tableFor(model){return itemsFor(model.catalogId);}
export function itemFor(model,key){const matches=tableFor(model).filter(i=>i.key===key||i.name===key);if(matches.length!==1)throw Error('Unknown or ambiguous item name/key; inspect dynamixel_table first');return matches[0];}
export function writeRequest(model,item,value){
 const r=item.write;
 if(item.access==='R')throw Error('Official Control Table item is read-only');
 if(!['RW','R/RW'].includes(item.access))throw Error('Official access semantics are unresolved');
 if(r.status!=='resolved')throw Error(`Unresolved item semantics: ${r.reason}. Exact source: ${item.source.path}:${item.source.line}`);
 if(!Number.isSafeInteger(value))throw Error('Supply an exact integer in documented raw units; physical-unit conversion is not guessed');
 if(r.kind==='id-transition'){if(value<0||value>model.idMaximum)throw Error('Destination ID exceeds documented model-specific unicast bound');return;}
 if(r.kind==='baud-transition'){if(!Object.values(model.bauds).includes(value))throw Error('Baud register enum is not documented for this model');return;}
 scalarConditions(r,item,value,model.observedFirmware,model.protocol);
}
function reader(model,connection,target){return async name=>{const item=itemFor(model,name);if(item.readStatus!=='resolved-raw')throw Error('Required precondition item has unresolved source metadata');const bytes=await connection.read(target.id,item.address,item.width);return decode(bytes,item.encoding==='twos-complement'?'twos-complement':'unsigned');};}
export async function validateConditions(model,item,value,read){
 const result=await liveConditions(item.write,value,read,{firmware:model.observedFirmware,protocol:model.protocol,hasItem:name=>tableFor(model).some(i=>i.name===name)});
 return {...result.observed,...(result.effects.length?{effectiveModeNotes:result.effects}:{})};
}

async function identity(connection,target,model,allowPingOnly=false){const found=await identify(connection,target.id,model.protocol,{allowPingOnly});if(!found?.identityComplete||found.modelNumber!==target.model||found.firmwareVersion!==target.firmware)throw Error(found?.identityError??'Selected target identity/protocol/firmware changed');return found;}
export async function readItems(connect,target,keys,{signal}={}){
 const model=modelFor(target.model,target.firmware,target.catalogId,target.protocol);const items=keys.map(k=>itemFor(model,k));
 for(const item of items)if(model.observedFirmware<(item.minimumFirmware??0)||item.protocols&&!item.protocols.includes(model.protocol))throw Error('Item is unavailable for the observed firmware/protocol');
 if(!items.length||items.length>16||new Set(items.map(i=>i.key)).size!==items.length||items.some(i=>i.readStatus!=='resolved-raw')||items.reduce((n,i)=>n+i.width,0)>1024)throw Error('Choose 1..16 unique source-resolved items within 1024 bytes');
 let closureUnconfirmed=false,c,result={outcome:'read',items:[]};
 try{if(signal?.aborted)throw Error('Read cancelled');c=await connect(target.baud,100,model.protocol);await identity(c,target,model);
  for(const item of items){if(signal?.aborted)throw Error('Read cancelled');const bytes=await c.read(target.id,item.address,item.width);if(bytes.length!==item.width)throw Error('Read width mismatch');result.items.push({item:item.key,bytes:[...bytes],...(item.width<=4?{rawUnsigned:decode(bytes)}:{}),...(item.width<=4&&item.encoding!=='unresolved'?{value:decode(bytes,item.encoding)}:{}),encoding:item.encoding,unit:item.unit,scale:item.scale,interpretation:item.encoding==='unresolved'?'raw bytes only; signed/unit semantics unresolved':'documented raw value',source:item.source});}
  await identity(c,target,model);
 }catch(e){if(e.name==='TransportClosureError')closureUnconfirmed=true;result={...result,outcome:'failed',error:e.message};}
 try{if(c)await c.close();result.closureConfirmed=!closureUnconfirmed;}catch(e){result.closureConfirmed=false;result.error=e.message;result.outcome='failed';}
 return result;
}
export async function writeItem(connect,target,key,value,{signal}={}){
 const model=modelFor(target.model,target.firmware,target.catalogId,target.protocol),origin=itemFor(model,key);writeRequest(model,origin,value);
 if(model.dualAxis&&(target.peerIds?.length!==1||target.peerIds[0]===target.id))throw Error('Distinct verified dual-axis peer cohort is required');
 if(!target.addressingVerified&&!target.isolatedBus)throw Error('Verify unique addressing, including duplicate IDs and secondary listeners, before writing');
 const result={outcome:'not_written',item:origin.key,requested:value,location:{id:target.id,baud:target.baud,protocol:model.protocol},source:origin.source,warnings:origin.write.warnings??[]};
 let c,attempted=false,closureUnconfirmed=false,activeModel=model,pingOnly=false;
 const close=async()=>{if(c){const old=c;c=undefined;try{await old.close();}catch(e){closureUnconfirmed=true;const error=Error('Transport closure unconfirmed; do not reconnect or retry');error.name='TransportClosureError';throw error;}}};
 const open=async(protocol=model.protocol)=>{c=await connect(target.baud,100,protocol);activeModel={...model,protocol};const proof=await identity(c,target,activeModel,true);pingOnly=proof.readbackUnavailable===true;};
 const abort=()=>{if(signal?.aborted)throw Error('Operation interrupted; no blind retry');};
 try{
  abort();await open();result.identityVerifiedBefore=true;
  let plan={item:origin,value,address:origin.address,bytes:encode(value,origin.width,origin.write.encoding)};
  if(origin.write.kind==='indirect-data'){
   plan=await aliasPlan(tableFor(model),origin,value,c,target.id);writeRequest(model,plan.item,plan.value);
   result.effectiveItem=plan.item.key;result.effectiveValue=plan.value;result.mappingEvidence=plan.mappingEvidence;
  }
  const item=plan.item,requested=plan.value,read=reader(model,c,target),kind=item.write.kind;
  result.effectItem=item.name;result.warnings=[...new Set([...result.warnings,...(item.write.warnings??[])])];
  const binding=()=>({catalogId:model.catalogId,model:target.model,firmware:target.firmware,id:target.id,peerIds:target.peerIds??[],tableItem:origin.key,expectedEffectiveItem:item.key,...(pingOnly?{identityMode:'ping-payload'}:{}),...(plan.mappingEvidence?{expectedAliasMappings:plan.mappingEvidence}:{})});
  if(kind==='id-transition'&&requested!==target.id||kind==='baud-transition'&&requested!==model.bauds[String(target.baud)]){
   await close();
   const wrapped=async(...args)=>{
    const connection=await connect(...args);
    return {...connection,bind:async()=>{if(connection.bind)await connection.bind(binding());},write:async(id,address,data,options)=>{
     if(address!==item.address)throw Error('Unexpected transition write target');
     if(origin.write.kind==='indirect-data')return connection.write(id,plan.address,plan.bytes,options);
     return connection.write(id,address,data,options);
    }};
   };
   const changes=kind==='id-transition'?{id:requested}:{baud:Number(Object.keys(model.bauds).find(b=>model.bauds[b]===requested))};
   const transition=await configure(wrapped,{...target,changes},{signal});
   return {...transition,item:origin.key,effectItem:item.name,requested:value,...(result.effectiveItem?{effectiveItem:result.effectiveItem,effectiveValue:requested}:{}),warnings:[...(transition.warnings??[]),...result.warnings]};
  }
  if(model.dualAxis&&(origin.write.kind==='indirect-data'||item.memory!=='EEPROM')){
   const shadow=tableFor(model).find(i=>['Secondary ID','Secondary(Shadow) ID'].includes(i.name));
   if(shadow)for(const id of target.peerIds){const peer={...target,id};await identity(c,peer,model,true);const listener=await reader(model,c,peer)(shadow.name);if(listener===target.id)throw Error('Known peer Secondary ID listens at the selected primary address; one-target RAM write would affect another axis');}
  }
  try{result.before=await read(item.name);}catch(e){if(!pingOnly||e.kind!=='no-response')throw e;result.beforeUnavailable='Device READ replies unavailable; verified Protocol2 Ping identity is retained';}
  result.preconditions=await validateConditions(model,item,requested,read);
  if(model.dualAxis&&item.write.requiresTorqueOff){for(const id of target.peerIds){const peer={...target,id};await identity(c,peer,model);if(await reader(model,c,peer)('Torque Enable')!==0)throw Error('Documented EEPROM write requires both axes already torque-off');}}
  let statusReturn=2;if(tableFor(model).some(i=>i.name==='Status Return Level'))try{statusReturn=await read('Status Return Level');}catch(e){if(!pingOnly||e.kind!=='no-response')throw e;statusReturn=0;}
  const sameProtocol=kind==='protocol-transition'&&requested===model.protocol;
  let beforeProtocol;
  if(kind==='protocol-transition'&&!sameProtocol){
   if(!model.protocols.includes(requested))throw Error('Requested protocol is not documented for this model/firmware identity');
   beforeProtocol={};for(const name of ['Model Number','Firmware Version','ID','Baud Rate','Torque Enable','Drive Mode','Operating Mode'])if(tableFor(model).some(i=>i.name===name))beforeProtocol[name]=await read(name);
   await close();c=await connect(target.baud,100,requested);
   if(await c.probe(target.id))throw Error('Destination protocol/address already responds; cannot prove transition uniqueness');
   await close();await open();
   for(const[name,expected]of Object.entries(beforeProtocol))if(await reader(model,c,target)(name)!==expected)throw Error('Source identity/context changed during protocol preflight');
  }
  if(c.bind)await c.bind(binding());
  if(origin.write.kind==='indirect-data'){
   const fresh=await aliasPlan(tableFor(model),origin,value,c,target.id);
   const ordered=a=>JSON.stringify([...a].sort((x,y)=>x.item.localeCompare(y.item)));
   if(fresh.item.key!==item.key||fresh.value!==requested||ordered(fresh.mappingEvidence)!==ordered(plan.mappingEvidence))throw Error('Indirect mapping/value changed after confirmation; no frame sent');
  }
  abort();
  const expectStatus=statusReturn===2&&!(kind==='return-level'&&requested<2)&&!(kind==='protocol-transition'&&!sameProtocol);
  attempted=true;try{result.transmission=await c.write(target.id,plan.address,plan.bytes,{expectStatus});}catch(e){result.ackError=e.message;if(!expectStatus||e.kind==='device-status')throw e;}
  abort();
  if(kind==='return-level'&&requested===0){
   result.outcome='transmitted-unverifiable';result.observability='read-disabled-by-command';result.meaning='The explicit request disables READ/WRITE replies; transmission is not a fabricated device readback. No automatic restore/retry.';
  }else if(pingOnly&&!(kind==='return-level'&&requested>0)){
   result.outcome='transmitted-unverifiable';result.observability='read-unavailable';result.meaning='Static contract validated with Protocol2 Ping identity; device READ replies unavailable, so no device readback is claimed';
  }else{
   if(kind==='protocol-transition'&&!sameProtocol){await close();await open(requested);result.location.protocol=requested;}
   await identity(c,target,activeModel);const observedRead=reader(activeModel,c,target);result.observed=await observedRead(item.name);
   const equivalent=item.write.normalizationTable?.find(r=>requested>=r.input[0]&&requested<=r.input[1])?.effective;
   const accepted=item.write.readbackValues?.includes(result.observed)||result.observed===requested||equivalent===result.observed;
   if(!accepted)throw Error('Item readback mismatch; no automatic retry or rollback');
   if(beforeProtocol)for(const[name,expected]of Object.entries(beforeProtocol))if(await observedRead(name)!==expected)throw Error('Protocol transition snapshot continuity mismatch');
   if(item.name==='Operating Mode'){
    result.after={};for(const name of ['Operating Mode','Torque Enable','Profile Velocity','Profile Acceleration','Goal Current','Goal PWM','Position P Gain','Present Position'])if(tableFor(model).some(i=>i.name===name))result.after[name]=await observedRead(name);
   }
   result.outcome=item.write.pendingReadbackValues?.includes(result.observed)?'accepted-pending':'verified';
   result.meaning=result.outcome==='verified'?'Register state/equivalent documented representation verified; not physical behavior or trajectory completion':'Documented command accepted; processing remains pending and requires read-only status inspection';
  }
 }catch(e){if(e.name==='TransportClosureError')closureUnconfirmed=true;result.outcome=attempted?'uncertain':'not_written';result.error=e.message;}
 try{await close();}catch(e){result.error=e.message;result.outcome=attempted?'uncertain':'not_written';}
 result.closureConfirmed=!closureUnconfirmed;return result;
}
