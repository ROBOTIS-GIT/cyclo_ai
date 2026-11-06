---
name: omy
description: Use when asking about ROBOTIS OMY models, specifications, official manuals, supported workflows, or which OMY setup, control, teleoperation or learning skill to use.
---

# OMY

Use [official sources and evidence rules](references/sources.md) to retrieve the relevant live OMY manual. Answer in the user's language with direct citations and revision limits. Documentation questions do not require robot access.

Identify the actual model and software revision when they affect the answer. OMY-L100 is the Leader; OMY-F3M is the gripper/camera Follower; OMY-3M has a different end-effector configuration. OMY-AI3M denotes the Leader/Follower set. Do not treat these names as interchangeable or substitute OMX/OpenMANIPULATOR-X procedures.

Route by task:

- Installation, physical connections, SSH, Docker, Cyclo Manager or external-PC Zenoh: [setup](../omy-setup/SKILL.md).
- ROS 2 state/controller diagnosis, standalone bringup, MoveIt, GUI or Cyclo Control: [control](../omy-control/SKILL.md).
- OMY-L100/F3M Leader-Follower or keyboard operation: [teleoperation](../omy-teleop/SKILL.md).
- Demonstration recording, dataset processing, training or policy inference: [learning](../omy-learning/SKILL.md).
- DHI/ros2_control implementation or product register traces: [ROBOTIS integration](../robotis-integrate/SKILL.md).
- Individual actuator Control Tables: [DYNAMIXEL expert](../dynamixel-expert/SKILL.md); distinguish these from OMY system registers.

Follow the user's current stage; do not reinstall completed stages. Use OMY's own simulation pages for simulation requests. AI Worker VR, FFW robot configs and K1 walking/Mimic/Sim2Real do not establish OMY compatibility.

Read [execution boundaries](../../references/execution.md) before commands or changes. This package supplies guidance and local analysis, not a robot executor or training service. Distinguish documented steps, prepared commands and observed runtime results.

Examples: "Explain OMY-F3M versus OMY-3M"; "Prepare my OMY demonstration-learning workflow."
