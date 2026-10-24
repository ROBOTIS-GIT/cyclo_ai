import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fileURLToPath } from 'node:url';
const server = fileURLToPath(new URL('../src/server.mjs', import.meta.url));
for (const mode of ['legacy','auto']) test(`official SDK stdio ${mode}: discovery, schemas, harmless call and errors`, async () => {
  const client = new Client({name:'cyclo-contract-test',version:'1.0.0'},{versionNegotiation:{mode}});
  const transport = new StdioClientTransport({command:process.execPath,args:[server],stderr:'pipe',env:{}});
  let stderr=''; transport.stderr.on('data',chunk=>stderr+=chunk);
  try {
    await client.connect(transport);
    assert.equal(client.getProtocolEra(), mode === 'auto' ? 'modern' : 'legacy');
    if (mode === 'auto') assert.equal(client.getNegotiatedProtocolVersion(), '2026-07-28');
    const {tools} = await client.listTools();
    assert.equal(tools.length,10);
    for(const tool of tools) { assert.equal(tool.inputSchema.type,'object'); assert.equal(tool.annotations.readOnlyHint,tool.name !== 'cyclo_configure'); assert.equal(tool.outputSchema.type,'object'); }
    const result = await client.callTool({name:'cyclo_capabilities',arguments:{}});
    assert.equal(result.isError,undefined);
    assert.equal(result.structuredContent.mode,'read-enabled');
    assert.deepEqual(result.structuredContent.targets,[]);
    assert.deepEqual(JSON.parse(result.content[0].text),result.structuredContent);
    const unavailable = await client.callTool({name:'cyclo_ping',arguments:{target:'absent',id:1}});
    assert.equal(unavailable.isError,true);
    const invalid = await client.callTool({name:'cyclo_read',arguments:{target:'absent',id:1,address:0,length:-1}});
    assert.equal(invalid.isError,true);
    await assert.rejects(client.callTool({name:'execute_shell',arguments:{command:'echo unsafe'}}), error => error.code === -32602);
    assert.equal(stderr,'');
  } finally {await client.close();}
});
for (const mode of ['legacy','auto']) test(`stdio ${mode} cancellation reaches tool and releases read lock`,async()=>{
  const client=new Client({name:'cancel-test',version:'1.0.0'},{versionNegotiation:{mode}});
  const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./fixtures/server.mjs',import.meta.url))],stderr:'pipe',env:{}});
  try{
    await client.connect(transport);
    await client.listTools();
    const controller=new AbortController();
    const pending=client.callTool({name:'cyclo_ping',arguments:{target:'mock',id:1,dryRun:false}},{signal:controller.signal});
    setTimeout(()=>controller.abort(),100);
    await assert.rejects(pending);
    // Cancellation notification and following request travel in order on the same pipe.
    let next=await client.callTool({name:'cyclo_ping',arguments:{target:'mock',id:2,dryRun:false}});
    const deadline=performance.now()+1000;
    while(next.isError && performance.now()<deadline){
      assert.match(next.content[0].text,/already in progress/);
      await new Promise(resolve=>setTimeout(resolve,20));
      next=await client.callTool({name:'cyclo_ping',arguments:{target:'mock',id:2,dryRun:false}});
    }
    assert.equal(next.isError,undefined);
    assert.equal(next.structuredContent.data.previousRequestAborted,true);
  }finally{await client.close();}
});

for(const mode of ['legacy','auto']) for(const failure of [false,true]) test(`stdio ${mode} one-call write workflow ${failure?'partial failure':'success'}`,async()=>{
  const client=new Client({name:'write-test',version:'1.0.0'},{versionNegotiation:{mode}});
  const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./fixtures/workflow-server.mjs',import.meta.url)),...(failure?['--fail']:[])],stderr:'pipe',env:{}});
  try {
    await client.connect(transport);await client.listTools();
    const result=await client.callTool({name:'cyclo_configure',arguments:{target:'bench',id:1,changes:{returnDelayTime:0,baudRate:2000000}}});
    assert.equal(result.structuredContent.data.outcome,failure?'partial':'verified');
    assert.equal(result.isError,failure?true:undefined);
    assert.equal(result.structuredContent.data.changes.length,2);
    assert.deepEqual(JSON.parse(result.content[0].text),result.structuredContent);
  }finally{await client.close();}
});
for(const mode of ['legacy','auto']) for(const kind of ['--wrong-model','--torque']) test(`stdio ${mode} ${kind} blocks configuration`,async()=>{
  const client=new Client({name:'refusal-test',version:'1.0.0'},{versionNegotiation:{mode}});
  const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./fixtures/workflow-server.mjs',import.meta.url)),kind],stderr:'pipe',env:{}});
  try {
    await client.connect(transport);await client.listTools();
    const result=await client.callTool({name:'cyclo_configure',arguments:{target:'bench',id:1,changes:{returnDelayTime:0}}});
    assert.equal(result.isError,true);assert.equal(result.structuredContent.data.outcome,'not_written');assert.deepEqual(result.structuredContent.data.changes,[]);
    const plan=await client.callTool({name:'cyclo_configure',arguments:{target:'bench',id:1,changes:{returnDelayTime:0},dryRun:true}});
    assert.equal(plan.structuredContent.executed,false);
  }finally{await client.close();}
});
for(const mode of ['legacy','auto']) test(`stdio ${mode} write cancellation keeps bus owned until child closes`,async()=>{
  const client=new Client({name:'write-cancel',version:'1.0.0'},{versionNegotiation:{mode}});
  const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./fixtures/workflow-server.mjs',import.meta.url)),'--delay'],stderr:'pipe',env:{}});
  try {
    await client.connect(transport);await client.listTools();
    const controller=new AbortController();
    const pending=client.callTool({name:'cyclo_configure',arguments:{target:'bench',id:1,changes:{led:1}}},{signal:controller.signal});
    setTimeout(()=>controller.abort(),200);await assert.rejects(pending);
    const busy=await client.callTool({name:'cyclo_device_state',arguments:{target:'bench',id:1}});
    assert.equal(busy.isError,true);assert.match(busy.content[0].text,/already in progress/);
    await new Promise(r=>setTimeout(r,350));
    const state=await client.callTool({name:'cyclo_device_state',arguments:{target:'bench',id:1}});
    assert.equal(state.isError,undefined);assert.equal(state.structuredContent.data.outcome,'read');
  }finally{await client.close();}
});
