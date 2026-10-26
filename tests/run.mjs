// Mock-only materialization: never run SDK/CLI hardware discovery or transport setup.
import { cp, mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const work=await mkdtemp(join(root,'.mock-tests-'));
const output=join(root,'validation/current'); await mkdir(output,{recursive:true});
function run(name,command,args,cwd=root) {
  const result=spawnSync(command,args,{cwd,encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},timeout:90000,maxBuffer:4*1024*1024});
  const log=(result.stdout??'')+(result.stderr??'');
  return {name,status:result.error ? 1 : result.status,error:result.error?.message,log};
}
const results=[];
try {
  const tools=join(work,'tools');await cp(join(root,'modules/firmware/upstream/tools'),tools,{recursive:true});
  // Compile the already-vendored generated SDK source, without running its generators/build hooks.
  results.push(run('sdk-typescript',process.execPath,[join(root,'node_modules/typescript/bin/tsc'),'-p',join(tools,'cyclo_firmware_sdk/tsconfig.json')]));
  if(results.at(-1).status!==0)throw Error('SDK compilation failed');
  const discovery=join(tools,'cyclo_firmware_sdk/dist/serial-discovery.js');
  const source=await readFile(discovery,'utf8');
  const enumeration="const aliases = await readdir('/dev/serial/by-id').catch(() => []);";
  if(!source.includes(enumeration))throw Error('Mock isolation patch requires review after upstream changes');
  // This temporary compiled test copy never enumerates attached serial aliases.
  await writeFile(discovery,source.replace(enumeration,'const aliases = []; // TEST ONLY: no host hardware enumeration'));
  const serialTransport=join(tools,'cyclo_firmware_sdk/dist/node-serial-transport.js');
  // Fail if any test accidentally reaches the real transport or catalog implementation.
  await writeFile(serialTransport,(await readFile(serialTransport,'utf8'))+'\nNodeSerialTransport.prototype.open = async function(){throw new Error("TEST GUARD: real serial open prohibited");};\nNodeSerialTransport.listPorts = async function(){throw new Error("TEST GUARD: OS port discovery prohibited");};\n');
  const tests=['adapter','bus-lease','local-wire','local','process','recovery','stdio','workflow'].map(name=>join(tools,`cyclo_firmware_mcp/test/${name}.test.mjs`));
  results.push(run('upstream-mcp-mocks',process.execPath,['--test',...tests]));
  results.push(run('dynamixel-products',process.execPath,['--test','tests/dynamixel.test.mjs','tests/selection.test.mjs','tests/products-integration.test.mjs','tests/hardware-defaults.test.mjs','tests/table-items.test.mjs']));
  results.push(run('complete-control-table',process.execPath,['--test','tests/conditions.test.mjs','tests/full-table-execution.test.mjs','tests/table-transitions.test.mjs']));
  results.push(run('generic-catalog-execution',process.execPath,['--test','tests/catalog-execution.test.mjs']));
  results.push(run('official-sdk-provider-stdio',process.execPath,['--test','tests/sdk-provider.test.mjs']));
  results.push(run('official-manual-reader',process.execPath,['--test','tests/manual.test.mjs']));
  results.push(run('dual-host-stdio',process.execPath,['--test','tests/dual-host.test.mjs']));
  results.push(run('plugin-stdio',process.execPath,['--test','tests/integration.test.mjs']));
  results.push(run('python-regressions','python3',['-m','unittest','discover','-s','validation','-p','test_*.py','-v']));
  results.push(run('package-validation','python3',['validation/validate_package.py']));
} catch(error) { results.push({name:'runner',status:1,log:error.stack}); }
finally { await rm(work,{recursive:true,force:true}); }
for(const r of results) { await writeFile(join(output,r.name+'.txt'),r.log);console.log(`${r.name}: ${r.status===0?'PASS':'FAIL'}`); }
await writeFile(join(output,'test-results.json'),JSON.stringify(results.map(({log,...r})=>r),null,2)+'\n');
if(results.some(r=>r.status!==0))process.exitCode=1;
