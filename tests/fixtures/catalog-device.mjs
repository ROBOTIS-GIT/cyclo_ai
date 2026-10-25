import {encode} from '../../modules/dynamixel/registry.mjs';
// In-memory control tables only. No transport modules or host port enumeration.
export function catalogDevice(m,{firmware=52,protocol=m.protocols.includes(2)?2:1,id=1,baud=57600,peerIds=m.dualAxis?[2]:[],drive=0,occupied=false,loseAfterWrite=false,peerTorque=0,unsupportedBaud=false}={}){
 const calls=[],writes=[],endpoints=new Map(),rates=new Set(Object.keys(m.bauds).map(Number));
 if(!rates.has(baud))baud=[...rates][0];
 for(const endpoint of [id,...peerIds]){
  const regs=new Map(Object.values(m.registers).map(r=>[r.address,0]));
  for(const[name,value]of Object.entries({'Model Number':m.modelNumbers[0],'Firmware Version':firmware,'ID':endpoint,'Baud Rate':m.bauds[String(baud)],'Torque Enable':endpoint===id?0:peerTorque,'Operating Mode':3,'Drive Mode':drive,'Protocol Type':protocol,'Secondary(Shadow) ID':255,'Velocity Limit':10000,'Acceleration Limit':10000,'Lock':0}))if(m.registers[name])regs.set(m.registers[name].address,value);
  endpoints.set(endpoint,regs);
 }
 let currentBaud=baud,writeCount=0;
 const connect=async(rate,timeout,wire=protocol)=>{
  calls.push(['connect',rate,wire]);
  const present=endpoint=>wire===protocol&&rate===currentBaud&&endpoints.has(endpoint)&&!(loseAfterWrite&&writeCount);
  const ping=async endpoint=>{if(!present(endpoint))return null;return {id:endpoint,present:true,...(wire===2?{modelNumber:m.modelNumbers[0],firmwareVersion:firmware}:{})};};
  return {
   ping:async endpoint=>{const p=await ping(endpoint);if(!p)throw Error('packet timeout');return p;},
   probe:async endpoint=>occupied&&!endpoints.has(endpoint)?{id:endpoint,present:true}:ping(endpoint),
   read:async(endpoint,address,size)=>{if(!present(endpoint))throw Error('packet timeout');calls.push(['read',endpoint,address,size]);return encode(endpoints.get(endpoint).get(address)??0,size);},
   canBaud:async()=>!unsupportedBaud,
   write:async(endpoint,address,data)=>{
    if(!present(endpoint))throw Error('packet timeout');const value=data.reduce((n,b,i)=>n+b*2**(8*i),0);writes.push({id:endpoint,address,data:[...data],value});writeCount++;
    const regs=endpoints.get(endpoint);regs.set(address,value);
    if(address===m.registers.ID.address){endpoints.delete(endpoint);endpoints.set(value,regs);}
    if(address===m.registers['Baud Rate'].address){currentBaud=Number(Object.entries(m.bauds).find(([,code])=>code===value)[0]);for(const r of endpoints.values())r.set(address,value);}
   },close:async()=>{calls.push(['close']);}
  };
 };
 return {connect,calls,writes,endpoints,request:{id,baud,protocol,model:m.modelNumbers[0],firmware,catalogId:m.catalogId,peerIds,isolatedBus:true}};
}
