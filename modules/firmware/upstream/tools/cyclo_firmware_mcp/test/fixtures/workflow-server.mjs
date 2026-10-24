import {serveStdio} from '@modelcontextprotocol/server/stdio';
import {createServer} from '../../src/server.mjs';
import {workflowConfig} from './workflow.mjs';
import {captureJson} from '../../src/process.mjs';
import {fileURLToPath} from 'node:url';
const command=fileURLToPath(new URL('./workflow-command.mjs',import.meta.url));
await serveStdio(()=>createServer(workflowConfig,(args,signal)=>captureJson(command,[...args,...process.argv.slice(2)],signal)));
