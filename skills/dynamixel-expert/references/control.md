# Model-specific control explanations

## Current-based position control

Use [XM430-W350 Operating Mode(11)](https://emanual.robotis.com/docs/en/dxl/x/xm430-w350/#operating-mode11) as a named example: value 5 combines position control with current limiting, including extended position operation. Goal Position is the position target; Goal Current bounds current/torque, itself bounded by Current Limit. It does not mean a precise calibrated force sensor or guaranteed contact force: load, gearing, friction and current-to-torque behavior matter. Explain current control (current target) separately from current-based position control (position target with current bound).

Mode transitions can reset gains, limits and profile values; use the exact firmware notes before designing a transition. This plugin explains operating modes but does not write Operating Mode, Goal Current, Goal Position or Torque Enable. Never assume every DYNAMIXEL supports value 5. XL330 current units differ from XM430; resolve model units before computing anything.

## DYNAMIXEL Y cascade

The [YM070-210-M001-RH Operating Mode(33)](https://emanual.robotis.com/docs/en/dxl/y/ym070-210-m001-rh/#operating-mode33) and its [position control diagram](https://emanual.robotis.com/assets/images/dxl/y/operating_mode_3_en.png) show nested position, velocity and current controllers. The position loop produces a limited velocity reference; the velocity loop produces a limited current reference; the current loop drives the inverter through PWM limiting. Feedback closes each loop. Profile generation, electronic gearing, offsets and filters sit around this cascade, so changing a gain is not equivalent to changing a profile.

For that Y model, modes 0/1/3 select current/velocity/position control. Do not call this X-series mode 5. Its velocity/position gain and profile addresses differ from X (for example Y Profile Acceleration/Velocity 240/244, time 248/252 with 0.2 ms units). The Y page has conflicting labels in some detailed rows; consult the table and diagram and flag unresolved discrepancies rather than generating a write. Y tuning and configuration are documentation-only in this release.

For tuning questions, ask plant/load, mechanical limits, control mode, observed symptom and sampling/firmware context. Explain the inner-to-outer dependency qualitatively; do not invent universal gains or run motor experiments. Use the model's current/velocity/position gain, filter, error and profile sections for concrete recommendations.
