// Byte-addressed in-memory motors only; no serial imports or host discovery.
import {itemsFor} from '../../modules/dynamixel/item-metadata.mjs';
import {encode,decode} from '../../modules/dynamixel/registry.mjs';
export function fullTableDevice(model,options={}){
 const items=itemsFor(model.catalogId),byName=new Map(items.map(i=>[i.name,i]));const endpoints=new Map(),calls=[],writes=[];
 const initialId=options.id??1,initialRate=options.baud??Number(Object.keys(model.bauds)[0]),firmware=options.firmware??52,wire=options.protocol??(model.protocols.includes(2)?2:1),peerIds=model.dualAxis?[initialId===2?1:2]:[];
 const field=(name)=>{const i=byName.get(name);if(!i)throw Error('Fixture item absent: '+name);return i;};
 const bytesAt=(state,address,width)=>Uint8Array.from({length:width},(_,n)=>state.memory.get(address+n)??0);
 const store=(state,name,value)=>{if(!byName.has(name))return;const i=field(name);const bytes=encode(value,i.width,value<0?'twos-complement':'unsigned');bytes.forEach((b,n)=>state.memory.set(i.address+n,b));};
 const valueAt=(state,name)=>{const i=field(name);return decode(bytesAt(state,i.address,i.width),i.encoding==='twos-complement'?'twos-complement':'unsigned');};
 for(const id of [initialId,...peerIds]){
  const state={id,rate:initialRate,protocol:wire,memory:new Map()};
  for(const i of items){const text=i.rawCells.initialvalue??i.rawCells.initial??'';const initial=/^-?\d+$/.test(text)?Number(text):0;if(i.width<=4)try{store(state,i.name,initial);}catch{store(state,i.name,0);}}
  for(const [name,value]of Object.entries({'Model Number':model.modelNumbers[0],'Firmware Version':firmware,'ID':id,'Baud Rate':model.bauds[String(initialRate)],'Torque Enable':options.torque??0,'Operating Mode':options.mode??3,'Control Mode':2,'Drive Mode':options.drive??0,'Status Return Level':2,'Secondary(Shadow) ID':255,'Secondary ID':255,'Bus Watchdog':0,'Lock':0,'Current Limit':100,'Torque Limit':100,'Velocity Limit':1000,'Acceleration Limit':1000,'PWM Limit':1000,'Min Position Limit':0,'Max Position Limit':4095,'CW Angle Limit':0,'CCW Angle Limit':1023,'Controller State':0}))store(state,name,value);
  if(byName.has('Protocol Type'))store(state,'Protocol Type',byName.get('Protocol Type').write.status==='manufacturer-unresolved'?3:wire);
  // Configure every alias independently to a documented one-byte RAM target.
  const target=byName.get('LED')??byName.get('Torque Enable');
  for(const i of items)if(i.name.startsWith('Indirect Address '))store(state,i.name,target.address);
  endpoints.set(id,state);
 }
 const physical=(state,address,seen=new Set(),depth=0)=>{
  const data=items.find(i=>i.address===address&&i.name.startsWith('Indirect Data '));if(!data)return address;
  if(depth>=8||seen.has(address))throw Error('Fixture alias cycle');const next=new Set(seen).add(address);
  return physical(state,valueAt(state,'Indirect Address '+data.name.slice('Indirect Data '.length)),next,depth+1);
 };
 let applied=0;
 const connect=async(rate,timeout,protocol=wire)=>{
  calls.push(['connect',rate,protocol]);let closed=false;
  const stateFor=id=>{if(closed)throw Error('Fixture connection closed');const s=endpoints.get(id);if(!s||s.rate!==rate||s.protocol!==protocol||options.disconnectAfterWrite&&applied)throw Error('packet timeout');return s;};
  const probe=async id=>{calls.push(['probe',id,rate,protocol]);try{const s=stateFor(id);return {id,present:true,...(protocol===2?{modelNumber:options.wrongIdentityAfterWrite&&applied?999:model.modelNumbers[0],firmwareVersion:firmware}:{})};}catch(e){if(e.message==='packet timeout')return null;throw e;}};
  return {
   probe,ping:async id=>{const p=await probe(id);if(!p)throw Error('packet timeout');return p;},canBaud:async()=>true,
   read:async(id,address,size)=>{const s=stateFor(id);if(valueAt(s,'Status Return Level')===0){const e=Error('READ reply suppressed by documented SRL0');e.kind='no-response';throw e;}calls.push(['read',id,address,size,rate,protocol]);return Uint8Array.from({length:size},(_,n)=>s.memory.get(physical(s,address+n))??0);},
   bind:async binding=>{calls.push(['bind',binding]);},
   write:async(id,address,data,opts={})=>{
    const s=stateFor(id);calls.push(['write',id,address,[...data],rate,protocol]);writes.push({id,address,data:[...data],rate,protocol,expectStatus:opts.expectStatus});if(options.failBeforeApply)throw Error('packet write failure');
    const destinations=[...data].map((_,n)=>physical(s,address+n));data.forEach((v,n)=>s.memory.set(destinations[n],v));applied++;
    const newId=valueAt(s,'ID');if(newId!==s.id){endpoints.delete(s.id);s.id=newId;endpoints.set(newId,s);}
    const baudValue=valueAt(s,'Baud Rate'),newRate=Number(Object.entries(model.bauds).find(([,v])=>v===baudValue)?.[0]??s.rate);
    if(newRate!==s.rate)for(const p of model.dualAxis?endpoints.values():[s]){p.rate=newRate;store(p,'Baud Rate',baudValue);}
    if(byName.has('Protocol Type')){const newWire=valueAt(s,'Protocol Type');if([1,2].includes(newWire)&&newWire!==s.protocol)for(const p of model.dualAxis?endpoints.values():[s]){p.protocol=newWire;store(p,'Protocol Type',newWire);}}
    if(byName.has('Hybrid Save')&&valueAt(s,'Hybrid Save')===1&&!options.pendingSave)store(s,'Hybrid Save',2);
    if(options.loseAckAfterWrite)throw Error('packet acknowledgement timeout');
    return opts.expectStatus===false?{transmitted:true}:{acknowledged:true};
   },close:async()=>{closed=true;calls.push(['close']);if(options.closeFailure)throw Error('closure unconfirmed');}
  };
 };
 const request={id:initialId,baud:initialRate,model:model.modelNumbers[0],firmware,protocol:wire,catalogId:model.catalogId,peerIds,addressingVerified:true};
 return {items,byName,endpoints,calls,writes,connect,request,get:(name,id=initialId)=>valueAt(endpoints.get(id),name),set:(name,value,id=initialId)=>store(endpoints.get(id),name,value)};
}
