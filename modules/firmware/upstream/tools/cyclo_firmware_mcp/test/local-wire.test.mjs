import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {fileURLToPath} from 'node:url';
const server=fileURLToPath(new URL('./fixtures/local-server.mjs',import.meta.url));
for(const mode of ['legacy','auto']) test(`local stdio ${mode}: ports, unconfigured ID state/write and scan progress`,async()=>{
  const client=new Client({name:'local-test',version:'1.0.0'},{versionNegotiation:{mode}});
  const transport=new StdioClientTransport({command:process.execPath,args:[server],env:{},stderr:'pipe'});
  try{
    await client.connect(transport);await client.listTools();
    const ports=await client.callTool({name:'cyclo_serial_ports',arguments:{}});
    assert.equal(ports.structuredContent.data.ports[0].serialNumber,'wire-mock');
    const state=await client.callTool({name:'cyclo_device_state',arguments:{port:'/dev/null',id:7}});
    assert.equal(state.structuredContent.data.identity.id,7);
    const write=await client.callTool({name:'cyclo_configure',arguments:{port:'/dev/null',id:7,changes:{returnDelayTime:0,baudRate:2000000}}});
    assert.equal(write.structuredContent.data.outcome,'verified');
    const errors=[];client.onerror=error=>errors.push(error);
    await client.callTool({name:'cyclo_serial_scan',arguments:{port:'/dev/null',ids:[7],bauds:[1000000]}});
    assert.deepEqual(errors,[]);
    const progress=[];
    const scan=await client.callTool({name:'cyclo_serial_scan',arguments:{port:'/dev/null',minId:7,maxId:9,bauds:[1000000]}},{onprogress:p=>progress.push(p)});
    assert.equal(scan.structuredContent.data.completed,3);assert.ok(progress.length>0);assert.equal(progress.at(-1).progress,3);
  }finally{await client.close();}
});
for(const mode of ['legacy','auto']) test(`local stdio ${mode}: long ping cancellation retains checkpoints after true close`,async()=>{
  const client=new Client({name:'scan-cancel',version:'1.0.0'},{versionNegotiation:{mode}});
  const transport=new StdioClientTransport({command:process.execPath,args:[server,'--scan-delay'],env:{},stderr:'pipe'});
  try{
    await client.connect(transport);await client.listTools();
    const controller=new AbortController();let first;const seen=new Promise(r=>first=r);
    const pending=client.callTool({name:'cyclo_serial_scan',arguments:{port:'/dev/null',minId:7,maxId:9,timeoutMs:900}},{signal:controller.signal,onprogress:()=>first()});
    await Promise.race([seen,new Promise((_,reject)=>setTimeout(()=>reject(Error('No requested scan progress')),2500))]);controller.abort();await assert.rejects(pending);
    const busy=await client.callTool({name:'cyclo_device_state',arguments:{port:'/dev/null',id:7}});assert.equal(busy.isError,true);assert.match(busy.content[0].text,/already in progress/);
    await new Promise(r=>setTimeout(r,350));
    const next=await client.callTool({name:'cyclo_device_state',arguments:{port:'/dev/null',id:7}});assert.equal(next.structuredContent.data.outcome,'read');
  }finally{await client.close();}
});
