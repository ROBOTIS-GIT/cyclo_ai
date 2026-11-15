# Standalone DYNAMIXEL product runtime

`cyclo-mcp` owns documentation, discovery, selected targets, generic Control Table reads/writes and verified communication transitions. Node loads the source contracts; a bounded Python stdio bridge independently enforces the same contracts immediately before writing. Packet encoding and parsing use the unmodified public official [DynamixelSDK pin](SDK-UPSTREAM.json), with [retained license](sdk-upstream/LICENSE). No external device CLI or private firmware repository is required.

## Runtime and configuration

Install Node dependencies from the package lockfile with lifecycle scripts disabled. For device operations, use `npm run setup` to prepare the automatically detected local environment, or set `CYCLO_PRODUCTS_PYTHON` to another prepared interpreter. Documentation and default tool listing require neither serial dependencies nor a hardware process. The bridge starts lazily for a concrete live request. `CYCLO_OFFLINE=1` or `CYCLO_PRODUCTS_ENABLE_HARDWARE=0` blocks hardware access.

Optional `CYCLO_PRODUCTS_CONFIG` binds named buses/targets with separate discovery, scan and configuration permissions. Without it, an explicitly selected port can be scanned and the observed endpoint selected. Explicit policies cannot be bypassed with dynamic aliases. Scans, reads and writes require the customer's authorization and `confirmed:true`; previews do no device I/O. Selected handles are session-local and become blocked after uncertain state, binding changes or unconfirmed closure. Operator files are never rewritten.

## Transport

`port` accepts a discovered serial device or an explicit `tcp://host:port` / `udp://host:port` packet-bridge endpoint. The plugin-owned serial adapter delegates to pyserial and supports the SDK's standard host rates plus 4.5, 6 and 10.5 Mbps without changing vendored SDK source. Driver/adapter errors propagate before any register write. Baud transitions open/probe the destination rate before writing. A supported host rate is not proof of an actual bridge channel's physical rate; bridge routing and channel configuration are never changed implicitly.

TCP/UDP adapters expose the SDK's byte-port interface with bounded connect/send/receive behavior. Their host baud is metadata for an already configured bridge; it does not configure a network channel. The cooperative lease owns serial canonical path/device identity or the whole explicit network host, so concurrent requests and baud reconnects cannot overlap participating operations. DNS aliases, separate hosts, and unrelated tools are outside that cooperative guarantee.

## Catalog and custom devices

`dynamixel_ping` and `dynamixel_read_raw` permit explicit, bounded, read-only inspection of unindexed controllers/sensors that have no actuator torque/baud register contract. They return Ping evidence and raw bytes without inventing a model table, signed units or write permission. Target-specific grants cannot change the inspected ID/rate/protocol; explicit bus grants and all offline/confirmation/binding/lease checks remain in force. Use source-resolved named reads where available.

The bundled catalog retains 89 actuator documents and the item inventory, including precise firmware/mode/torque/lock/range conditions. Reads return actual bytes, raw values where known, and unit/scale metadata. Writes target one exact source-resolved item; torque, operating mode, limits and goals are never changed as prerequisites for a different request. Unknown widths/encodings or manufacturer write contracts remain explicitly unresolved. Original MX Current(68) is not silently mapped to Goal Torque(71).

[Custom Control Tables](../../references/custom-control-tables.md) are native operator-owned profiles loaded at startup through `CYCLO_PRODUCTS_CUSTOM_TABLES`. An offline XML importer generates a reviewable profile; RW attributes alone do not grant writes. Both layers validate source hashes, explicit firmware applicability, non-overlapping register definitions, raw encodings/bounds and declarative live conditions. Namespaced `custom/` identities cannot replace bundled catalog entries. Custom models use the same scan/select/read/write/ID/baud engine and can be selected on multi-device buses without a global catalog edit. The initial custom schema supports single-axis scalar writes; custom protocol changes, indirect aliases and unresolved conditions require additional source-contract support rather than guessed behavior.

`dynamixel_read_many` reads one common named item across selected targets. It automatically chooses Protocol 2 Sync Read for matching layouts or Bulk Read for mixed layouts; Protocol 1 Bulk Read is limited to documented MX/X models excluding XL320. Bounded batches retain identity, device-status and byte checks. It does not claim physically atomic sampling.

`dynamixel_write` handles one named item, including ID and baud through verified transitions. The legacy public configure and multi-item read tools are removed. `dynamixel_swap_ids` performs `A -> temporary`, `B -> A`, `temporary -> B` under one bus lease with identity, prerequisites, destination probes, continuity/readback and closure checks at each step. Failures retain the observed partial state for read-only reconciliation and never trigger a blind retry or rollback. Identical model/firmware values are not proof of a unique physical serial identity.

See [item-level conditions and coverage](../../references/control-table-runtime.md). Reset/reboot/flash are not register writes and are not exposed. Tests establish synthetic workflow and packet/stdio behavior; they do not certify physical devices, firmware revisions, motion, timing or an installed host session.

For dependency setup use `npm run setup`; `npm run doctor -- --hardware-deps` performs device-free diagnostics. `.venv` is discovered automatically. See [architecture](../../references/architecture.md) for connection contracts, batching and session behavior.

`cyclo_mimic` provides read-only K1 BeyondMimic/SuperMimic selection guidance for Lab and MJLab. It returns checkout checks and method-specific artifact contracts, makes no local capability claim, and blocks unvalidated SuperMimic export/Sim2Real. It does not start a simulator, training job or device provider. See [method matrix](../../skills/ai-sapiens-video-mimic/references/methods.md).
