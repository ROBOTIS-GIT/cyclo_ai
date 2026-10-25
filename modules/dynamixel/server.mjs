import {McpServer} from '@modelcontextprotocol/server';
import {serveStdio} from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {TargetSession} from './selection.mjs';
import {listModels,readManual} from './manual.mjs';
import {MODELS,CATALOG} from './registry.mjs';
import {configure,scan,scanPlan,validateRequest} from './workflow.mjs';
import {acquireBusLease} from '../firmware/upstream/tools/cyclo_firmware_mcp/src/bus-lease.mjs';
const targetSchema=z.strictObject({port:z.string().min(1),model:z.number().int(),firmware:z.number().int(),id:z.number().int().min(0).max(252),baud:z.number().int(),protocol:z.union([z.literal(1),z.literal(2)]).optional(),catalogId:z.string().optional(),peerIds:z.array(z.number().int().min(0).max(252)).max(1).optional(),isolatedBus:z.boolean(),allowScan:z.boolean().default(false),allowConfigure:z.boolean().default(false)});
const busSchema=z.strictObject({port:z.string().min(1),allowScan:z.boolean().default(false),allowConfigure:z.boolean().default(false)});
const configSchema=z.strictObject({allowPortDiscovery:z.boolean().default(false),buses:z.record(z.string(),busSchema).default({}),targets:z.record(z.string(),targetSchema).default({})});
const profile=z.discriminatedUnion('mode',[
 z.strictObject({mode:z.literal('time'),totalMs:z.number().int(),accelerationMs:z.number().int()}),
 z.strictObject({mode:z.literal('velocity'),rpm:z.number(),accelerationRpm2:z.number(),maxRpm:z.number(),maxAccelerationRpm2:z.number()})
]);
export async function createProductsServer(env=process.env,dependencies={}) {
 const enabled=env.CYCLO_PRODUCTS_ENABLE_HARDWARE==='1';
 const config=env.CYCLO_PRODUCTS_CONFIG?configSchema.parse(JSON.parse(await readFile(env.CYCLO_PRODUCTS_CONFIG,'utf8'))):{allowPortDiscovery:false,buses:{},targets:{}};
 if(enabled&&!env.CYCLO_PRODUCTS_CONFIG)throw Error('Hardware enablement requires explicit operator configuration');
 let provider=dependencies.provider;
 const getProvider=async()=>{
  if(!enabled)throw Error('Hardware and OS serial discovery are disabled. No port or device access occurred.');
  return provider??=await (await import('./provider.mjs')).sdkProvider(env);
 };
 const session=new TargetSession(config);
 const docs=JSON.parse(await readFile(new URL('../../references/dynamixel-docs.json',import.meta.url),'utf8'));
 const server=new McpServer({name:'cyclo-products',version:'0.7.0'});
 const wrap=fn=>async(args,ctx)=>{try{const value=await fn(args,ctx);return {content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value,...((value.outcome&&value.outcome!=='verified')||value.closureConfirmed===false||value.busReservationReleased===false?{isError:true}:{})};}catch(e){return {isError:true,content:[{type:'text',text:e.message}]};}};
 const add=(name,description,inputSchema,fn,write=false)=>server.registerTool(name,{description,inputSchema,annotations:{readOnlyHint:!write,destructiveHint:write,idempotentHint:!write,openWorldHint:!['robotis_sources','dynamixel_registry','dynamixel_targets','dynamixel_models'].includes(name)}},wrap(fn));
 add('dynamixel_models','Search all indexed official current/legacy DYNAMIXEL product documents equally, including generation distinctions and mechanical DYD classification. Local metadata only; feature applicability requires exact-source evidence.',z.strictObject({query:z.string().max(100).default(''),limit:z.number().int().min(1).max(100).default(30)}),async({query,limit})=>{
  const matches=listModels(docs,query);return {revision:docs.revision,summary:docs.summary,totalMatched:matches.length,models:matches.slice(0,limit).map(({componentPaths,...m})=>m),guides:docs.guides,warning:'Document counts are not all physical variants or semantically verified feature claims. No privileged documentation model tier; execution matrix is separate.'};
 });
 add('dynamixel_manual','Read bounded, blob-verified official English MDX source for any indexed model or guide, retaining caller props and conditional component evidence. Public documentation only; does not render JSX or access hardware.',z.strictObject({model:z.string().max(160).optional(),guide:z.string().max(240).optional(),sourcePath:z.string().max(240).optional(),topic:z.string().max(100).optional(),startLine:z.number().int().min(1).optional(),lineCount:z.number().int().min(1).max(160).default(100)}),async(args,ctx)=>readManual(docs,args,{fetchSource:dependencies.docsFetch??fetch,signal:ctx.mcpReq.signal}));
 add('robotis_sources','Find curated official product/source routes. Local metadata only, not full-text retrieval or proof that every product is reviewed.',z.strictObject({query:z.string().min(1).max(150)}),async({query})=>{
  const index=JSON.parse(await readFile(new URL('../../references/robotis-sources.json',import.meta.url),'utf8'));
  const repos=JSON.parse(await readFile(new URL('../../references/robotis-repositories.json',import.meta.url),'utf8'));
  const known=new Set(index.sources.map(s=>s.url));
  const modelSources=docs.models.map(m=>({id:m.id,title:m.title,url:m.sourceUrl,family:m.family,tags:[...m.aliases,...m.sourceTopics.map(h=>h.title)],coverage:'indexed official source; exact conditional evidence required',execution:'source-bound named capabilities; unresolved conditions block only that operation'}));
  const sources=[...modelSources,...index.sources,...repos.repositories.filter(r=>!known.has(r.html_url)).map(r=>({id:`repo-${r.name}`,title:r.name,url:r.html_url,family:'software-tooling',tags:[r.name,r.description??''],coverage:'discovered-only',reviewedOn:null,discoveredOn:repos.discoveredOn,execution:'none',repositoryArchived:r.archived,lifecycle:'not inferred from repository status',defaultBranch:r.default_branch}))];
  const words=query.toLowerCase().split(/\s+/).filter(Boolean);
  const ranked=sources.map(s=>({s,score:words.reduce((n,w)=>n+(JSON.stringify([s.id,s.title,s.tags,s.family]).toLowerCase().includes(w)?1:0),0)})).filter(x=>x.score).sort((a,b)=>b.score-a.score).slice(0,12).map(x=>x.s);
  return {reviewedOn:index.reviewedOn,sources:ranked,completePortfolio:false,next:ranked.length?'Fetch the exact official page using the host web tool and check product/version before answering.':'Use official ROBOTIS navigation and ROBOTIS-GIT repositories; request exact product/package if ambiguous. No write map is generated from page text.'};
 });
 add('dynamixel_registry','Report the complete source-bound model/capability catalog and unresolved operations without I/O.',z.strictObject({catalogId:z.string().optional()}),async({catalogId})=>({models:MODELS.filter(m=>!catalogId||m.catalogId===catalogId).map(m=>({catalogId:m.catalogId,name:m.name,modelNumbers:m.modelNumbers,protocols:m.protocols,dualAxis:m.dualAxis,capabilities:catalogId?m.capabilities:Object.fromEntries(Object.entries(m.capabilities).map(([op,c])=>[op,{status:c.status,reason:c.reason}])),...(catalogId?{registers:m.registers,bauds:m.bauds,source:m.source}:{})})),catalogSummary:CATALOG.summary,hardwareEnabled:enabled,targets:session.list().map(t=>t.name),targetDetails:session.list(),buses:Object.keys(config.buses??{}),runtimeTested:'mocks only; no installed-host or physical-device verification',unsupported:['arbitrary raw writes','torque changes','motion','reset','reboot','flashing','unknown identity or unresolved capability semantics']}));
 add('dynamixel_ports','Discover OS serial ports only with operator-enabled discovery; never opens them or selects a target automatically.',z.strictObject({}),async()=>{
  if(!config.allowPortDiscovery)throw Error('Port discovery is not authorized in operator config');
  const p=await getProvider();return {ports:await p.ports(),selectionRequired:true,warning:'Adapter identity is not actuator identity. Choose a port and bounded scan explicitly.'};
 });
 async function onBus(target,permission,work) {
  if(!target||!target[permission])throw Error('Unknown target or operation not authorized in operator config');
  const p=await getProvider();
  const lease=await (dependencies.lease??acquireBusLease)({port:target.port,dynamic:true});
  let result,confirmed=false,entered=false;
  try{await lease.verify();if(target.verifyBinding)await target.verifyBinding();entered=true;result=await work(target,(baud,timeout,protocol)=>p.connect(lease.port??target.port,baud,timeout,protocol),lease.verify);confirmed=result.closureConfirmed===true;return result;}
  catch(e){if(entered){const error=Error(`${e.message}; bus reservation retained because closure could not be established`);error.requiresReidentification=true;throw error;}e.requiresReidentification=true;throw e;}
  finally{if(confirmed||!entered){const released=await lease.release();if(result)result.busReservationReleased=released;}else if(result)result.busReservationReleased=false;}
 }
 add('dynamixel_targets','Inspect session-selected targets and their confirmed/blocked state without device access.',z.strictObject({}),async()=>({targets:session.list(),persistence:'session only; explicit operator config remains unchanged'}));
 add('dynamixel_select','Select one observed device from a completed bounded scan after explicit user confirmation and physical single-device isolation. No device writes or added operator permissions.',z.strictObject({scanId:z.string(),candidateId:z.string(),name:z.string(),confirmed:z.boolean(),isolatedBus:z.boolean(),catalogId:z.string().optional(),peerIds:z.array(z.number().int().min(0).max(252)).max(1).default([])}),async args=>({target:await session.select(args)}),true);
 add('dynamixel_scan','Bounded read-only Protocol 1/2 scan on a configured port-only bus or existing target. Unknown ID/model needs no preconfigured device identity. Always choose one candidate explicitly.',z.strictObject({bus:z.string().optional(),target:z.string().optional(),ids:z.array(z.number().int()),bauds:z.array(z.number().int()),protocols:z.array(z.union([z.literal(1),z.literal(2)])).default([1,2]),timeoutMs:z.number().int().default(30),budgetMs:z.number().int().default(5000),dryRun:z.boolean().default(true)}),async(args,ctx)=>{
  const plan=scanPlan(args),bus=session.resolve(args);if(!bus.allowScan)throw Error('Scan is not authorized on this bus');
  if(args.dryRun)return {executed:false,plan};
  session.clearObservations(bus.port);
  let binding;
  const result=await onBus(bus,'allowScan',async(t,connect,verifyBinding)=>{binding=verifyBinding;return scan(connect,args,{signal:ctx.mcpReq.signal});});
  const selection=session.recordScan(bus,result,binding);
  return {...result,selectionRequired:true,...(selection??{}),next:selection?'Ask the user to choose one candidate and confirm an isolated single-device bus; then call dynamixel_select.':'No selectable observation: inspect completeness/errors and do not guess a device.'};
 });
 add('dynamixel_configure','Named model-aware ID OR baud, LED, profile configuration; requires isolated bus and torque already off. Default is planning. Never sends goal or torque commands.',z.strictObject({target:z.string(),changes:z.strictObject({id:z.number().int().optional(),baud:z.number().int().optional(),led:z.union([z.number().int(),z.strictObject({mask:z.number().int()}),z.strictObject({red:z.number().int(),green:z.number().int(),blue:z.number().int()})]).optional(),profile:profile.optional()}),dryRun:z.boolean().default(true)}),async(args,ctx)=>{
  const t=session.target(args.target);
  validateRequest({...t,changes:args.changes});
  if(args.dryRun){
   // No fabricated snapshot: mode/limit/torque checks require a real observation.
   return {executed:false,request:{model:t.model,firmware:t.firmware,id:t.id,baud:t.baud,changes:args.changes},pending:['observed identity/protocol','exclusive isolated bus','torque already off','destination ID collision check','observed mode/limits','snapshot and readback'],warning:'This is a request validation, not a device-derived execution plan or compatibility certification'};
  }
  try{
   session.clearObservations(t.port);
   const result=await onBus(t,'allowConfigure',async(t,connect)=>{session.target(args.target);return configure(connect,{...t,changes:args.changes},{signal:ctx.mcpReq.signal});});
   session.settle(args.target,result);
   return result;
  }catch(e){if(e.requiresReidentification)session.retirePort(t.port,'port binding or bus ownership changed; select again');throw e;}
 },true);
 return server;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){try{await serveStdio(()=>createProductsServer());}catch(e){console.error(e.message);process.exitCode=1;}}
