# Cyclo Plugin

A Codex and Claude Code plugin for ROBOTIS product guidance, AI Sapiens workflows, and DYNAMIXEL discovery, Control Table reads, and source-resolved writes.

The package runs one standalone `cyclo-products` MCP server. It depends on the public official DynamixelSDK packet implementation and pyserial, with no private firmware repository, external device CLI, generated TypeScript SDK, or firmware build required.

## Prepare and run

Requires Node >=22 and Python >=3.9. Inspect the dependencies, then install locally:

```sh
npm ci --ignore-scripts --no-audit --no-fund
python3 -m venv .venv
.venv/bin/python -m pip install -r modules/dynamixel/requirements.txt
```

Set `CYCLO_PRODUCTS_PYTHON` to the absolute path of that interpreter in the host environment. Configure the plugin using the [host guide](references/hosts.md). Startup, documentation, and tool listing perform no device I/O. `CYCLO_OFFLINE=1` explicitly disables hardware operations. A concrete customer command provides authorization for the selected port/bus and operation; each live MCP call requires `confirmed:true`.

## Device capabilities

| Workflow | Interface |
| --- | --- |
| Official product/model/source evidence | `robotis_sources`, `robotis_code`, `dynamixel_models`, `dynamixel_manual` |
| Serial adapter inventory | `dynamixel_ports` |
| Unicast Ping and bounded raw/controller reads, including optional Protocol 2 Sync Read | `dynamixel_ping`, `dynamixel_read` |
| Bounded Protocol 1/2 discovery | `dynamixel_scan` |
| Select an observed endpoint and inspect session state | `dynamixel_select`, `dynamixel_targets` |
| Inspect named items, widths, encodings, units, access and conditions | `dynamixel_table` |
| Read up to 16 exact items, including arbitrary supported table fields | `dynamixel_read_items` |
| Read one common item from up to 16 selected Protocol 2 IDs in one Sync Read request | `dynamixel_sync_read` |
| Write one resolved item, including RDT, offsets, torque, mode and goals | `dynamixel_write_item` |
| Named ID, baud, LED and profile configuration | `dynamixel_configure` |
| Swap actual persistent Control Table IDs through a free temporary ID | `dynamixel_swap_ids` |

All 89 bundled actuator documents use the existing shared model/item engine. Per-item semantics and firmware conditions determine execution; document counts do not certify every physical variant or feature. Original MX-64/MX-106 Current(68) remains unresolved rather than being redirected to another register. See [item coverage](references/control-table-runtime.md).

The plugin-owned port adapter passes supported serial rates, including 4.5, 6 and 10.5 Mbps, to pyserial and retains the unmodified public SDK for packets. Actual OS/adapter support is checked by opening the requested port; a CDC logical baud does not prove a bridge's downstream physical rate. Explicit `tcp://host:port` and `udp://host:port` endpoints support already configured packet bridges. No implicit route/channel/network configuration occurs. Cooperative leases, bounded requests, source/live prerequisites, one-shot writes, actual readback and uncertainty handling apply to every transport.

Custom devices use the native runtime after offline [external Control Table import and review](references/custom-control-tables.md). Unknown encodings remain raw reads; XML `RW` alone never grants writes. `CYCLO_PRODUCTS_CUSTOM_TABLES` names an operator-owned, source-hashed profile loaded by both validation layers. It cannot replace bundled catalog identities. No customer table is published automatically.

Use `$cyclo` for routing, `$dynamixel-expert` for catalog/custom devices, `$robotis-integrate` for ROS 2/DHI/source integration, and the focused AI Sapiens skills for their documented workflows. See [first connection](references/first-run.md) and [runtime configuration](modules/dynamixel/README.md).

## Verification and release boundary

```sh
python3 -m pip install -r validation/requirements.txt
npm test
npm run package
```

Tests exercise synthetic devices, in-memory packets, mock stdio and loopback network peers; they do not open attached robot ports. Packaging verifies manifests, skill references and the public SDK's pinned source hashes, then checks the extracted ZIP byte-for-byte. See [third-party notices](THIRD_PARTY_NOTICES.md). No first-party license or public publication permission is granted by a dependency's license.

A passing test suite is not hardware certification. Live motion requires the customer's explicit goal/torque authorization and applicable model/mode/limit conditions. Reset, reboot, flashing, calibration firmware, training and deployment are not generic Control Table writes and are not exposed by this device MCP.
