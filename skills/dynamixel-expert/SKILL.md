---
name: dynamixel-expert
description: Explain DYNAMIXEL models and control modes from official manuals, or guide model-aware ID, baud, LED and profile configuration using the explicitly gated product MCP.
---

# DYNAMIXEL expert

For any current or legacy DYNAMIXEL model question, first read [equal per-model evidence](../../references/dynamixel-evidence.md) and the [feature topic map](references/control.md). Use `dynamixel_models` to identify the exact official document, then `dynamixel_manual` or host source tools to read its table, conditions and relevant shared components. Every indexed model follows this same procedure; no motor receives a privileged documentation tier. Answer in the user's language, using English search terms as needed without changing model identifiers. A failed fetch or unresolved feature gate is unknown, not unsupported. Do not call port discovery, ping, scan, state or configuration tools for explanation-only requests.

For “Change the connected DYNAMIXEL ID”, distinguish ID from baud. Ask the desired new ID and resolve one physical device; do not interpret it as a baud change. Read [first connection and selection](../../references/first-run.md) and [configuration procedure](references/configuration.md) before action. Multiple devices/rates, ambiguous model or unknown firmware require a targeted question, not automatic selection. Discovery itself requires authorization for the selected port/bus; a documentation question does not grant it.

For “Configure the motion profile”, ask intended behavior, exact model/firmware and operating mode, time versus velocity profile, physical units, and application acceleration/velocity limits. Explain zero/infinite settings and profile activation. Produce an explicit plan; do not send a position goal to demonstrate it.

Documentation tools cover the full indexed product source set independently of execution permissions. The MCP also provides local `robotis_sources`, `dynamixel_registry`, gated `dynamixel_ports`, bounded `dynamixel_scan`, explicit observed-target `dynamixel_select`, session-state `dynamixel_targets`, and named `dynamixel_configure`. Read [module/runtime boundaries](../../modules/dynamixel/README.md). All 89 actuator documents use the same identity/capability engine. Inspect source-bound per-operation status and firmware/mode conditions with `dynamixel_registry`; no model/firmware whitelist remains. Unknown identity, ambiguous catalog mapping, a missing capability or unresolved conditions require a precise explanation. DYD is mechanical; Y Modbus firmware is outside the DYNAMIXEL packet transport. Profile type must match the existing mode; ask the intended RGB/mask color rather than assuming it.

Never use the legacy firmware tool or raw ROS/SDK calls to bypass a rejection. No arbitrary register writes, torque changes, motion, reset/reboot or flashing are exposed by this module. A stale/unknown/uncertain result stops writes and leads to read-only reconciliation after confirmed closure. Default hardware access remains disabled until deliberately configured and authorized. Use mocks when live access is outside the task.
