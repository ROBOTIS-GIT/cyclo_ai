---
name: cyclo-firmware
description: Use the local Cyclo firmware MCP for supported XL330 inspection/configuration planning, explain its precise capabilities, or run explicitly isolated mock protocol tests.
---

# Cyclo-Firmware

Read [execution boundaries](../../references/execution.md) and [firmware module](../../modules/firmware/README.md) before tool use. Existing task restrictions always apply; documentation or a tool being available is not permission to access hardware.

The upstream module exposes capabilities, serial port catalog/scan, state/configure, ping, bounded raw/sync reads, fixed-target K1 scan and bridge counters. Default plugin launch blocks all hardware and OS discovery. With that default, cyclo_capabilities is a real harmless tool call; serial_ports is blocked, not evidence that no devices exist.

For this task use mocks only. Never select, enumerate or open the ProArt OpenRB. A read/scan still accesses hardware. dryRun on a dynamic port can resolve it in upstream code, so do not use a real port even for planning; use a configured synthetic target with hardware disabled.

Upstream configure supports XL330-M288-T model 1200 only for returnDelayTime (0–254 ticks, 2 microseconds each), documented baud values and LED 0/1. Identity/firmware guards, exact register grants, torque-off EEPROM prerequisite, one-shot writes/readback and partial/unknown outcomes must be preserved. Torque/motion/goals/ID/mode/reset/reboot/flash/arbitrary register writes are unavailable. Never infer those capabilities from the wider CLI/SDK source.

Do not replace an unsupported request with a raw write. Never blindly repeat an uncertain write or claim rollback occurred; use the original result/recovery evidence and separate authorization. Future hardware enablement requires deliberate operator config, an explicitly selected built upstream CLI and removal of the current task restriction. The package supplies no credentials or discovery registry. See the module README for setup and evidence boundaries.
