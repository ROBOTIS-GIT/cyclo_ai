import {acquireBusLease} from '../../src/bus-lease.mjs';
const reservation=await acquireBusLease({port:process.argv[2]});
await reservation.verify();
console.log(JSON.stringify({held:true,port:reservation.port}));
await new Promise(resolve=>process.stdin.once('data',resolve));
await reservation.release();
