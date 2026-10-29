import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('external custom contract through MCP, shared JS rules and independent official-SDK bridge', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cyclo custom contract '));
  try {
    const setup = spawnSync(
      'python3',
      [
        '-c',
        "import sys,json,copy;sys.path.insert(0,'validation');from custom_fixture import profile;p,e=profile(sys.argv[1]);other=copy.deepcopy(e);controller=copy.deepcopy(e);controller['catalogId']='custom/controller';controller['kind']='controller';controller['modelNumber']=65001;controller['bauds']={'6000000':None};controller['items']=[i for i in controller['items']if i['name']not in ['Torque Enable','Baud Rate']];[i['write'].update(requiresTorqueOff=False)for i in controller['items']if i.get('write',{}).get('status')=='resolved'];other['catalogId']='custom/alternate';next(i for i in other['items']if i['name']=='Firmware Version')['address']=70;p.write_text(json.dumps({'schemaVersion':1,'models':[e,other,controller]}));print(p)",
        dir,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(setup.status, 0, setup.stderr);
    const env = { ...process.env, CYCLO_PRODUCTS_CUSTOM_TABLES: setup.stdout.trim() };
    delete env.NODE_TEST_CONTEXT;
    const run = spawnSync(process.execPath, ['--test', 'tests/custom-runtime-worker.mjs'], {
      encoding: 'utf8',
      timeout: 30000,
      env,
      maxBuffer: 2 * 1024 * 1024,
    });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /tests 11|1\.\.11/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
