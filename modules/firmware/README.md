# Cyclo firmware module

This module reuses upstream MCP 0.1.0 and SDK source at the pin in [UPSTREAM.json](UPSTREAM.json), with [license](upstream/LICENSE) and retained upstream documentation. The wider CLI contains features the MCP does not expose. No new hardware operations are added.

## Local preparation and default startup

Node >=22 is required. From plugin root, inspect package.json and the lockfile, then run `npm ci --ignore-scripts --no-audit --no-fund`. This installs only local dependencies, without lifecycle scripts. Use the direct process `node modules/firmware/launch.mjs` for stdio; npm log output must not enter the protocol pipe. The packaged mcp.json points at that actual entrypoint. No global MCP registration is needed or performed by this project.

Default launch is restricted/planning-only, empty targets and hardware disabled. Both runner and serial list/resolve callbacks reject before device access. cyclo_capabilities works. cyclo_serial_ports returns a disabled error rather than enumerating attached hardware. An explicitly supplied config may provide synthetic targets for dryRun; execution remains disabled. No built CLI is required for that mode. Never point tests at real device paths.

## Future operator-managed runtime (not authorized or tested here)

Hardware is not enabled by package installation. A later task would need separate authorization with the current hardware prohibition removed, trusted configuration in CYCLO_MCP_CONFIG, CYCLO_PLUGIN_ENABLE_HARDWARE=1 and an absolute CYCLO_PLUGIN_CLI_PATH to a real matching upstream tools/cyclo_firmware_cli/dist/cli.js. Use the pinned upstream checkout's reviewed workspace build instructions; CLI build/dependency completeness is not established by this package's mock tests. The launcher then passes fixed upstream-built argv through captureJson; MCP inputs cannot supply a shell, executable or arbitrary argv. This does not modify global settings.

Restricted config and register grants remain upstream semantics. The supplied config.disabled.json contains no devices or ports. Do not copy upstream illustrative device/port examples as discovered identities. The task forbids touching ProArt's OpenRB; no future configuration example here grants an exception.

## Mock testing

`npm test` runs the original adapter/lease/process/workflow and legacy/modern stdio suites against temporary mocked SDK transports, plus the packaged launcher and retained Python regressions. A temporary SDK copy blocks real serial opens and default OS catalogs, and suppresses the SDK's serial-alias directory enumeration even with an injected mock catalog. Tests may stat known pseudo-device fixture paths such as /dev/null but never open serial devices or enumerate attached ports. Source hashes verify upstream files are unchanged.

These are software tests. They do not validate physical XL330 behavior, a connected OpenRB, firmware flashing, training, policy deployment or installed Codex host activation. An actual failure/unknown result requires inspection; no retry or rollback is implied.
