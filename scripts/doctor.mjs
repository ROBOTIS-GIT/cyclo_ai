// Dependency diagnostics only: never enumerate/open ports or contact a robot.
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { pythonExecutable } from '../modules/dynamixel/python-runtime.mjs';

export async function diagnose({ env = process.env, hardwareDeps = false } = {}) {
  const checks = [
    {
      name: 'Node.js >=22',
      ok: Number(process.versions.node.split('.')[0]) >= 22,
      detail: process.version,
    },
  ];
  try {
    await import('../modules/dynamixel/runtime-deps.mjs');
    checks.push({ name: 'MCP runtime libraries', ok: true });
  } catch {
    checks.push({
      name: 'MCP runtime libraries',
      ok: false,
      remedy: 'Use the install ZIP, or run npm ci --ignore-scripts in a source checkout.',
    });
  }
  const python = pythonExecutable(env);
  const code = `import sys,json,importlib.util; sys.path.insert(0, ${JSON.stringify(fileURLToPath(new URL('../modules/dynamixel/python-vendor', import.meta.url)))}); print(json.dumps({"version":list(sys.version_info[:3]),"serial":importlib.util.find_spec("serial") is not None,"yaml":importlib.util.find_spec("yaml") is not None}))`;
  const result = spawnSync(python, ['-c', code], { encoding: 'utf8', timeout: 10000 });
  let details;
  try {
    if (result.status === 0) details = JSON.parse(result.stdout);
  } catch {}
  checks.push({
    name: 'Python >=3.9',
    ok:
      !!details &&
      (details.version[0] > 3 || (details.version[0] === 3 && details.version[1] >= 9)),
    detail: details?.version.join('.'),
    remedy: 'Install Python >=3.9 and run npm run setup, or set CYCLO_PRODUCTS_PYTHON.',
  });
  if (hardwareDeps)
    checks.push({
      name: 'pyserial',
      ok: details?.serial === true,
      remedy: 'Use the install ZIP, or run npm run setup in a source checkout.',
    });
  if (hardwareDeps)
    checks.push({
      name: 'PyYAML',
      ok: details?.yaml === true,
      remedy: 'Use the install ZIP, or run npm run setup in a source checkout.',
    });
  return {
    ok: checks.every((c) => c.ok),
    checks,
    python,
    platform: process.platform,
    deviceAccess: false,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const result = await diagnose({ hardwareDeps: process.argv.includes('--hardware-deps') });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
