import {randomUUID} from 'node:crypto';
import {modelFor} from './registry.mjs';

/** Session state only. No operator-file writes, hardware calls or new grants. */
export class TargetSession {
  constructor(config,{clock=()=>Date.now(),ttlMs=300000,dynamicPorts=true}={}) {
    this.clock=clock;this.ttlMs=ttlMs;this.dynamicPorts=dynamicPorts;
    this.targets=new Map(Object.entries(config.targets??{}).map(([name,t])=>[name,{...t,status:'ready',revision:0}]));
    this.buses=config.buses??{};this.scans=new Map();
  }
  resolve({bus,target,port}) {
    if([bus,target,port].filter(Boolean).length!==1)throw Error('Choose exactly one named bus, target or explicitly selected port');
    if(port){
      if(!this.dynamicPorts)throw Error('Explicit operator policy is loaded; choose its named bus/target rather than bypassing canonical port restrictions through an alias');
      const existing=[...Object.values(this.buses),...this.targets.values()].filter(t=>t.port===port);
      if(existing.some(t=>t.allowScan===false||t.allowConfigure===false))throw Error('Explicit operator policy restricts this port; do not bypass it through dynamic selection');
      return {port,allowScan:true,allowConfigure:true};
    }
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
  async select({scanId,candidateId,name,confirmed,isolatedBus=false,addressingVerified=false,catalogId,peerIds=[]}) {
    if(!confirmed||(!isolatedBus&&!addressingVerified))throw Error('Explicit target confirmation and verified unique addressing are required; a scan alone cannot exclude duplicate IDs or secondary listeners');
    if(!/^[a-zA-Z0-9_-]{1,48}$/.test(name))throw Error('Use a short target name containing letters, digits, underscore or hyphen');
    if(this.targets.has(name))throw Error('Target name already exists; choose a new name instead of silently replacing it');
    const record=this.scans.get(scanId);
    if(!record||record.expires<=this.clock())throw Error('Scan observation expired or belongs to another session; scan again before selection');
    const candidate=record.candidates.find(c=>c.candidateId===candidateId);
    if(!candidate)throw Error('Candidate is not part of this completed scan');
    if(candidate.identityComplete===false)throw Error('Presence observed but identity is incomplete: resolve identity reads before selection; no Status Return Level writes');
    const model=modelFor(candidate.modelNumber,candidate.firmwareVersion,catalogId,candidate.protocol);
    const sameAddress=record.candidates.filter(c=>c.id===candidate.id&&c.baud===candidate.baud&&c.protocol===candidate.protocol);
    if(sameAddress.length!==1)throw Error('Ambiguous responder address; resolve duplicate IDs before selection');
    if(model.dualAxis){
      const peer=record.candidates.filter(c=>peerIds.includes(c.id)&&c.baud===candidate.baud&&c.protocol===candidate.protocol);
      if(peerIds.length!==1||peerIds[0]===candidate.id||peer.length!==1||peer[0].modelNumber!==candidate.modelNumber||peer[0].firmwareVersion!==candidate.firmwareVersion||peer[0].identityComplete!==true)throw Error('Dual-axis selection requires the explicitly observed peer endpoint');
    }
    if(model.dualAxis&&peerIds.length!==1)throw Error('Dual-axis unit requires explicitly observed other-axis ID');
    if(!model.dualAxis&&peerIds.length)throw Error('Peer endpoints are only applicable to a verified dual-axis unit');
    if(!record.bus.allowConfigure)throw Error('Bus is scan-only; selection cannot expand operator configuration permissions');
    if('model' in record.bus&&(candidate.modelNumber!==record.bus.model||candidate.firmwareVersion!==record.bus.firmware||candidate.id!==record.bus.id||candidate.baud!==record.bus.baud||record.bus.protocol!==undefined&&candidate.protocol!==record.bus.protocol||record.bus.catalogId!==undefined&&model.catalogId!==record.bus.catalogId))throw Error('A target-specific grant cannot authorize a different device identity or rate; use a separately authorized port-only bus');
    if('model' in record.bus&&JSON.stringify([...peerIds].sort((a,b)=>a-b))!==JSON.stringify([...(record.bus.peerIds??[])].sort((a,b)=>a-b)))throw Error('Target-specific axis cohort changed; use a separately authorized port-only bus');
    // OS binding verification only; device identity is checked again on every operation.
    await record.verifyBinding();
    if(this.scans.get(scanId)!==record||record.expires<=this.clock())throw Error('Observation changed during selection; scan again');
    if([...this.targets.values()].some(t=>t.status==='ready'&&t.port===record.bus.port&&t.id===candidate.id&&t.baud===candidate.baud&&(t.protocol??candidate.protocol)===candidate.protocol))throw Error('This address is already selected; reuse its existing target');
    const target={port:record.bus.port,model:candidate.modelNumber,firmware:candidate.firmwareVersion,id:candidate.id,baud:candidate.baud,protocol:candidate.protocol??model.protocol,catalogId:model.catalogId,peerIds,isolatedBus,addressingVerified:addressingVerified||isolatedBus,allowScan:record.bus.allowScan,allowConfigure:true,status:'ready',revision:0,verifyBinding:record.verifyBinding};
    this.targets.set(name,target);this.scans.delete(scanId);
    return this.describe(name);
  }
  retirePort(port,reason,except) {
    for(const [name,t] of this.targets)if(t.port===port&&name!==except){t.status='reconciliation-required';t.reason=reason;}
    for(const [id,s] of this.scans)if(s.bus.port===port)this.scans.delete(id);
  }
  clearObservations(port){for(const [id,s] of this.scans)if(s.bus.port===port)this.scans.delete(id);}
  knownSecondaryListeners(target) {
    const wire=t=>{if(t.protocol!==undefined)return t.protocol;try{return modelFor(t.model,t.firmware,t.catalogId).protocol;}catch{return undefined;}};
    return [...this.targets].filter(([name,t])=>t!==target&&t.id!==target.id&&(t.canonicalPort??t.port)===(target.canonicalPort??target.port)&&t.baud===target.baud&&wire(t)===wire(target)&&t.secondaryId===target.id&&t.secondaryId<253).map(([name])=>name);
  }
  assertWriteAddress(target,{ram=false}={}) {
    const listeners=this.knownSecondaryListeners(target);
    if(ram&&listeners.length)throw Error('Known secondary listeners would receive this one-target RAM write: '+listeners.join(', ')+'. Read/EEPROM access is separate; no group write is inferred.');
  }
  target(name) {
    const t=this.targets.get(name);
    if(!t)throw Error('Select one target from a completed scan or operator config');
    if(t.status==='read-disabled-by-command')throw Error('The last explicit Status Return Level0 command disabled READ replies. This is a device observability constraint, not a plugin permission; re-identify through a manufacturer-supported method before further writes.');
    if(t.status!=='ready')throw Error('Target requires reconciliation: confirm closure/exclusive bus ownership, then scan and explicitly select again; no blind write retry');
    return t;
  }
  settle(name,result) {
    const t=this.targets.get(name);if(!t)return;
    if(['verified','accepted-pending'].includes(result.outcome)&&result.closureConfirmed&&result.busReservationReleased===true){
      const changed=t.id!==result.location.id||t.baud!==result.location.baud||result.location.protocol!==undefined&&t.protocol!==result.location.protocol;
      if(changed)this.retirePort(t.port,'communication identity changed; select again',name);
      t.id=result.location.id;t.baud=result.location.baud;if(result.location.protocol!==undefined)t.protocol=result.location.protocol;t.revision++;if(result.outcome==='verified'){delete t.observability;delete t.reason;}
      if(['Secondary ID','Secondary(Shadow) ID'].includes(result.effectItem))t.secondaryId=result.effectiveValue??result.requested;
    }else if(result.outcome==='not_written'&&result.identityVerifiedBefore&&result.closureConfirmed&&result.busReservationReleased===true){
      t.lastOutcome='not_written';t.lastReason=result.error;
    }else if(result.outcome==='transmitted-unverifiable'&&['read-disabled-by-command','read-unavailable'].includes(result.observability)&&result.closureConfirmed&&result.busReservationReleased===true){
      t.observability=result.observability;t.status=t.protocol===2?'ready':'read-disabled-by-command';t.reason='READ replies unavailable; only independently verifiable documented operations can proceed, with no automatic retry/restore';
    }else if(result.outcome!=='verified'||result.closureConfirmed===false||result.busReservationReleased===false){
      this.retirePort(t.port,'uncertain device or bus state');
    }
    result.sessionTarget=this.describe(name);
  }
  describe(name) {
    const {verifyBinding,...target}=this.targets.get(name);
    return {name,...target,knownSecondaryListeners:this.knownSecondaryListeners(this.targets.get(name)),persistence:'session only; operator config file is unchanged'};
  }
  list(){return [...this.targets.keys()].map(name=>this.describe(name));}
}
