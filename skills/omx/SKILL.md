---
name: omx
description: Use when asking about ROBOTIS OMX models, specifications, official manuals, ROS 2 versus native LeRobot workflows, or which OMX task skill to use.
---

# OMX

Retrieve the relevant current sections through [official sources and evidence rules](references/sources.md). Answer in the user's language with direct citations and revision limits. Explanation-only requests do not require USB discovery or robot access.

Distinguish OMX-L Leader, OMX-F Follower and OMX-AI set. Do not confuse OMX with OMY or OpenMANIPULATOR-X. Factory-preconfigured IDs and offsets are not a request for generic actuator setup or recalibration.

Route by task:

- Assembly, USB roles, installation, Docker, Cyclo Manager or ROS network: [setup](../omx-setup/SKILL.md).
- ROS 2 controller/joint-state diagnosis, standalone MoveIt/GUI or Cyclo Control: [control](../omx-control/SKILL.md).
- Leader-Follower, native LeRobot operator input or ROS keyboard teleoperation: [teleoperation](../omx-teleop/SKILL.md).
- Demonstration recording, datasets, training or policy inference: [learning](../omx-learning/SKILL.md).
- DHI/ros2_control implementation: [ROBOTIS integration](../robotis-integrate/SKILL.md).
- Individual actuator Control Tables: [DYNAMIXEL expert](../dynamixel-expert/SKILL.md), preserving actual identity and existing setup.

Preserve the selected stack. Native LeRobot-only setup does not require OpenMANIPULATOR ROS 2/Docker/Zenoh. For ROS 2/Cyclo Intelligence, follow OMX's own ROS setup. If the stack is unknown and changes the next installation or command, explain these alternatives and obtain the missing preference; do not ask for it merely to answer a specification question. Resume at the user's current stage.

Use the OMX simulation manual for simulation requests. OMY unpacking, AI Worker VR/FFW configs and K1 walking/Mimic workflows do not establish OMX compatibility.

Read [execution boundaries](../../references/execution.md) before commands or changes. These skills supply guidance, not USB access, a training executor or physical acceptance evidence. Distinguish prepared steps from observed results.
