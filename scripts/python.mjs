import { spawnSync } from 'node:child_process';
import { delimiter, dirname, isAbsolute } from 'node:path';
import { pythonExecutable } from '../modules/dynamixel/python-runtime.mjs';
const python = pythonExecutable();
const env = { ...process.env };
if (isAbsolute(python)) env.PATH = dirname(python) + delimiter + (env.PATH ?? '');
const result = spawnSync(python, process.argv.slice(2), { stdio: 'inherit', env });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
