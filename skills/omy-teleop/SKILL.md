---
name: omy-teleop
description: Use when setting up or troubleshooting OMY-L100 and OMY-F3M Leader-Follower teleoperation, preparing its camera streams, or using OMY keyboard teleoperation.
---

# OMY Teleoperation

Read [execution boundaries](../../references/execution.md), then the relevant teleoperation or keyboard section in [official sources](../omy/references/sources.md). Use OMY-specific instructions; AI Worker A1/A2/LG2 and VR workflows are not compatibility evidence.

1. Establish Leader and Follower separately, installed software and host layout. The reviewed Leader-Follower procedure pairs OMY-L100 with OMY-F3M; verify another pairing against its own source. Do not reverse Leader/Follower roles or select a reverse launch because its filename looks similar. Use [setup](../omy-setup/SKILL.md) for missing physical/network prerequisites.
2. Inspect existing Zenoh, controllers and command publishers. The documented robot-side OpenMANIPULATOR teleoperation launch initializes the Follower, enables Leader gravity compensation and synchronizes them. It may move immediately: validate posture, mounting and clear workspace before authorized startup. If physical packing state is unknown, route to [control](../omy-control/SKILL.md) before launching anything.
3. Keep the camera node on the host physically connected to the camera, normally the user PC in the documented USB-hub arrangement. Verify its container's Zenoh route and image topics before recording. A configured recording topic does not start a camera node.
4. For keyboard input, use the installed model's robot-control guide and confirm whether the target is simulation or hardware. Determine joint/gripper bindings and command semantics from that revision. Do not assume the 3M has the F3M gripper.
5. Before physical engagement, verify feedback, applicable release/stop behavior and an onsite operator's reachable stop control. Do not invent deadman/watchdog guarantees. Stop on stale input or unexpected movement; report host, processes, pairing and observed behavior.
6. For recording, hand off to [learning](../omy-learning/SKILL.md) after camera/control readiness. For inference, stop Leader-Follower teleoperation and confirm it no longer commands the arm before starting the matching Follower-only bringup. That transition can also move hardware and needs its own concrete actuation scope.

Examples: "Prepare L100/F3M demonstrations"; "Check OMY keyboard teleop in simulation."
