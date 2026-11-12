import { spawnSync } from 'node:child_process';
import { pythonExecutable, pythonEnvironment } from '../modules/dynamixel/python-runtime.mjs';
const python = pythonExecutable();
const env = pythonEnvironment(python);
const result = spawnSync(python, process.argv.slice(2), { stdio: 'inherit', env });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
