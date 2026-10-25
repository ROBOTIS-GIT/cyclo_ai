import {randomUUID} from 'node:crypto';
import {modelFor} from './registry.mjs';

/** Session state only. No operator-file writes, hardware calls or new grants. */
export class TargetSession {
  constructor(config,{clock=()=>Date.now(),ttlMs=300000}={}) {
    this.clock=clock;this.ttlMs=ttlMs;
    this.targets=new Map(Object.entries(config.targets??{}).map(([name,t])=>[name,{...t,status:'ready',revision:0}]));
    this.buses=config.buses??{};this.scans=new Map();
  }
  resolve({bus,target}) {
    if(Boolean(bus)===Boolean(target))throw Error('Choose exactly one named bus or target');
    const value=bus?this.buses[bus]:this.targets.get(target);
    if(!value)throw Error('Unknown bus/target; configure a port-only bus for discovery');
    return value;
  }
  recordScan(bus,result,verifyBinding) {
    if(!result.complete||!result.closureConfirmed||result.busReservationReleased!==true)return null;
    for(const [id,s] of this.scans)if(s.bus.port===bus.port)this.scans.delete(id);
    const scanId=randomUUID();
    const candidates=result.devices.map(device=>({...device,candidateId:randomUUID()}));
    this.scans.set(scanId,{bus:{...bus},candidates,expires:this.clock()+this.ttlMs,verifyBinding});
    // Bound session memory and retire oldest observations without touching hardware.
    while(this.scans.size>32)this.scans.delete(this.scans.keys().next().value);
    return {scanId,candidates,expiresAt:new Date(this.clock()+this.ttlMs).toISOString()};
  }
  async select({scanId,candidateId,name,confirmed,isolatedBus,catalogId,peerIds=[]}) {
    if(!confirmed||!isolatedBus)throw Error('Explicit target confirmation and physically isolated single-device bus attestation are required');
    if(!/^[a-zA-Z0-9_-]{1,48}$/.test(name))throw Error('Use a short target name containing letters, digits, underscore or hyphen');
    if(this.targets.has(name))throw Error('Target name already exists; choose a new name instead of silently replacing it');
    const record=this.scans.get(scanId);
    if(!record||record.expires<=this.clock())throw Error('Scan observation expired or belongs to another session; scan again before selection');
    const candidate=record.candidates.find(c=>c.candidateId===candidateId);
    if(!candidate)throw Error('Candidate is not part of this completed scan');
    if(candidate.identityComplete===false)throw Error('Presence observed but identity is incomplete: resolve identity reads before selection; no Status Return Level writes');
    const model=modelFor(candidate.modelNumber,candidate.firmwareVersion,catalogId,candidate.protocol);
    if(record.candidates.length!==1||model.dualAxis){
      const peer=record.candidates.filter(c=>c.candidateId!==candidateId);
      if(!model.dualAxis||peerIds.length!==1||peer.length!==1||peer[0].id!==peerIds[0]||peer[0].modelNumber!==candidate.modelNumber||peer[0].firmwareVersion!==candidate.firmwareVersion||peer[0].baud!==candidate.baud||peer[0].protocol!==candidate.protocol||peer[0].identityComplete!==true)throw Error('Multiple responders: isolate one physical unit; dual-axis selection requires the explicitly observed peer endpoint');
    }
    if(model.dualAxis&&peerIds.length!==1)throw Error('Dual-axis unit requires explicitly observed other-axis ID');
    if(!model.dualAxis&&peerIds.length)throw Error('Peer endpoints are only applicable to a verified dual-axis unit');
    if(!record.bus.allowConfigure)throw Error('Bus is scan-only; selection cannot expand operator configuration permissions');
    if('model' in record.bus&&(candidate.modelNumber!==record.bus.model||candidate.firmwareVersion!==record.bus.firmware||candidate.id!==record.bus.id||candidate.baud!==record.bus.baud||record.bus.protocol!==undefined&&candidate.protocol!==record.bus.protocol||record.bus.catalogId!==undefined&&model.catalogId!==record.bus.catalogId))throw Error('A target-specific grant cannot authorize a different device identity or rate; use a separately authorized port-only bus');
    if('model' in record.bus&&JSON.stringify([...peerIds].sort((a,b)=>a-b))!==JSON.stringify([...(record.bus.peerIds??[])].sort((a,b)=>a-b)))throw Error('Target-specific axis cohort changed; use a separately authorized port-only bus');
    // OS binding verification only; device identity is checked again on every operation.
    await record.verifyBinding();
    if(this.scans.get(scanId)!==record||record.expires<=this.clock())throw Error('Observation changed during selection; scan again');
    this.retirePort(record.bus.port,'superseded by explicit selection');
    const target={port:record.bus.port,model:candidate.modelNumber,firmware:candidate.firmwareVersion,id:candidate.id,baud:candidate.baud,protocol:candidate.protocol??model.protocol,catalogId:model.catalogId,peerIds,isolatedBus:true,allowScan:record.bus.allowScan,allowConfigure:true,status:'ready',revision:0,verifyBinding:record.verifyBinding};
    this.targets.set(name,target);this.scans.delete(scanId);
    return this.describe(name);
  }
  retirePort(port,reason,except) {
    for(const [name,t] of this.targets)if(t.port===port&&name!==except){t.status='reconciliation-required';t.reason=reason;}
    for(const [id,s] of this.scans)if(s.bus.port===port)this.scans.delete(id);
  }
  clearObservations(port){for(const [id,s] of this.scans)if(s.bus.port===port)this.scans.delete(id);}
  target(name) {
    const t=this.targets.get(name);
    if(!t)throw Error('Select one target from a completed scan or operator config');
    if(t.status!=='ready')throw Error('Target requires reconciliation: confirm closure/exclusive bus ownership, then scan and explicitly select again; no blind write retry');
    return t;
  }
  settle(name,result) {
    const t=this.targets.get(name);if(!t)return;
    if(result.outcome==='verified'&&result.closureConfirmed&&result.busReservationReleased===true){
      const changed=t.id!==result.location.id||t.baud!==result.location.baud;
      if(changed)this.retirePort(t.port,'communication identity changed; select again',name);
      t.id=result.location.id;t.baud=result.location.baud;t.revision++;
    }else if(result.outcome!=='verified'||result.closureConfirmed===false||result.busReservationReleased===false){
      this.retirePort(t.port,'uncertain device or bus state');
    }
    result.sessionTarget=this.describe(name);
  }
  describe(name) {
    const {verifyBinding,...target}=this.targets.get(name);
    return {name,...target,persistence:'session only; operator config file is unchanged'};
  }
  list(){return [...this.targets.keys()].map(name=>this.describe(name));}
}
