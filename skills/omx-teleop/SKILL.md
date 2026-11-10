---
name: omx-teleop
description: Use when setting up or troubleshooting OMX-L and OMX-F teleoperation through ROS 2 or native LeRobot, or preparing OMX keyboard operation and camera input.
---

# OMX Teleoperation

Read [execution boundaries](../../references/execution.md), then the chosen ROS teleoperation/robot-control or native LeRobot section in [official sources](../omx/references/sources.md). Preserve the selected stack; do not combine their launch commands or serial ownership.

1. Establish OMX-L Leader and OMX-F Follower identities independently, installed revision, host and actual role-to-port mapping. Use [setup](../omx-setup/SKILL.md) for missing prerequisites. Tty order and copied sample aliases do not establish identity. Preserve factory IDs/offsets instead of routine calibration.
2. For ROS Leader-Follower use the installed OMX AI launch, which initializes and synchronizes the arms and can move immediately. Check current posture, clear workspace, existing Zenoh and command sources before authorized startup. This mode does not provide MoveIt/GUI/keyboard control; those use standalone bringup via [control](../omx-control/SKILL.md).
3. For native LeRobot use the OMX hardware guide's driver types, verified ports and optional camera configuration. Confirm the installed release recognizes the selected options before preparing a command. Generic SO-101 examples are not OMX commands. Native teleoperation does not need ROS/Zenoh. If a calibration prompt conflicts with the OMX factory workflow, stop and inspect driver/version/configuration rather than accepting a generic recalibration.
4. For ROS keyboard input, retrieve the installed model's bindings and select simulation versus hardware explicitly. For either stack, configure cameras on their actual host, verify supported device/settings and image visibility, and use the matching stack's camera pipeline. Do not assume a recorded topic or configured camera is running.
5. Before physical operation, verify feedback, bounded initial movement, onsite operator and reachable stop/release method. Inspect documented tracking-loss behavior rather than promising a watchdog. Stop on stale input or unexpected motion.
6. Hand recording to [learning](../omx-learning/SKILL.md) after readiness checks. Before inference, stop teleoperation and verify exclusive command ownership. ROS inference needs the matching Follower-only bringup; native evaluation needs the selected native driver. Do not leave both stacks connected to the same bus.

Report stack, pairing, ports, camera mapping, prepared commands and actual results separately.
