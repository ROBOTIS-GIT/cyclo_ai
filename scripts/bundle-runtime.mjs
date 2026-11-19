// Build-time only: runtime packages contain no bundler or native build binary.
import { build } from 'esbuild';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const output = process.argv[2];
if (!output) throw Error('Pass the staging plugin directory');
const result = await build({
  absWorkingDir: root,
  entryPoints: ['modules/dynamixel/runtime-deps.mjs'],
  outfile: join(output, 'modules/dynamixel/runtime-deps.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  legalComments: 'inline',
  metafile: true,
});
if (
  Object.values(result.metafile.outputs).some((o) =>
    o.imports.some((i) => !i.path.startsWith('node:')),
  )
)
  throw Error('Bundle contains an unresolved runtime import');
const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
const packages = [
  ...new Set(
    Object.keys(result.metafile.inputs)
      .map((p) => {
        const match = p.match(/^node_modules\/((?:@[^/]+\/)?[^/]+)\//);
        if (!match && p !== 'modules/dynamixel/runtime-deps.mjs')
          throw Error(`Unexpected runtime dependency input: ${p}`);
        return match?.[1];
      })
      .filter(Boolean),
  ),
];

const directory = join(output, 'licenses');
await mkdir(directory, { recursive: true });
const dependencies = [];
for (const name of packages.sort()) {
  const metadata = lock.packages['node_modules/' + name];
  const licenseName = name.replaceAll('/', '-') + '-LICENSE.txt';
  await writeFile(
    join(directory, licenseName),
    await readFile(join(root, 'node_modules', name, 'LICENSE')),
  );
  dependencies.push({
    name,
    version: metadata.version,
    license: metadata.license,
    integrity: metadata.integrity,
    licenseFile: 'licenses/' + licenseName,
  });
}
await writeFile(
  join(output, 'runtime-dependencies.json'),
  JSON.stringify(
    {
      node: dependencies,
      bundler: { name: 'esbuild', version: lock.packages['node_modules/esbuild'].version },
    },
    null,
    2,
  ) + '\n',
);
