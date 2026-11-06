---
name: omx-control
description: Use when diagnosing OMX ROS 2 controllers or joint state, preparing standalone bringup, or using OMX MoveIt 2, GUI and Cyclo Control motion interfaces.
---

# OMX Control

Read [execution boundaries](../../references/execution.md) and the relevant ROS control/bringup pages in [official sources](../omx/references/sources.md). Native LeRobot operator control belongs to [teleoperation](../omx-teleop/SKILL.md); policy execution belongs to [learning](../omx-learning/SKILL.md).

1. Establish OMX model/role, installed checkout, host, verified Follower USB identity and mode: supplied-only diagnosis, existing live state, mock/simulation or physical motion. Do not replace a selected native stack with ROS to answer a configuration question.
2. For supplied-only analysis, read YAML/URDF/launch/log artifacts without SSH, USB scanning, ROS graph queries, launch execution or controller activation. Treat launch/xacro as code, not passive configuration. Use [ROBOTIS integration](../robotis-integrate/SKILL.md) for offline mapping and DHI traces; declared controllers do not prove runtime activation.
3. On an authorized existing graph, inspect RMW/domain/Zenoh, actual controller-manager namespace, lifecycle/claims, joint and gripper interfaces and bounded feedback. Derive identifiers from actual files/graph. Do not start services or torque merely to diagnose missing state.
4. Choose the correct operating mode. ROS Leader-Follower teleoperation does not support MoveIt/GUI/keyboard operation; use the documented standalone control bringup for those. Cyclo Control and policy inference use the matching Follower-only path. Stop incompatible command sources and check serial ownership before transitions. Never start native LeRobot against a ROS-owned bus.
5. Inspect initialization settings and current posture before bringup. Homing/GUI poses/Execute can move the arm immediately; a product homing claim is not workspace validation. Do not apply OMY's packed-only unpack script to OMX. For motion, verify installed frame, units, joint/gripper ordering, limits and duration semantics, then prepare a bounded target through the selected control layer.
6. Physical motion needs concrete authorization, an onsite operator and verified stopping behavior. Observe feedback/logs and stop on unexpected movement or stale state. Collision filtering and simulation are separate from physical acceptance; do not bypass the control layer with raw actuator writes.

Report static findings, prepared commands and observed execution separately.
