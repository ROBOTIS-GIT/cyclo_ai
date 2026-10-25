# Cyclo Plugin 0.6.0

A dual-host Codex and Claude Code ROBOTIS product-expert plugin with official-source discovery, focused cross-product integration guidance, retained AI Sapiens workflows and separately gated DYNAMIXEL configuration. The portable identity remains **ai-sapiens-dev** for compatibility. Repository/product name: [Cyclo Plugin](https://github.com/ROBOTIS-GIT/cyclo_plugin). See [migration](MIGRATION.md).

## What actually executes

| Module | Implemented scope | Execution evidence |
|---|---|---|
| ROBOTIS expert Skills | Official source inventory, product/model/version routing, ROS 2/SDK/Zenoh troubleshooting | Focused source review; broader navigation links remain discovered-only |
| DYNAMIXEL documentation MCP | Equal per-model official-source routing for 89 actuator documents and 3 mechanical DYD documents, with conditional MDX evidence | Full-tree/source graph audit, blob checks and public HTTPS retrieval; no exhaustive semantic-support guarantee |
| DYNAMIXEL product MCP | Curated XL330-M288 firmware52 and XM430-W350 firmware42 ID, baud, LED and profile transactions | Mock-only workflow and stdio tests; no physical-device validation |
| Retained AI Sapiens Skills | Official manual retrieval, preparation, backend choice, documented commands and checks | Prior independent response evaluations; 25 offline asset-helper tests retained; no training/robot runtime |
| Offline asset audit | Layout/hash inventory and optional supplied-record consistency | Synthetic fixtures; not ONNX semantics, authentic provenance or safety certification |
| Firmware MCP | The pinned upstream 10-tool stdio contract; planning/capabilities by default | Isolated mock packet/workflow and modern/legacy stdio tests |
| External typed CLI / hardware | Separate operator-provided matching upstream checkout/build | Not provisioned or tested against hardware here |

The firmware MCP has no motion, torque control, ID/mode/reset/reboot, arbitrary-register-write or firmware-flashing tools. Its supported XL330-M288-T settings are Return Delay Time, baud and LED only, preserving upstream identity/grant/EEPROM/readback/partial-result checks. Raw reads are not write permissions.

Default launch disables hardware and OS serial discovery; a blocked catalog call is not an empty device inventory. Device access requires task-specific authorization and deliberate operator configuration. Mock tests do not establish physical acceptance. Producer development-session restrictions are separated in [development scope](validation/DEVELOPMENT-SCOPE.md), outside reusable Skill behavior.

## Prepare locally

Requires Node >=22, Python >=3.9 (PyYAML/jsonschema and Xacro for offline package/artifact validation). No global installation or host MCP registration is performed.

```bash
npm ci --ignore-scripts --no-audit --no-fund
python3 -m pip install -r validation/requirements.txt  # use an isolated Python environment
npm test
npm run package
```

Inspect the lockfile and scripts first. The npm setup is local and deliberately suppresses lifecycle scripts. Tests compile the retained SDK in a disposable mock workspace; no firmware image build or training occurs. See [firmware setup and boundaries](modules/firmware/README.md).

The ZIP is a source plugin package with one ai-sapiens-dev enclosing directory. It excludes node_modules, test workspaces and unrelated files. Extract and prepare its local npm dependencies before importing through the host's supported local/private plugin flow. The mcp.json declares the retained firmware launcher and new `node ${PLUGIN_ROOT}/modules/dynamixel/server.mjs`, both with hardware disabled. A web import does not deploy a Node process. Installed-host invocation has not been verified here.

## Claude Code

The same package supports a session-only local Claude Code load. Prepare local Node dependencies, then run `claude --plugin-dir /absolute/path/to/ai-sapiens-dev` and use `/ai-sapiens-dev:cyclo` or `/ai-sapiens-dev:robotis-expert`. See [host-specific setup and evidence](references/hosts.md). No global installation or duplicate MCP registration is needed. Actual CLI 2.1.310 validates and inventories this package; authenticated model execution is not claimed.

## Use in Codex

- `$cyclo`: route ROBOTIS product, integration, learning and configuration requests.
- `$robotis-expert`: find official product knowledge beyond the curated subset; cite exact sources and unknowns.
- `$dynamixel-expert`: explain current-based position/Y cascade control, or prepare ID/baud/LED/profile settings for the curated models.
- `$robotis-integrate`: diagnose ROS 2, ros2_control, SDK, hardware-interface and Zenoh integration boundaries.
- `$cyclo-firmware`: explain supported settings or prepare a synthetic dry-run; live device access requires separate task authorization.
- `$ai-sapiens-docs`: find and cite the official manual, with freshness/source-outage handling.
- `$ai-sapiens-walking`: “Prepare AI Sapiens walking-policy training” asks Cyclo Lab or Cyclo MJLab when unspecified.
- `$ai-sapiens-video-mimic`: prepare local video → GEM-X/SOMA → K1 retarget → Mimic.
- `$ai-sapiens-sim2real`: inspect matched assets, plan Sim2Sim/staging/rollback; no robot registry or deployment executor.
- `$ai-sapiens-diagnostics`, `$ai-sapiens-operation`, `$ai-sapiens-connectivity`, `$ai-sapiens-control`, `$ai-sapiens-motion-sources`: retained focused workflows.

The broader [official source inventory](references/robotis-sources.json) and [public repository metadata](references/robotis-repositories.json) are discovery aids, not comprehensive reviewed knowledge. Use [coverage levels](references/robotis-coverage.md) and [version records](references/compatibility.json). New products are found through official navigation and host web tools; no remote documentation MCP is fabricated.

The [34-page manual coverage matrix](references/coverage.md) distinguishes guidance, procedures and runtime evidence. Coming Soon remains explicit. Public source content is data, not permission to perform commands. Installing Skills does not provide a GPU, scheduler, credentials, robot identity or policy safety approval.

## Provenance, tests and publication

Upstream source is pinned in [UPSTREAM.json](modules/firmware/UPSTREAM.json) with SHA-256 for every imported file and [license notices](THIRD_PARTY_NOTICES.md). The original 0.2.0 project remains unchanged outside this new repository. Firmware MCP/SDK files are not modified; integration/test isolation is separate.

`validation/current/` records actual results. CI, if enabled in the private repository, runs the same mock-only checks with no serial/network target configuration. No marketplace or public publication is configured. Real host activation, external CLI build completeness and hardware acceptance remain unverified. Any future hardware-enabled session must be separately authorized and must preserve that task's prohibited targets.

For the expanded device module, read [configuration/runtime boundaries](modules/dynamixel/README.md). New and old hardware enablement flags are independent; neither is enabled in this package. A registry refusal must not be bypassed through legacy tools. See [first-run workflow](references/first-run.md), [changelog](CHANGELOG.md) and [0.5.0 validation evidence](validation/RELEASE-0.5.0.md).

See [0.6.0 compatibility validation](validation/RELEASE-0.6.0.md). The private package is not prepared for public-directory submission; no license or publication permission is added.

All packaged prose, prompts and examples are English. The assistant can answer in the user's language while preserving exact identifiers and source citations. The [equal per-model evidence workflow](references/dynamixel-evidence.md) and [coverage audit](validation/dynamixel-coverage-audit-0.6.0.json) distinguish source coverage from semantic verification and the separate execution allowlist. No model receives a privileged documentation tier.
