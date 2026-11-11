# RC mode and telemetry reference

Source: [Using the Remote Controller](https://docs.robotis.com/docs/systems/aisapiens/quick_start_guide/using_remote_controller/), reviewed 2026-10-23. Match the current controller image/display before operation. The table is explanation, not a command to move hardware.

| SC | SB | Meaning |
|---|---|---|
| Up | Any | Damping; can sag, not motor-off/E-STOP |
| Middle | Any | Ready Pose; actively holds |
| Down | Up | Velocity policy |
| Down | Middle | No new request; current mode may continue |
| Down | Down | Selected Mimic |

Operator flow: start SC up, power/check telemetry, then SC middle and wait for Ready Pose before active control. Check UPLINK, DOWNLINK and BATT TELE on TELE; weak/lost links or absent battery telemetry stop operation. NO BATT is missing/stale telemetry, not a measured empty pack. Main-screen Mimic selection uses ENTER/edit, wheel, ENTER/RTN/view. Replay needs a fresh SB transition.

RC E-STOP uses both dedicated switches outward: at least 0.5 seconds activates; at least 3 seconds deactivates only after onsite safety confirmation. Read the displayed gesture guide, never infer switch orientation from an ambiguous photo. Damping is separate from E-STOP, and API heartbeat loss is not emergency damping. Fetch gimbal mapping and detailed link thresholds only if asked. Do not apply this reference as a remote actuation procedure.
