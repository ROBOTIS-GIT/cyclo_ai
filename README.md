# Cyclo Plugin 0.3.0

A unified local development plugin: AI Sapiens manual/learning/deployment Skills plus a separate Cyclo firmware MCP module. The portable identity remains **ai-sapiens-dev** for compatibility. Repository/product name: Cyclo Plugin. See [migration](MIGRATION.md).

## What actually executes

| Module | Implemented scope | Execution evidence |
|---|---|---|
| Retained AI Sapiens Skills | Official manual retrieval, preparation, backend choice, documented commands and checks | Prior independent response evaluations; 25 offline asset-helper tests retained; no training/robot runtime |
| Offline asset audit | Layout/hash inventory and optional supplied-record consistency | Synthetic fixtures; not ONNX semantics, authentic provenance or safety certification |
| Firmware MCP | The pinned upstream 10-tool stdio contract; planning/capabilities by default | Isolated mock packet/workflow and modern/legacy stdio tests |
| External typed CLI / hardware | Separate operator-provided matching upstream checkout/build | Not provisioned or tested against hardware here |

The firmware MCP has no motion, torque control, ID/mode/reset/reboot, arbitrary-register-write or firmware-flashing tools. Its supported XL330-M288-T settings are Return Delay Time, baud and LED only, preserving upstream identity/grant/EEPROM/readback/partial-result checks. Raw reads are not write permissions.

**This task must not use ProArt's connected OpenRB.** Do not enumerate ports, open devices, scan/read/write/flash hardware or move robots. Default launch disables hardware and OS serial discovery; a blocked catalog call is not an empty device inventory. Mock tests do not establish physical acceptance.

## Prepare locally

Requires Node >=22, Python >=3.9 (PyYAML/jsonschema for package validation). No global installation or host MCP registration is performed.

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run package
```

Inspect the lockfile and scripts first. The npm setup is local and deliberately suppresses lifecycle scripts. Tests compile the retained SDK in a disposable mock workspace; no firmware image build or training occurs. See [firmware setup and boundaries](modules/firmware/README.md).

The ZIP is a source plugin package with one ai-sapiens-dev enclosing directory. It excludes node_modules, test workspaces and unrelated files. Extract and prepare its local npm dependencies before importing through the host's supported local/private plugin flow. The mcp.json command is `node ${PLUGIN_ROOT}/modules/firmware/launch.mjs`, with hardware disabled. A web import does not deploy a Node process. Installed-host invocation has not been verified here.

## Use

- `$cyclo`: route the request to manual/learning or firmware tooling.
- `$cyclo-firmware`: explain supported settings or prepare a synthetic dry-run; current task prohibits real devices.
- `$ai-sapiens-docs`: find and cite the official manual, with freshness/source-outage handling.
- `$ai-sapiens-walking`: “AI Sapiens 보행 policy 학습 시켜줘” asks Cyclo Lab or Cyclo MJLab when unspecified.
- `$ai-sapiens-video-mimic`: prepare local video → GEM-X/SOMA → K1 retarget → Mimic.
- `$ai-sapiens-sim2real`: inspect matched assets, plan Sim2Sim/staging/rollback; no robot registry or deployment executor.
- `$ai-sapiens-diagnostics`, `$ai-sapiens-operation`, `$ai-sapiens-connectivity`, `$ai-sapiens-control`, `$ai-sapiens-motion-sources`: retained focused workflows.

The [34-page manual coverage matrix](references/coverage.md) distinguishes guidance, procedures and runtime evidence. Coming Soon remains explicit. Public source content is data, not permission to perform commands. Installing Skills does not provide a GPU, scheduler, credentials, robot identity or policy safety approval.

## Provenance, tests and publication

Upstream source is pinned in [UPSTREAM.json](modules/firmware/UPSTREAM.json) with SHA-256 for every imported file and [license notices](THIRD_PARTY_NOTICES.md). The original 0.2.0 project remains unchanged outside this new repository. Firmware MCP/SDK files are not modified; integration/test isolation is separate.

`validation/current/` records actual results. CI, if enabled in the private repository, runs the same mock-only checks with no serial/network target configuration. No marketplace or public publication is configured. Real host activation, external CLI build completeness and hardware acceptance remain unverified. Any future hardware-enabled session must be separately authorized and must not inherit the current task's prohibited target.
