import { pythonExecutable, pythonEnvironment } from '../modules/dynamixel/python-runtime.mjs';
// All device tests use injected providers, fake packet ports or loopback fixtures.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
import { mkdir, writeFile, readdir } from 'node:fs/promises';
const output = new URL('../validation/current/', import.meta.url);
await mkdir(output, { recursive: true });
const results = [];
const python = pythonExecutable();
const testEnv = pythonEnvironment(python, { ...process.env, PYTHONDONTWRITEBYTECODE: '1' });
for (const [name, command, args] of [
  [
    'node-regressions',
    process.execPath,
    [
      '--test',
      ...(await readdir(new URL('.', import.meta.url)))
        .filter((n) => n.endsWith('.test.mjs'))
        .map((n) => 'tests/' + n),
    ],
  ],
  [
    'python-regressions',
    pythonExecutable(),
    ['-m', 'unittest', 'discover', '-s', 'validation', '-p', 'test_*.py', '-v'],
  ],
  ['package-validation', pythonExecutable(), ['validation/validate_package.py']],
]) {
  const r = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 16 * 1024 * 1024,
    env: testEnv,
  });
  await writeFile(new URL(name + '.txt', output), (r.stdout ?? '') + (r.stderr ?? ''));
  results.push({ name, status: r.error ? 1 : r.status, error: r.error?.message });
  console.log(name + ': ' + (results.at(-1).status === 0 ? 'PASS' : 'FAIL'));
}
await writeFile(new URL('test-results.json', output), JSON.stringify(results, null, 2) + '\n');
if (results.some((r) => r.status !== 0)) process.exitCode = 1;
