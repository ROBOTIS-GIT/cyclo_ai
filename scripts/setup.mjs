// Explicit local setup. No global installs, host registration or device access.
import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { pluginRoot } from '../modules/dynamixel/python-runtime.mjs';

function run(command, args) {
  const result = spawnSync(command, args, { cwd: pluginRoot, stdio: 'inherit' });
  if (result.error || result.status !== 0)
    throw Error(result.error?.message ?? `${command} failed (${result.status})`);
}
try {
  const base =
    process.env.CYCLO_PRODUCTS_PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');
  const directory = join(pluginRoot, '.venv');
  const python = join(
    directory,
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
  );
  if (!existsSync(directory)) run(base, ['-m', 'venv', directory]);
  if (!existsSync(join(directory, 'pyvenv.cfg')) || !existsSync(python))
    throw Error(
      '.venv exists but is not a complete Python virtual environment. Rename it or repair it before setup.',
    );
  const probe = spawnSync(python, ['-c', 'import sys; print(sys.prefix)'], { encoding: 'utf8' });
  if (probe.status !== 0 || realpathSync(probe.stdout.trim()) !== realpathSync(directory))
    throw Error('Refusing to install outside the plugin virtual environment.');
  run(python, ['-m', 'pip', 'install', '-r', 'modules/dynamixel/requirements.txt']);
  if (process.argv.includes('--dev'))
    run(python, ['-m', 'pip', 'install', '-r', 'validation/requirements.txt']);
  console.log(`Setup complete. Local runtime automatically uses ${python}`);
  console.log(
    `If your host copies the plugin, set CYCLO_PRODUCTS_PYTHON to ${python} in that host's environment.`,
  );
  console.log(
    'Run npm run doctor -- --hardware-deps to check dependencies. No device has been accessed.',
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
