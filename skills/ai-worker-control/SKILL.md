---
name: ai-worker-control
description: Use when inspecting AI Worker ROS 2 controllers or joint state, preparing bringup, diagnosing control readiness, or using Cyclo Control joint and Cartesian commands.
---

# AI Worker Control

Read [execution boundaries](../../references/execution.md), then retrieve the relevant bringup/Cyclo Control pages from [official sources](../ai-worker/references/sources.md). Preserve existing task authorization; local configuration analysis does not require robot access.

1. Identify the actual Follower model/revision, software checkout, execution host and requested mode: existing-state diagnosis, simulation/mock hardware or physical control. For missing network discovery use [setup](../ai-worker-setup/SKILL.md).
2. For diagnosis, inspect supplied launch arguments, logs, robot description and controller configuration first. On an authorized running ROS graph, inspect RMW, domain, Zenoh reachability, controller-manager namespace, lifecycle states, hardware interfaces, joint names and bounded joint feedback. Derive names from the actual graph/configuration; do not invent a universal AI Worker controller or topic. Do not start services or enable torque to obtain status.
3. For bringup, use the selected model's current launch or Manager settings. Check existing services, Zenoh, port selection, sensor settings, mock/simulation mode and initialization arguments before launch. Initial-position options can move the robot during startup. Confirm the intended pose and physical-operation scope before starting it; simulation success is separate evidence.
4. For Cyclo Control, match the actual Follower model and installed interfaces. Read the relevant Cartesian, joint or bimanual section and source definitions for units, frames, joint order, timing and command semantics. Validate feedback and controller claims before preparing a bounded command. Do not bypass the active control layer with raw actuator writes. Collision filtering is not a guarantee of safe motion around people or obstacles.
5. Live actuation needs the concrete robot, bounded target, onsite operator and verified stopping method. After authorized execution, inspect actual feedback and logs; stop on stale state or unexpected movement. Never describe a prepared command as a successful motion.

Use [ROBOTIS integration](../robotis-integrate/SKILL.md) for DHI lifecycle/TableSync or source-level faults. Hand operator input to [teleoperation](../ai-worker-teleop/SKILL.md) and policy execution to [learning](../ai-worker-learning/SKILL.md).

Example: "Check my F1 controller status before any movement."
