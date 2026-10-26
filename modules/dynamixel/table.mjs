// Canonical, build-time per-item semantics. Never derive write addresses from chat.
import {readFileSync} from 'node:fs';
import {modelFor,encode,decode} from './registry.mjs';
import {identify} from './identity.mjs';
import {configure} from './workflow.mjs';
export const ITEMS=JSON.parse(readFileSync(new URL('../../references/control-items.json',import.meta.url),'utf8'));
export function tableFor(model){return ITEMS.models.find(m=>m.catalogId===model.catalogId)?.items??[];}
export function itemFor(model,key){const matches=tableFor(model).filter(i=>i.key===key||i.name===key);if(matches.length!==1)throw Error('Unknown or ambiguous item name/key; inspect dynamixel_table first');return matches[0];}
export function writeRequest(model,item,value){
 const r=item.write;
 if(item.access==='R')throw Error('Official Control Table item is read-only');
 if(!['RW','R/RW'].includes(item.access))throw Error('Official access semantics are unresolved');
 if(r.status!=='resolved')throw Error(`Unresolved item semantics: ${r.reason}. Exact source: ${item.source.path}:${item.source.line}`);
 if(!Number.isSafeInteger(value))throw Error('Supply an exact integer in documented raw units; physical-unit conversion is not guessed');
 if(r.kind==='id-transition'){if(value<0||value>252)throw Error('Destination ID exceeds conservative unicast bound');return;}
 if(r.kind==='baud-transition'){if(!Object.values(model.bauds).includes(value))throw Error('Baud register enum is not documented for this model');return;}
 encode(value,item.width,r.encoding);
 if(r.values&&!r.values.includes(value))throw Error('Value is not a documented enum/sentinel');
 if(r.bounds&&(value<r.bounds[0]||value>r.bounds[1]))throw Error('Value outside documented range');
 if(model.observedFirmware<(r.minimumFirmware??0))throw Error('Observed firmware does not support this item');
}
function reader(model,connection,target){return async name=>{const item=itemFor(model,name);if(item.readStatus!=='resolved-raw')throw Error('Required precondition item has unresolved source metadata');const bytes=await connection.read(target.id,item.address,item.width);return decode(bytes,item.encoding==='twos-complement'?'twos-complement':'unsigned');};}
export async function validateConditions(model,item,value,read){
 const rule=item.write,observed={};const get=async n=>Object.hasOwn(observed,n)?observed[n]:observed[n]=await read(n);
 if(rule.requiresTorqueOff&&await get('Torque Enable')!==0)throw Error('EEPROM/item precondition requires torque already off; no implicit torque command');
 if(rule.requiresTorqueOff&&model.registers.Lock&&await get('Lock')!==0)throw Error('EEPROM is locked; no automatic unlock');
 if(rule.requiresMode){
  const mode=await get('Operating Mode');if(!rule.modes.includes(mode))throw Error('Item unsupported in observed Operating Mode; no automatic mode change');
  if(rule.modeBounds){const limits=rule.modeBounds[String(mode)];const min=limits.minItem?await get(limits.minItem):limits.min,max=limits.maxItem?await get(limits.maxItem):limits.max;if(value<min||value>max)throw Error('Goal exceeds documented mode-specific position bounds');}
 }
 if(rule.dynamicLimit){const limit=await get(rule.dynamicLimit);if(Math.abs(value)>limit)throw Error('Goal exceeds observed dynamic limit');}
 for(const [name,bits]of Object.entries(rule.forbiddenBits??{}))if((await get(name))&bits)throw Error('Configured control bits would enable torque implicitly; change them only in a separately requested operation');
 for(const [name,values]of Object.entries(rule.forbiddenStates??{}))if(values.includes(await get(name)))throw Error('Controller state does not currently permit this write');
 return observed;
}
async function identity(connection,target,model){const found=await identify(connection,target.id,model.protocol);if(!found?.identityComplete||found.modelNumber!==target.model||found.firmwareVersion!==target.firmware)throw Error('Selected target identity/protocol/firmware changed');}
export async function readItems(connect,target,keys,{signal}={}){
 const model=modelFor(target.model,target.firmware,target.catalogId,target.protocol);const items=keys.map(k=>itemFor(model,k));
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
 const model=modelFor(target.model,target.firmware,target.catalogId,target.protocol),item=itemFor(model,key);writeRequest(model,item,value);
 if(model.dualAxis&&(target.peerIds?.length!==1||target.peerIds[0]===target.id))throw Error('Distinct verified dual-axis peer cohort is required');
 if(!target.addressingVerified&&!target.isolatedBus)throw Error('Verify unique addressing, including duplicate IDs and secondary listeners, before writing');
 if(item.write.kind==='id-transition'||item.write.kind==='baud-transition'){
  const changes=item.write.kind==='id-transition'?{id:value}:{baud:Number(Object.keys(model.bauds).find(b=>model.bauds[b]===value))};
  return configure(connect,{...target,changes},{signal});
 }
 const result={outcome:'not_written',item:item.key,requested:value,location:{id:target.id,baud:target.baud,protocol:model.protocol},warnings:item.write.warnings??[],source:item.source};let c,attempted=false,closureUnconfirmed=false;
 try{
  if(signal?.aborted)throw Error('Write cancelled');c=await connect(target.baud,100,model.protocol);await identity(c,target,model);const read=reader(model,c,target);
  result.before=await read(item.name);result.preconditions=await validateConditions(model,item,value,read);
  if(model.dualAxis&&item.write.requiresTorqueOff){if(target.peerIds?.length!==1)throw Error('Required peer cohort is unverified');for(const id of target.peerIds){const peer={...target,id};await identity(c,peer,model);if(await reader(model,c,peer)('Torque Enable')!==0)throw Error('Both axes must already be torque-off for EEPROM writes');}}
  // Explicit item grant is revalidated against the same canonical metadata by Python.
  if(c.bind)await c.bind({catalogId:model.catalogId,model:target.model,firmware:target.firmware,id:target.id,peerIds:target.peerIds??[],tableItem:item.key});
  if(signal?.aborted)throw Error('Write cancelled');
  attempted=true;try{await c.write(target.id,item.address,encode(value,item.width,item.write.encoding));}catch(e){result.ackError=e.message;}
  if(signal?.aborted)throw Error('Write interrupted; never repeat automatically');
  await identity(c,target,model);result.observed=await read(item.name);if(result.observed!==value)throw Error('Item readback mismatch; no automatic retry or rollback');
  if(item.name==='Operating Mode'){
   result.after={};for(const name of ['Operating Mode','Torque Enable','Profile Velocity','Profile Acceleration','Goal Current','Goal PWM','Position P Gain','Present Position'])if(model.registers[name])result.after[name]=await read(name);
  }
  result.outcome='verified';result.meaning='Register state verified; does not certify physical behavior or trajectory completion';
 }catch(e){if(e.name==='TransportClosureError')closureUnconfirmed=true;result.outcome=attempted?'uncertain':'not_written';result.error=e.message;}
 try{if(c)await c.close();result.closureConfirmed=!closureUnconfirmed;}catch(e){result.closureConfirmed=false;result.error=e.message;result.outcome=attempted?'uncertain':'not_written';}
 return result;
}
