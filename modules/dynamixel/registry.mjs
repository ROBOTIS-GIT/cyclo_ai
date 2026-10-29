import {CUSTOM} from './custom.mjs';
import {descriptor} from './item-metadata.mjs';
// Build-time, source-bound metadata; runtime document text cannot grant writes.
import {readFileSync} from 'node:fs';
export const CATALOG=JSON.parse(readFileSync(new URL('../../references/control-tables.json',import.meta.url),'utf8'));
CATALOG.models.push(...CUSTOM.models);
export const MODELS=Object.freeze(CATALOG.models.filter(m=>m.kind==='actuator').map(m=>({...m,capabilities:Object.fromEntries(Object.entries(m.capabilities).map(([op,c])=>{
 const names=[...(c.register?[c.register]:[]),...(c.channels??[]),...(c.registers??[]).filter(n=>n!=='Drive Mode')];
 return [op,{...c,...(c.status==='resolved'?{requiresTorqueOff:names.some(n=>descriptor(m.catalogId,n)?.write.requiresTorqueOff===true)}:{})}];
}))})));
export const SCAN_BAUDS=[...new Set(MODELS.flatMap(m=>Object.keys(m.bauds).map(Number)))].sort((a,b)=>a-b);
export function candidatesFor(number,protocol){return MODELS.filter(m=>m.modelNumbers.includes(number)&&(!protocol||m.protocols.includes(protocol)));}
export function modelFor(number,firmware,catalogId,protocol){
 if(!Number.isInteger(number)||!Number.isInteger(firmware)||firmware<0||firmware>255)throw Error('Unknown model/firmware identity: an observed firmware byte is required');
 if(!catalogId?.startsWith('custom/')&&CATALOG.models.some(m=>m.modbusModelNumbers?.includes(number)))throw Error('Modbus firmware identity is outside the DYNAMIXEL packet transport; do not substitute its Protocol 2 identity');
 const candidates=candidatesFor(number,protocol),m=catalogId?candidates.find(m=>m.catalogId===catalogId):candidates.length===1?candidates[0]:null;
 if(!m)throw Error(candidates.length>1?'Ambiguous model number: confirm exact catalog identity; never guess connector or marketed variant':'Unknown identity/protocol or catalog mismatch; documentation lookup remains available');
 if(m.customFirmwares&&!m.customFirmwares.includes(firmware))throw Error('Firmware is outside the reviewed custom contract');
 return {...m,idMaximum:descriptor(m.catalogId,'ID')?.write.bounds?.[1]??252,observedFirmware:firmware,protocol:protocol??(m.protocols.includes(2)?2:1)};
}
export function capability(m,name){const c=m.capabilities[name];if(!c||c.status!=='resolved')throw Error(`Capability ${name} ${c?.status??'unsupported'}: ${c?.reason??'no source-bound metadata'}`);return c;}
export const registerNames={model:'Model Number',firmware:'Firmware Version',id:'ID',baud:'Baud Rate',drive:'Drive Mode',operatingMode:'Operating Mode',secondaryId:'Secondary(Shadow) ID',protocol:'Protocol Type',velocityLimit:'Velocity Limit',accelerationLimit:'Acceleration Limit',torque:'Torque Enable',led:'LED',profileAcceleration:'Profile Acceleration',profileVelocity:'Profile Velocity',lock:'Lock'};
export function readsFor(m){return Object.fromEntries(Object.entries(registerNames).flatMap(([key,name])=>m.registers[name]&&(!['drive','profileAcceleration','profileVelocity'].includes(key)||m.observedFirmware>= (m.capabilities.profile?.driveMinimumFirmware??0))?[[key,[m.registers[name].address,m.registers[name].width]]]:[]));}
export function encode(value,size,encoding='unsigned'){
 if(![1,2,4].includes(size)||!Number.isInteger(value))throw Error('Invalid typed integer encoding');
 const bits=8*size,min=encoding==='twos-complement'?-(2**(bits-1)):0,max=encoding==='twos-complement'?2**(bits-1)-1:2**bits-1;
 if(value<min||value>max)throw Error('Integer exceeds register width/encoding');
 let n=BigInt(value);if(n<0)n+=1n<<BigInt(bits);
 return Uint8Array.from({length:size},(_,i)=>Number((n>>BigInt(8*i))&255n));
}
export function decode(b,encoding='unsigned') {if(![1,2,4].includes(b.length))throw Error('Unexpected register read width');let n=b.reduce((n,v,i)=>n+v*2**(8*i),0);if(encoding==='twos-complement'&&n>=2**(b.length*8-1))n-=2**(b.length*8);return n;}
