# Cyclo Plugin

A Codex and Claude Code plugin for ROBOTIS product guidance and DYNAMIXEL devices. Discover motors, read live control tables, change documented settings, and work with custom actuator, controller and sensor tables. AI Sapiens skills cover documented development and operation workflows.

The runtime uses the public official DynamixelSDK and pyserial. No private firmware repository or firmware build is needed. First-party source is [Apache-2.0](LICENSE).

## Install

Use Node.js >=22 and Python >=3.9. From the plugin source directory:

```sh
npm ci --ignore-scripts
npm run setup
npm run doctor -- --hardware-deps
```

Setup creates a local Python environment and installs the hardware dependency. Diagnostics check dependencies without enumerating or opening devices. The runtime finds `.venv` automatically; `CYCLO_PRODUCTS_PYTHON` can select another prepared interpreter.

Register the directory using the [Codex or Claude Code host guide](references/hosts.md). If the host copies the plugin into a cache, set its `CYCLO_PRODUCTS_PYTHON` to the absolute interpreter path printed by setup. Start with `$cyclo` in Codex or `/cyclo-plugin:cyclo` in Claude Code.

Try: “Scan the routed port at 6 Mbps and read the homing offset of every motor.” A concrete command supplies authorization for that operation; the skill asks for missing target information rather than repeatedly confirming the same request. Set `CYCLO_OFFLINE=1` for documentation-only use.

## Workflows

| Task | Tools |
| --- | --- |
| Find models, official manuals and implementation evidence | `dynamixel_models`, `dynamixel_manual`, `robotis_sources`, `robotis_code` |
| List adapters and scan a selected bus | `dynamixel_ports`, `dynamixel_scan` |
| Select one or several devices from one scan | `dynamixel_select`, `dynamixel_select_many`, `dynamixel_targets` |
| Inspect tables and read named fields | `dynamixel_table`, `dynamixel_read_items` |
| Read a common field across a robot, with automatic batching | `dynamixel_sync_read` |
| Inspect unknown controllers or raw byte ranges | `dynamixel_ping`, `dynamixel_read` |
| Write documented settings, goals, modes or torque | `dynamixel_write_item`, `dynamixel_configure` |
| Swap persistent device IDs with verified intermediate steps | `dynamixel_swap_ids` |

Read-only targets preserve read-only permissions. Scans remain usable for multiple selections until they expire or a bus operation invalidates them. Scan budgets adapt to the requested matrix; an optional explicit budget returns an incomplete result when time runs out. Large Sync Read requests are split into bounded SDK batches; they do not require the user to split a robot into groups of 16.

The bundled catalog covers 89 actuator documents through a shared contract engine. Firmware, encoding and item-specific conditions determine executable support. Custom tables use an [offline importer and reviewed contracts](references/custom-control-tables.md). Controllers and sensors can omit torque and baud registers; unknown encodings remain available as raw reads. See [item coverage](references/control-table-runtime.md) for remaining gaps, including original MX Current(68).

Serial, explicit TCP and UDP bridges are supported. The adapter passes rates including 6 Mbps to the OS; actual adapter/driver support and a bridge's downstream rate must match the connection. Windows COM aliases are normalized; Linux/macOS use canonical character-device identities. CI covers the offline suite on Linux/macOS and dependency setup plus offline MCP startup on Windows. Physical adapter compatibility must be verified separately.

## Develop and contribute

```sh
npm run setup -- --dev
npm test
npm run format:check
npm run format:python:check
npm run package
```

Read [CONTRIBUTING](CONTRIBUTING.md), [architecture](references/architecture.md), [catalog development](references/catalog-development.md), and [security reporting](SECURITY.md). Examples and source text can use any language. Tests use injected devices, packet fixtures and loopback sockets.

Release ZIPs use a reviewed file manifest and reproducible timestamps; local environments and customer profiles are excluded. See [release preparation](references/releasing.md) and [third-party notices](THIRD_PARTY_NOTICES.md). Historical private firmware remains in old Git commits and needs a maintainer decision before publishing the full history.

Verified register readback does not establish physical motion completion. Reset/reboot/flashing and unsupported encodings are separate capabilities, not generic register writes. See [runtime configuration](modules/dynamixel/README.md) and [first connection](references/first-run.md).
