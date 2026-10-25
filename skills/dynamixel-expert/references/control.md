# DYNAMIXEL feature questions

Use the same [exact-model evidence workflow](../../../references/dynamixel-evidence.md) for every model. This reference is a topic map, not a universal feature table or a privileged summary for selected motors. Resolve the model/firmware/protocol first, retrieve its source and relevant shared components with their caller props, and cite the actual source. Do not infer support merely because a topic appears below.

| User topic | Evidence to inspect | Common accuracy traps |
| --- | --- | --- |
| Operating modes | Exact mode values, descriptions, transition/reset notes and applicable firmware | Legacy joint/wheel, multi-turn/extended, current, PWM and current-based position modes are not universal or numerically interchangeable |
| Current-based position | Position target, current output bound, Current Limit/Goal Current relationship, position range and mode-reset effects | A current limit is not a calibrated contact-force guarantee; current units and available modes differ |
| Control loops and tuning | Model's position/velocity/current block diagrams, gains, feedforward, filters, bandwidth and limit blocks | Y cascade is not X mode 5; do not transfer gains, register widths or units across families; no universal tuning values |
| Motion profiles | Profile selection bits, acceleration/velocity/time units, operating modes, zero behavior and firmware gates | Read caller overrides and shared defaults together; time duration alone does not guarantee maximum speed; changing mode can reset profile values |
| Direction, homing and calibration | Drive/reverse semantics, Homing Offset, multi-turn persistence, limits and Wizard procedures | Homing Offset is not firmware calibration; calibration can install special firmware and has model exclusions and isolation requirements |
| Identity and communications | Primary ID, secondary/shadow ID, dual-axis identity rules, protocol, baud, return delay and status-return behavior | A secondary ID can address a group without a normal reply; original MX and Protocol-2 firmware remain distinct; a broad compatibility note cannot override a specific table |
| Packet efficiency | Protocol 1/2 instruction support, sync/bulk/fast operations, indirect addressing/data maps, byte order and CRC | SDK support does not establish model support; layouts and indirect regions differ; broadcast replies/errors need the exact protocol contract |
| Watchdog and errors | Bus watchdog timeout, shutdown bits, hardware error/status, torque state and recovery prerequisites | A communication heartbeat is not an emergency-stop or damping guarantee; do not clear faults, reboot or enable torque automatically |
| Telemetry | Present position/velocity/current/load/PWM/temperature/voltage, trajectory, moving flags and tick rollover | Load/current/torque are not equivalent measurements; signed representation, scaling, direction and wrap rules require exact-model evidence |
| Memory and lifecycle | EEPROM/RAM/Hybrid access, torque prerequisites, startup configuration, backup/restore and reset/power-cycle behavior | Read-only firmware/version fields are not settings; persistence/reset effects differ; never copy an address from another family |
| Electrical and mechanical setup | TTL versus RS-485, power/cable compatibility, thermal/duty limits, mounting and ratings | Variants sharing a model family can use different interfaces; stall torque is not continuous rated output |
| Y industrial communication | Exact Protocol Type and bus definitions, available versus future/TBD support, model/revision notes | Do not promise Modbus merely because a value/table heading exists; resolve the actual published status |
| DYD reducers | Gear ratio, rated/peak torque, lubrication, mechanical integration | These three documents describe reducers, not serial actuators; they have no DYNAMIXEL register workflow |

For concise explanations, explain the concept and name the exact model used as an example only after reading its evidence. For comparisons, retrieve both models through the same pipeline; preserve firmware generation and physical variants. Do not rank a model as better documented because it belongs to the executable allowlist.

For register-specific answers retain address, width, access, memory, raw range, signed representation, units/scale, mode/firmware conditions, torque prerequisites, reset effects, persistence and source locations when material. Unknown fields stay unknown. If a conditional component or contradiction is unresolved, give a bounded conceptual explanation and identify the missing evidence rather than issuing exact values or unsupported guarantees.

Documentation questions never need port discovery or actuator access. An explanation does not authorize tuning, calibration, torque, motion, flashing or a register write. The trusted MCP configuration registry remains a separate, narrow execution implementation.
