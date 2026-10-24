# Cyclo firmware MCP

Local stdio tools for AI-driven DYNAMIXEL inspection and configuration. The
locked official MCP SDK 2.3.1 owns modern/legacy protocol handling. The adapter
invokes typed CLI commands; the TypeScript SDK owns packet handling and the
configuration workflow. There is no duplicate protocol stack or shell tool.

## Setup

In a real repository checkout, install the normal tools workspace dependencies
and build the SDK and CLI. Install the standalone MCP package separately:

```sh
npm --prefix tools ci
npm --prefix tools run build:sdk
npm --prefix tools run build:uart-bridge
npm --prefix tools run build:dashboard
npm --prefix tools run build:cli
npm --prefix tools/cyclo_firmware_mcp ci --workspaces=false --ignore-scripts
npm --prefix tools/cyclo_firmware_mcp test --workspaces=false
CYCLO_MCP_CONFIG=/absolute/private/config.json node tools/cyclo_firmware_mcp/src/server.mjs
```

Use the direct Node command for host stdio registration; npm startup logs do
not belong on the protocol stream. This change does not register a host,
install credentials, alter network settings, or deploy a public service.

## Intent-based operations

| Tool | Intent / result |
|---|---|
| `cyclo_serial_ports` | List OS serial devices, canonical/stable paths, VID/PID, serial number and permission hints without opening a port. |
| `cyclo_serial_scan` | Probe explicit IDs or an inclusive range (default 0–252), at up to 7 baud rates; return progress, completed probes and continuation evidence under a 12-second budget. |
| `cyclo_device_state` | Validate configured identity and read documented register and torque state in one call. |
| `cyclo_configure` | Validate identity and permission, snapshot originals, execute each changed register once, reconnect after baud changes, verify readback, and return partial/unknown outcomes with read-only recovery probes. |
| `cyclo_ping` | Identify one unicast device. |
| `cyclo_read` / `cyclo_sync_read` | Read bounded raw bytes from one or several devices. |
| `cyclo_scan` | Scan explicit K1 TCP/UDP channels on fixed ports 5001–5005. |
| `cyclo_bridge_profile` | Read timing counters without resetting them. |
| `cyclo_capabilities` | Show targets, transports, default baud, scan scope, configured model/firmware and exact register grants. Optional discovery; never a prerequisite call. |

Reads and permitted writes execute by default. `dryRun: true` produces an
optional plan without accessing hardware. Empty/default configuration uses local mode: select a listed serial port and device ID directly. Existing target-based configuration remains restricted unless explicitly changed to local mode. No preliminary ping, approval boolean,
plan token, or second execute call is required.

The documented configuration map currently supports **XL330-M288-T model
1200**, with an optional exact firmware guard supplied by the host:

- `returnDelayTime`: raw ticks 0–254, each tick is **2 microseconds**; EEPROM.
- `baudRate`: bits/second, one of 9600, 57600, 115200, 1000000, 2000000,
  3000000, 4000000; EEPROM. Its raw control-table index is encoded by the SDK.
- `led`: 0 or 1; RAM.

Unknown or mismatched identities fail closed before writing. Other device
models retain the raw read tools; no register map is guessed for them.
The workflow pings the selected ID and checks the actual model before touching
its documented registers. Unknown models fail with identity evidence.
Torque enable, motion, goal values, operating mode, ID change, reset, reboot,
flash, arbitrary addresses and raw instruction writes are unavailable.

Examples (each is one MCP call; listing is optional if the port is known):

```json
{"name":"cyclo_serial_ports","arguments":{}}
{"name":"cyclo_serial_scan","arguments":{"port":"/dev/ttyACM0","minId":0,"maxId":40,"bauds":[57600,1000000],"budgetMs":12000}}
{"name":"cyclo_device_state","arguments":{"port":"/dev/ttyACM0","id":7,"baud":1000000}}
{"name":"cyclo_configure","arguments":{"port":"/dev/ttyACM0","id":7,"baud":1000000,"changes":{"returnDelayTime":0,"baudRate":2000000}}}
```

## Local and restricted policies

No configuration file is required for local serial use. `config.example.json`
contains `{"mode":"local"}`. Port selection resolves OS-enumerated serial
character devices and their aliases; arbitrary files, nonserial device nodes
and absent ports are rejected. Discovery does not open a device. Permission
hints reflect OS access checks, not guaranteed open or exclusive ownership.
Permission failures remain operator errors; no chmod or privilege escalation
is performed. Port identities are USB/OS descriptors, not credentials.

Local serial calls accept `port`, optional `transport` (`uart-rs485` default,
`vcp` also supported), optional `baud` (1Mbps default), and optional
`timeoutMs` (100ms default). IDs are dynamic; state and configuration discover
and validate the actual model internally. Only the documented RDT/baud/LED
writes are supported. EEPROM still requires torque already off. No target
alias, configured device declaration, approval boolean or plan token is needed.
Choose exactly one `port` or configured `target`.

An operator can use `config.restricted.example.json` for the previous policy:
`mode:"restricted"`, hardware disabled by default, fixed targets, per-device
expected model/optional firmware and exact named-register grants. Existing
configs containing `targets` or `allowHardwareReads` automatically retain this
restricted behavior. Restricted calls reject dynamic port selection; scans
require host `allowScan`. An explicit `allowHardwareReads:false` also disables
execution in local mode. Network operations continue to require fixed targets;
this change makes local serial endpoints dynamic, not arbitrary network hosts.
Malformed/null configuration is rejected.

Serial discovery supports 253 unicast IDs and seven baud rates. The default
scan covers IDs 0–252 at the selected/current baud. Supply `ids` or an inclusive
`minId`/`maxId` range, never both. A scan budget (100–12000ms) stops additional
probes and returns `complete`, `completed`, `total`, `stopped`, and all completed
probe evidence. A failed connection records its whole rate/ID group. Continue
only the unprobed pairs. MCP progress notifications report completed pairs.
Cancellation preserves bounded checkpoints even if a long ping needs forced
termination; clients cancelling a request may not receive its final result.

Results include original raw values, interpreted `registersBefore`, requested
and observed values for each attempted change, identity and current baud.
Unchanged values are skipped. Baud is applied last. A lost write status does
not trigger a repeat: readback may establish success. A later failure leaves
earlier verified changes in place and reports `partial`; an uncertain first
write reports `unknown`. `not_written` means no write was attempted.
Recovery probes only read the original/requested baud rates; they never
retry or roll back a write. Inspect this evidence before any new write.
An execution failure is returned as an MCP tool error with structured data.

Cancellation/deadline terminates the child, escalates SIGTERM to SIGKILL after
200 ms, and holds bus ownership until actual child **close**. If a write
process dies before returning evidence, the result is conservatively unknown.
A cancelled client may not receive that final result; reconnect and inspect
state before issuing a new write. No restoration is claimed. Busy calls fail. Same-user MCP adapters also acquire
cooperative leases in a stable POSIX `/tmp` directory, matching canonical serial
paths and device nodes; the launched CLI receives that pinned path. Optional
host-configured `busId` groups aliases, including network routes. Physical
serial identity remains enforced even when bus IDs differ. Missing or changed
serial bindings fail closed. Stale leases are not automatically reclaimed: an
operator must establish that all owners and child processes have exited before
cleanup. These leases cannot coordinate unrelated direct CLI programs, other
noncooperating processes, or other UNIX users. Use one owner per physical bus.

A transport close failure preserves snapshots, acknowledgment evidence, and
verified changes, reports cleanup errors, and stops reconnect/recovery until
closure is established. A process failure preserves any valid SDK result
already emitted. Failed lease cleanup retains the reservation and reports an
operator recovery warning; it never silently permits a successor operation.

Reads are bounded to 1024 bytes and 16 IDs; combined child output is limited
to 256 KiB (512 KiB for bounded scan checkpoints) and execution to 15 seconds. Serial scans return partial evidence when their 12-second work budget expires. Child stderr is counted but not exposed to the model.

## Evidence and scope

Prepared from verified remote `feature-dots` commit
`8b4b660541d164977fb5ed1da10da4c37ba0c16a`. This execution environment held a
source subset fetched through the GitHub connector, not a complete checkout.
Any accompanying local preparation commit/patch is a review artifact and must
be applied onto the real branch; it must never replace its Git history.
No firmware implementation or generated map change is intended.

Tests exercise actual SDK packets over mock byte transports and actual
modern (2026-07-28) and legacy MCP stdio clients: combined RDT/baud writes,
close/reopen, readback, lost acknowledgments, partial outcomes, both-rate
recovery, model/firmware refusal, torque-on EEPROM refusal, exact host grants,
optional planning, write cancellation, process limits and closure races.
Software tests do not establish physical hardware acceptance. No hardware
writes were performed for this change.

Design references checked October 2026:

- [Current MCP tool specification](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- [Official TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [OpenAI function calling guidance](https://developers.openai.com/api/docs/guides/function-calling)
- [Anthropic tool ergonomics](https://www.anthropic.com/engineering/writing-tools-for-agents)
- [GitHub MCP scoped read/write design](https://github.com/github/github-mcp-server)
- [ROBOTIS XL330-M288-T control table](https://emanual.robotis.com/docs/en/dxl/x/xl330-m288/)
