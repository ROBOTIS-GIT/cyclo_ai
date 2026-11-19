# Skill catalog

Start with `$cyclo` in Codex or `/cyclo-ai:cyclo` in Claude Code. Cyclo routes your request to the relevant product or task skill. The names below use Codex syntax; see [host setup](hosts.md) for Claude Code invocation.

These skills provide official-source guidance and workflow preparation. Device access and robot or training execution depend on the local environment and the requested operation.

| Skill | Purpose |
| --- | --- |
| [`$ai-sapiens-connectivity`](../skills/ai-sapiens-connectivity/SKILL.md) | Prepare AI Sapiens K1 USB, Ethernet, Wi-Fi AP/STA and verified SSH connection plans without changing network settings implicitly. |
| [`$ai-sapiens-control`](../skills/ai-sapiens-control/SKILL.md) | Explain AI Sapiens K1 impedance and ROS 2 interfaces, prepare external-PC Zenoh communication or bounded read-only Python joint-state collection. |
| [`$ai-sapiens-diagnostics`](../skills/ai-sapiens-diagnostics/SKILL.md) | Inspect AI Sapiens K1 development prerequisites, cycloctl service status and logs, or route ROS 2 and Python SDK troubleshooting to official manuals. |
| [`$ai-sapiens-docs`](../skills/ai-sapiens-docs/SKILL.md) | Find and explain the official AI Sapiens K1 manual, hardware and electrical specifications, software architecture, feature availability and development workflow choices. |
| [`$ai-sapiens-motion-sources`](../skills/ai-sapiens-motion-sources/SKILL.md) | Prepare AI Sapiens source motions from Kimodo text generation or SOMA-X human-model conversion before Soma-retargeter and Mimic training. |
| [`$ai-sapiens-operation`](../skills/ai-sapiens-operation/SKILL.md) | Explain AI Sapiens K1 power, battery, RadioMaster RC modes, telemetry and emergency-stop procedures from the official manuals. |
| [`$ai-sapiens-sim2real`](../skills/ai-sapiens-sim2real/SKILL.md) | Prepare and review AI Sapiens K1 Sim2Real policy assets and robot identity from a serial number, or validate the deployment in MuJoCo Sim2Sim. |
| [`$ai-sapiens-video-mimic`](../skills/ai-sapiens-video-mimic/SKILL.md) | Prepare AI Sapiens motion imitation from video or SOMA motion using ROBOTIS GEM-X, Soma-retargeter and Cyclo Mimic training. |
| [`$ai-sapiens-walking`](../skills/ai-sapiens-walking/SKILL.md) | Prepare AI Sapiens K1 walking policy training with Cyclo Lab or Cyclo MJLab, including environment setup, simulation evaluation and export. |
| [`$ai-worker`](../skills/ai-worker/SKILL.md) | Use when asking about ROBOTIS AI Worker or FFW models, official manuals, specifications, supported workflows, or which AI Worker task skill to use. |
| [`$ai-worker-control`](../skills/ai-worker-control/SKILL.md) | Use when inspecting AI Worker ROS 2 controllers or joint state, preparing bringup, diagnosing control readiness, or using Cyclo Control joint and Cartesian commands. |
| [`$ai-worker-learning`](../skills/ai-worker-learning/SKILL.md) | Use when collecting AI Worker demonstrations, reviewing or converting datasets, training imitation policies, evaluating checkpoints, or preparing model inference with Cyclo Intelligence. |
| [`$ai-worker-setup`](../skills/ai-worker-setup/SKILL.md) | Use when installing ROBOTIS AI Worker software, connecting by network or SSH, setting up Docker or Cyclo Manager, or configuring external-PC Zenoh communication. |
| [`$ai-worker-teleop`](../skills/ai-worker-teleop/SKILL.md) | Use when setting up or troubleshooting AI Worker teleoperation with an A1, A2 or LG2 Leader, or a VR headset and ROBOTIS Vuer. |
| [`$cyclo`](../skills/cyclo/SKILL.md) | Route ROBOTIS product questions and development tasks to official-source expertise, integration, OMY, OMX, AI Worker and AI Sapiens workflows or catalog/custom DYNAMIXEL Control Table operations. |
| [`$dynamixel-expert`](../skills/dynamixel-expert/SKILL.md) | Explain and operate catalog or custom DYNAMIXEL devices using official or user-supplied Control Tables, with source-resolved discovery, reads and writes through a compatible executor. |
| [`$omx`](../skills/omx/SKILL.md) | Use when asking about ROBOTIS OMX models, specifications, official manuals, ROS 2 versus native LeRobot workflows, or which OMX task skill to use. |
| [`$omx-control`](../skills/omx-control/SKILL.md) | Use when diagnosing OMX ROS 2 controllers or joint state, preparing standalone bringup, or using OMX MoveIt 2, GUI and Cyclo Control motion interfaces. |
| [`$omx-learning`](../skills/omx-learning/SKILL.md) | Use when collecting OMX demonstrations, reviewing or converting datasets, training imitation policies, evaluating checkpoints, or preparing Cyclo Intelligence or native LeRobot inference. |
| [`$omx-setup`](../skills/omx-setup/SKILL.md) | Use when assembling OMX, identifying Leader and Follower USB ports, installing native LeRobot or OpenMANIPULATOR ROS 2, or configuring OMX Docker, Cyclo Manager or Zenoh. |
| [`$omx-teleop`](../skills/omx-teleop/SKILL.md) | Use when setting up or troubleshooting OMX-L and OMX-F teleoperation through ROS 2 or native LeRobot, or preparing OMX keyboard operation and camera input. |
| [`$omy`](../skills/omy/SKILL.md) | Use when asking about ROBOTIS OMY models, specifications, official manuals, supported workflows, or which OMY setup, control, teleoperation or learning skill to use. |
| [`$omy-control`](../skills/omy-control/SKILL.md) | Use when diagnosing OMY ROS 2 controller or joint state, preparing standalone bringup, packing or unpacking, or using MoveIt 2, the GUI or Cyclo Control motion interfaces. |
| [`$omy-learning`](../skills/omy-learning/SKILL.md) | Use when collecting OMY demonstrations, reviewing or converting datasets, training imitation policies, evaluating checkpoints, or preparing Cyclo Intelligence model inference for OMY. |
| [`$omy-setup`](../skills/omy-setup/SKILL.md) | Use when installing OMY software, identifying hardware and camera connections, preparing SSH or Docker access, setting up Cyclo Manager, or connecting an external PC through Zenoh. |
| [`$omy-teleop`](../skills/omy-teleop/SKILL.md) | Use when setting up or troubleshooting OMY-L100 and OMY-F3M Leader-Follower teleoperation, preparing its camera streams, or using OMY keyboard teleoperation. |
| [`$robotis-expert`](../skills/robotis-expert/SKILL.md) | Answer ROBOTIS product, software, compatibility and troubleshooting questions from official sources, including products outside the existing task-specific Cyclo workflows. |
| [`$robotis-integrate`](../skills/robotis-integrate/SKILL.md) | Trace ROBOTIS product configurations and DYNAMIXEL Hardware Interface implementation across ROS 2 lifecycle, controllers, units, bus behavior and TableSync, plus SDK, Zenoh and Cyclo integration troubleshooting with exact source/version evidence. |
