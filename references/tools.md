# DYNAMIXEL tools and runtime behavior

| Task | Tools |
| --- | --- |
| Find models, official manuals and implementation evidence | `dynamixel_models`, `dynamixel_manual`, `robotis_sources`, `robotis_code` |
| List adapters and scan a selected bus | `dynamixel_ports`, `dynamixel_scan` |
| Select one or several devices from one scan | `dynamixel_select`, `dynamixel_select_many`, `dynamixel_targets` |
| Inspect tables and read named fields | `dynamixel_table`, `dynamixel_read` |
| Read a common field across a robot, with automatic batching | `dynamixel_read_many` |
| Inspect unknown controllers or raw byte ranges | `dynamixel_ping`, `dynamixel_read_raw` |
| Write documented settings, goals, modes or torque | `dynamixel_write` |
| Write one common RAM item across selected motors in one packet | `dynamixel_write_many` |
| Swap persistent device IDs with verified intermediate steps | `dynamixel_swap_ids` |

Read-only targets preserve read-only permissions. Scans remain usable for multiple selections until they expire or a bus operation invalidates them. Scan budgets adapt to the requested matrix; an optional explicit budget returns an incomplete result when time runs out. Large native group read requests are split into bounded SDK batches; they do not require the user to split a robot into groups of 16.

The bundled catalog covers 89 actuator documents through a shared contract engine. Firmware, encoding and item-specific conditions determine executable support. Custom tables use an [offline importer and reviewed contracts](custom-control-tables.md). Controllers and sensors can omit torque and baud registers; unknown encodings remain available as raw reads. See [item coverage](control-table-runtime.md) for remaining gaps, including original MX Current(68).

Serial, explicit TCP and UDP bridges are supported. The adapter passes rates including 6 Mbps to the OS; actual adapter/driver support and a bridge's downstream rate must match the connection. Windows COM aliases are normalized; Linux/macOS use canonical character-device identities. CI covers the offline suite on Linux/macOS and dependency setup plus offline MCP startup on Windows. Physical adapter compatibility must be verified separately.

Verified register readback does not establish physical motion completion. Reset, reboot, flashing and unsupported encodings are separate capabilities, not generic register writes.

See [runtime configuration](../modules/dynamixel/README.md), [first connection](first-run.md), and the [skill catalog](skills.md).
