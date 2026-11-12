import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pythonEnvironment, pythonExecutable } from '../modules/dynamixel/python-runtime.mjs';

test('Windows Python environment preserves Path and emits one PATH key', () => {
  const original = { Path: 'C:\\node;C:\\Windows', KEEP: 'value' };
  const env = pythonEnvironment('C:\\plugin\\.venv\\Scripts\\python.exe', original, 'win32');
  assert.equal(env.PATH, 'C:\\plugin\\.venv\\Scripts;C:\\node;C:\\Windows');
  assert.equal(env.Path, undefined);
  assert.equal(env.KEEP, 'value');
  assert.equal(original.Path, 'C:\\node;C:\\Windows');
  const duplicate = pythonEnvironment(
    'C:\\venv\\python.exe',
    { Path: 'ignored', PATH: 'chosen' },
    'win32',
  );
  assert.equal(duplicate.PATH, 'C:\\venv;chosen');
  assert.deepEqual(Object.keys(duplicate), ['PATH']);
});

test('POSIX Python environment preserves PATH and unrelated case-sensitive variables', () => {
  assert.deepEqual(
    pythonEnvironment('/plugin/.venv/bin/python', { PATH: '/usr/bin', Path: 'keep' }, 'linux'),
    {
      PATH: '/plugin/.venv/bin:/usr/bin',
      Path: 'keep',
    },
  );
  assert.deepEqual(pythonEnvironment('python3', { PATH: '/usr/bin' }, 'linux'), {
    PATH: '/usr/bin',
  });
});

test('Python wrapper keeps Node reachable from a child process', () => {
  const env = { ...process.env, CYCLO_PRODUCTS_PYTHON: pythonExecutable() };
  if (process.platform === 'win32') {
    const key = Object.keys(env).find((k) => k.toLowerCase() === 'path');
    const value = env[key];
    for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') delete env[key];
    env.Path = value;
  }
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL('../scripts/python.mjs', import.meta.url)),
      '-c',
      'import subprocess; subprocess.run(["node", "--version"], check=True)',
    ],
    { env, encoding: 'utf8', timeout: 10000 },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), process.version);
});
