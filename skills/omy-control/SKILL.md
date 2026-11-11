---
name: omy-control
description: Use when diagnosing OMY ROS 2 controller or joint state, preparing standalone bringup, packing or unpacking, or using MoveIt 2, the GUI or Cyclo Control motion interfaces.
---

# OMY Control

Read [execution boundaries](../../references/execution.md). Retrieve the relevant setup, bringup, robot-control or Cyclo Control section through [official sources](../omy/references/sources.md).

1. Identify model/revision, installed checkout, requested control layer and execution mode: supplied-only diagnosis, existing live state, mock/simulation or physical motion. Keep OMY-3M and F3M end-effectors, descriptions and launch files distinct.
2. For supplied-only diagnosis, inspect files/logs without SSH, ROS graph queries, launch execution or controller activation. Use [ROBOTIS integration](../robotis-integrate/SKILL.md) for offline configuration inspection and DHI source traces. Treat user-supplied launch/xacro as code; do not execute it merely to read its structure. Static declarations do not prove active controllers.
3. On an authorized existing ROS graph, inspect Zenoh/RMW/domain, actual controller-manager namespace, lifecycle states, claimed interfaces, joint names and bounded feedback. Derive identifiers from the user's configuration/graph. Do not start services or enable torque just to diagnose missing state.
4. Before any startup/packing/unpacking, establish physical posture, support and clearance, exact model-specific launch and initialization settings. The unpack procedure is only for the documented packed posture; stop when posture/applicability is uncertain. Bringup and GUI initial/home/execute controls can move hardware. Keep planning separate from execution and inspect existing command sources before starting another controller.
5. For MoveIt or Cyclo Control, verify installed packages, frames, units, joint order, gripper availability, limits and duration semantics. Resolve conflicting manual package examples against the checkout. Prepare a bounded target using the selected control layer; do not bypass it with raw actuator writes or assume collision filtering guarantees safety.
6. Execute physical movement only with concrete authorization, an onsite operator and a verified stopping method. Observe feedback/logs and stop on unexpected motion or stale feedback. Report simulation, prepared commands and observed movement separately.

Use [teleoperation](../omy-teleop/SKILL.md) for operator input and [learning](../omy-learning/SKILL.md) for policy inference. Those command sources must not run concurrently against the same Follower.
