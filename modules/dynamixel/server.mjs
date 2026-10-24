import {McpServer} from '@modelcontextprotocol/server';
import {serveStdio} from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {MODELS} from './registry.mjs';
import {configure,scan,scanPlan,validateRequest} from './workflow.mjs';
import {acquireBusLease} from '../firmware/upstream/tools/cyclo_firmware_mcp/src/bus-lease.mjs';
const targetSchema=z.strictObject({port:z.string().min(1),model:z.number().int(),firmware:z.number().int(),id:z.number().int().min(0).max(252),baud:z.number().int(),isolatedBus:z.boolean(),allowScan:z.boolean().default(false),allowConfigure:z.boolean().default(false)});
const configSchema=z.strictObject({allowPortDiscovery:z.boolean().default(false),targets:z.record(z.string(),targetSchema)});
const profile=z.discriminatedUnion('mode',[
 z.strictObject({mode:z.literal('time'),totalMs:z.number().int(),accelerationMs:z.number().int()}),
 z.strictObject({mode:z.literal('velocity'),rpm:z.number(),accelerationRpm2:z.number(),maxRpm:z.number(),maxAccelerationRpm2:z.number()})
]);
export async function createProductsServer(env=process.env,dependencies={}) {
 const enabled=env.CYCLO_PRODUCTS_ENABLE_HARDWARE==='1';
 const config=env.CYCLO_PRODUCTS_CONFIG?configSchema.parse(JSON.parse(await readFile(env.CYCLO_PRODUCTS_CONFIG,'utf8'))):{allowPortDiscovery:false,targets:{}};
 if(enabled&&!env.CYCLO_PRODUCTS_CONFIG)throw Error('Hardware enablement requires explicit operator configuration');
 let provider=dependencies.provider;
 const getProvider=async()=>{
  if(!enabled)throw Error('Hardware and OS serial discovery are disabled. No port or device access occurred.');
  return provider??=await (await import('./provider.mjs')).sdkProvider();
 };
 const server=new McpServer({name:'cyclo-products',version:'0.4.0'});
 const wrap=fn=>async(args,ctx)=>{try{const value=await fn(args,ctx);return {content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value,...((value.outcome&&value.outcome!=='verified')||value.closureConfirmed===false||value.busReservationReleased===false?{isError:true}:{})};}catch(e){return {isError:true,content:[{type:'text',text:e.message}]};}};
 const add=(name,description,inputSchema,fn,write=false)=>server.registerTool(name,{description,inputSchema,annotations:{readOnlyHint:!write,destructiveHint:write,idempotentHint:!write,openWorldHint:!['robotis_sources','dynamixel_registry'].includes(name)}},wrap(fn));
 add('robotis_sources','Find curated official product/source routes. Local metadata only, not full-text retrieval or proof that every product is reviewed.',z.strictObject({query:z.string().min(1).max(150)}),async({query})=>{
  const index=JSON.parse(await readFile(new URL('../../references/robotis-sources.json',import.meta.url),'utf8'));
  const repos=JSON.parse(await readFile(new URL('../../references/robotis-repositories.json',import.meta.url),'utf8'));
  const known=new Set(index.sources.map(s=>s.url));
  const sources=[...index.sources,...repos.repositories.filter(r=>!known.has(r.html_url)).map(r=>({id:`repo-${r.name}`,title:r.name,url:r.html_url,family:'software-tooling',tags:[r.name,r.description??''],coverage:'discovered-only',reviewedOn:null,discoveredOn:repos.discoveredOn,execution:'none',repositoryArchived:r.archived,lifecycle:'not inferred from repository status',defaultBranch:r.default_branch}))];
  const words=query.toLowerCase().split(/\s+/).filter(Boolean);
  const ranked=sources.map(s=>({s,score:words.reduce((n,w)=>n+(JSON.stringify([s.id,s.title,s.tags,s.family]).toLowerCase().includes(w)?1:0),0)})).filter(x=>x.score).sort((a,b)=>b.score-a.score).slice(0,12).map(x=>x.s);
  return {reviewedOn:index.reviewedOn,sources:ranked,completePortfolio:false,next:ranked.length?'Fetch the exact official page using the host web tool and check product/version before answering.':'Use official ROBOTIS navigation and ROBOTIS-GIT repositories; request exact product/package if ambiguous. No write map is generated from page text.'};
 });
 add('dynamixel_registry','Report exact curated configuration matrix and unsupported actions without I/O.',z.strictObject({}),async()=>({models:MODELS,hardwareEnabled:enabled,targets:Object.keys(config.targets),runtimeTested:'mocks only; no installed-host or physical-device verification',unsupported:['arbitrary raw writes','torque changes','motion','reset','reboot','flashing','unlisted model/firmware configuration']}));
 add('dynamixel_ports','Discover OS serial ports only with operator-enabled discovery; never opens them or selects a target automatically.',z.strictObject({}),async()=>{
  if(!config.allowPortDiscovery)throw Error('Port discovery is not authorized in operator config');
  const p=await getProvider();return {ports:await p.ports(),selectionRequired:true,warning:'Adapter identity is not actuator identity. Choose a port and bounded scan explicitly.'};
 });
 async function onTarget(name,permission,work) {
  const target=config.targets[name];if(!target||!target[permission])throw Error('Unknown target or operation not authorized in operator config');
  const p=await getProvider();
  const lease=await (dependencies.lease??acquireBusLease)({port:target.port,dynamic:true});
  let result,confirmed=false,entered=false;
  try{await lease.verify();entered=true;result=await work(target,(baud,timeout)=>p.connect(lease.port??target.port,baud,timeout));confirmed=result.closureConfirmed===true;return result;}
  catch(e){if(entered)throw Error(`${e.message}; bus reservation retained because closure could not be established`);throw e;}
  finally{if(confirmed||!entered){const released=await lease.release();if(result)result.busReservationReleased=released;}else if(result)result.busReservationReleased=false;}
 }
 add('dynamixel_scan','Bounded Protocol 2 unicast scan on one configured port. No auto selection; mixed baud results remain explicit.',z.strictObject({target:z.string(),ids:z.array(z.number().int()),bauds:z.array(z.number().int()),timeoutMs:z.number().int().default(30),budgetMs:z.number().int().default(5000),dryRun:z.boolean().default(true)}),async(args,ctx)=>{
  const plan=scanPlan(args);if(args.dryRun)return {executed:false,plan};
  return onTarget(args.target,'allowScan',async(t,connect)=>scan(connect,args,{signal:ctx.mcpReq.signal}));
 });
 add('dynamixel_configure','Named model-aware ID OR baud, LED, profile configuration; requires isolated bus and torque already off. Default is planning. Never sends goal or torque commands.',z.strictObject({target:z.string(),changes:z.strictObject({id:z.number().int().optional(),baud:z.number().int().optional(),led:z.number().int().optional(),profile:profile.optional()}),dryRun:z.boolean().default(true)}),async(args,ctx)=>{
  const t=config.targets[args.target];if(!t)throw Error('Select one configured target with verified model/firmware; do not infer device from port name');
  validateRequest({...t,changes:args.changes});
  if(args.dryRun){
   // No fabricated snapshot: mode/limit/torque checks require a real observation.
   return {executed:false,request:{model:t.model,firmware:t.firmware,id:t.id,baud:t.baud,changes:args.changes},pending:['observed identity/protocol','exclusive isolated bus','torque already off','destination ID collision check','observed mode/limits','snapshot and readback'],warning:'This is a request validation, not a device-derived execution plan or compatibility certification'};
  }
  return onTarget(args.target,'allowConfigure',async(t,connect)=>configure(connect,{...t,changes:args.changes},{signal:ctx.mcpReq.signal}));
 },true);
 return server;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){try{await serveStdio(()=>createProductsServer());}catch(e){console.error(e.message);process.exitCode=1;}}
