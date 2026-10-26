# Cyclo firmware module

This module reuses upstream MCP 0.1.0 and SDK source at the pin in [UPSTREAM.json](UPSTREAM.json), with [license](upstream/LICENSE) and retained upstream documentation. The wider CLI contains features the MCP does not expose. No new hardware operations are added.

## Local preparation and default startup

Node >=22 is required. From plugin root, inspect package.json and the lockfile, then run `npm ci --ignore-scripts --no-audit --no-fund`. This installs only local dependencies, without lifecycle scripts. Use the direct process `node modules/firmware/launch.mjs` for stdio; npm log output must not enter the protocol pipe. The packaged mcp.json points at that actual entrypoint. No global MCP registration is needed or performed by this project.

Default launch makes hardware tools available but performs no startup CLI, port or device I/O. Every serial operation defaults to a no-I/O dry run; a real call requires `dryRun:false` and `confirmed:true` after user approval. OS port listing requires `confirmed:true`. Dynamic-port previews do not resolve OS bindings. Set `CYCLO_OFFLINE=1` for fully offline operation; legacy `CYCLO_PLUGIN_ENABLE_HARDWARE=0` also disables this module, including its list/resolve callbacks.

## Operator-managed runtime

Actual execution requires an absolute `CYCLO_PLUGIN_CLI_PATH` to a matching upstream built CLI. The executable prerequisite is checked lazily on a real operation, so absent executor dependencies do not break documentation startup. The package does not provision that CLI or change serial permissions. Use the pinned upstream reviewed build instructions in an operator-owned project; no global setup occurs. Hardware availability is not consent to discover, scan, write, recover or move anything.

Restricted config and register grants remain upstream semantics. The supplied config.disabled.json contains no devices or ports. Do not copy upstream illustrative device/port examples as discovered identities. Configuration examples do not grant device access; preserve the actual task's restrictions.

## Mock testing

`npm test` runs the original adapter/lease/process/workflow and legacy/modern stdio suites against temporary mocked SDK transports, plus the packaged launcher and retained Python regressions. A temporary SDK copy blocks real serial opens and default OS catalogs, and suppresses the SDK's serial-alias directory enumeration even with an injected mock catalog. Tests may stat known pseudo-device fixture paths such as /dev/null but never open serial devices or enumerate attached ports. Source hashes verify upstream files are unchanged.

These are software tests. They do not validate physical XL330 behavior, a connected OpenRB, firmware flashing, training, policy deployment or installed Codex host activation. An actual failure/unknown result requires inspection; no retry or rollback is implied.
