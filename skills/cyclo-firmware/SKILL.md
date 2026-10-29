---
name: cyclo-firmware
description: Use the local Cyclo firmware MCP for supported XL330 inspection/configuration planning, explain its precise capabilities, or run explicitly isolated mock protocol tests.
---

# Cyclo-Firmware

Read [execution boundaries](../../references/execution.md) and [firmware module](../../modules/firmware/README.md) before tool use. Existing task restrictions always apply; documentation or a tool being available is not permission to access hardware.

The upstream module exposes capabilities, serial port catalog/scan, state/configure, ping, bounded raw/sync reads, fixed-target K1 scan and bridge counters. Default plugin launch blocks all hardware and OS discovery. With that default, cyclo_capabilities is a real harmless tool call; serial_ports is blocked, not evidence that no devices exist.

A read/scan still accesses hardware. Upstream dryRun on a dynamic port can resolve the OS port; use a configured synthetic target when device access is outside scope. Request concrete operator authorization before enabling discovery or a live executor.

Upstream configure supports XL330-M288-T model 1200 only for returnDelayTime (0–254 ticks, 2 microseconds each), documented baud values and LED 0/1. Identity/firmware guards, exact register grants, torque-off EEPROM prerequisite, one-shot writes/readback and partial/unknown outcomes must be preserved. Torque/motion/goals/ID/mode/reset/reboot/flash/arbitrary register writes are unavailable. Never infer those MCP capabilities from the wider CLI/SDK source. Custom devices or customer-supplied tables use [DYNAMIXEL expert](../dynamixel-expert/SKILL.md) and its separate [external-table workflow](../../references/custom-control-tables.md); that workflow may use a verified installed CLI directly without claiming the firmware MCP exposes the operation.

Do not replace an unsupported firmware MCP request with an unreviewed raw write. Distinguish a capability gap from an explicit policy denial; source-resolved operations for custom devices follow the external-table workflow above and must preserve all operator restrictions. Never blindly repeat an uncertain write or claim rollback occurred; use the original result/recovery evidence and separate authorization. Future hardware enablement requires deliberate operator config, an explicitly selected built upstream CLI and authorization for the specific bus and operation. The package supplies no credentials or discovery registry. See the module README for setup and evidence boundaries.
