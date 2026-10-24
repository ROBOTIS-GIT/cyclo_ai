// Test-only server: injected mock runner never opens hardware or executes the CLI.
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from '../../src/server.mjs';
let aborted=false;
serveStdio(()=>createServer({allowHardwareReads:true,targets:{mock:{transport:'udp',host:'mock-' + process.pid + '.invalid'}}},async(args,signal)=>{
  if(args.at(-1)==='2')return {previousRequestAborted:aborted};
  return await new Promise((resolve,reject)=>{
    const abort=()=>{aborted=true;reject(Error('mock aborted'));};
    if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
  });
}));
