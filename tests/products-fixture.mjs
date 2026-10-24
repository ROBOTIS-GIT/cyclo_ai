// Test entrypoint only: dependency-injected in-memory provider, no SDK import.
import {serveStdio} from '@modelcontextprotocol/server/stdio';
import {createProductsServer} from '../modules/dynamixel/server.mjs';
import {fixture} from './fixtures/device.mjs';
const f=fixture();
await serveStdio(()=>createProductsServer(process.env,{provider:f.provider,lease:async()=>({port:'/MOCK-ONLY',verify:async()=>{},release:async()=>true})}));
