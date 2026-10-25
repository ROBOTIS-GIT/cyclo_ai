import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,cp,rm,mkdir,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
const root=fileURLToPath(new URL('..',import.meta.url));
const portable=JSON.parse(await readFile(new URL('../mcp.json',import.meta.url),'utf8')).mcpServers;
const claude=JSON.parse(await readFile(new URL('../.claude-plugin/plugin.json',import.meta.url),'utf8'));
let fixture,pluginRoot,cwd;
before(async()=>{
 fixture=await mkdtemp(join(tmpdir(),'cyclo host path with spaces '));pluginRoot=join(fixture,'plugin');cwd=join(fixture,'unrelated cwd');
 await mkdir(cwd);await mkdir(pluginRoot);
 await cp(join(root,'modules'),join(pluginRoot,'modules'),{recursive:true});
 await cp(join(root,'references'),join(pluginRoot,'references'),{recursive:true});
 await symlink(join(root,'node_modules'),join(pluginRoot,'node_modules'),'dir');
});
after(async()=>{if(fixture)await rm(fixture,{recursive:true,force:true});});

test('host manifests share identity, version, author and one registration per server',async()=>{
 const p=JSON.parse(await readFile(new URL('../plugin.json',import.meta.url),'utf8'));
 assert.equal(claude.name,p.name);assert.equal(claude.version,p.version);assert.deepEqual(claude.author,p.author);
 assert.deepEqual(Object.keys(claude.mcpServers).sort(),Object.keys(portable).sort());
 assert.equal(claude.skills,undefined,'default actual skills directory is shared, never scanned twice');
 for(const name of Object.keys(portable)){
  const a=portable[name],b=claude.mcpServers[name];
  assert.equal(a.command,b.command);assert.deepEqual(a.env,b.env);
  assert.deepEqual(a.args.map(x=>x.replaceAll('${PLUGIN_ROOT}','ROOT')),b.args.map(x=>x.replaceAll('${CLAUDE_PLUGIN_ROOT}','ROOT')));
 }
});
for(const host of ['codex','claude'])for(const name of Object.keys(portable))test(`${host} declaration: ${name} initializes safely from an unrelated cwd`,async t=>{
 // Both the plugin root and unrelated cwd contain spaces. No shell is involved.
 const config=host==='codex'?portable[name]:claude.mcpServers[name];
 const args=config.args.map(a=>a.replaceAll(host==='codex'?'${PLUGIN_ROOT}':'${CLAUDE_PLUGIN_ROOT}',pluginRoot));
 const c=new Client({name:'dual-host-offline-check',version:'0.7.0'});
 const transport=new StdioClientTransport({command:process.execPath,args,cwd,env:config.env,stderr:'pipe'});
 let stderr='';transport.stderr.on('data',b=>stderr+=b);
 try{
  await c.connect(transport);const tools=(await c.listTools()).tools;
  assert.equal(new Set(tools.map(t=>t.name)).size,tools.length);
  if(name==='cyclo-products'){
   assert.equal(tools.length,9);const registry=await c.callTool({name:'dynamixel_registry',arguments:{}});assert.equal(registry.structuredContent.hardwareEnabled,false);
   const source=await c.callTool({name:'robotis_sources',arguments:{query:'XM430'}});assert.ok(source.structuredContent.sources.length);
  }else{
   assert.equal(tools.length,10);const caps=await c.callTool({name:'cyclo_capabilities',arguments:{}});assert.equal(caps.structuredContent.mode,'planning-only');
   assert.equal((await c.callTool({name:'cyclo_serial_ports',arguments:{}})).isError,true);
  }
  assert.equal(stderr,'');
 }finally{await c.close();}
});
