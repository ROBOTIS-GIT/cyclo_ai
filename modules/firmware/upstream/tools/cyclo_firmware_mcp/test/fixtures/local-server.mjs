import {serveStdio} from '@modelcontextprotocol/server/stdio';
import {createServer} from '../../src/server.mjs';
import {captureJson} from '../../src/process.mjs';
import {resolveSerialPort,listSerialPorts} from '../../../cyclo_firmware_sdk/dist/serial-discovery.js';
import {fileURLToPath} from 'node:url';
const command=fileURLToPath(new URL('./workflow-command.mjs',import.meta.url));
const catalog=async()=>[{path:'/dev/null',serialNumber:'wire-mock',vendorId:'1234'}];
const serial={list:async()=>({ports:await listSerialPorts(catalog)}),resolve:port=>resolveSerialPort(port,catalog)};
await serveStdio(()=>createServer({},(args,signal,onProgress)=>captureJson(command,[...args,...process.argv.slice(2)],signal,15000,512*1024,{streamScan:args[0]==='serial-scan',onProgress}),serial));
