if(process.argv.includes('--bulk-scan')) {
  const probes=[];
  for(let i=0;i<1771;i++) {const probe={baud:1000000,id:i%253,modelNumber:1200,firmwareVersion:52};probes.push(probe);console.log(JSON.stringify({scanProgress:{completed:i+1,total:1771,probe}}));}
  console.log(JSON.stringify({probes,complete:true,completed:1771,total:1771}));await new Promise(resolve=>process.stdout.write('',resolve));process.exit(0);
}
import {mockBus} from './workflow.mjs';
if(process.argv.includes('--delay') || process.argv.includes('--print-then-wait') || process.argv.includes('--scan-delay')) process.on('SIGTERM',()=>{});
const bus=mockBus({
  badBaud:process.argv.includes('--fail'),
  model:process.argv.includes('--wrong-model')?1190:1200,
  torque:process.argv.includes('--torque')?1:0,
  delayPing:process.argv.includes('--scan-delay'),
  delayWrite:process.argv.includes('--delay'),
});
console.log(JSON.stringify(await bus.runner(process.argv.slice(2),undefined,(completed,total,probe)=>console.log(JSON.stringify({scanProgress:{completed,total,probe}})))));

if(process.argv.includes('--print-then-wait')) await new Promise(resolve=>setTimeout(resolve,30000));
