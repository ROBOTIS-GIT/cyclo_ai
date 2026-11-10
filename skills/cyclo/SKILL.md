---
name: cyclo
description: Route ROBOTIS product questions and development tasks to official-source expertise, integration, OMY, OMX, AI Worker and AI Sapiens workflows or catalog/custom DYNAMIXEL Control Table operations.
---

# Cyclo

For OMX requests use [OMX](../omx/SKILL.md): [assembly, USB and software setup](../omx-setup/SKILL.md), [ROS 2 control](../omx-control/SKILL.md), [teleoperation](../omx-teleop/SKILL.md), or [learning](../omx-learning/SKILL.md). Preserve the chosen ROS 2/Cyclo Intelligence or native LeRobot path; native-only work does not require ROS setup.

For OMY requests use [OMY](../omy/SKILL.md): [installation and connections](../omy-setup/SKILL.md), [ROS 2 control](../omy-control/SKILL.md), [Leader-Follower/keyboard teleoperation](../omy-teleop/SKILL.md), or [demonstration learning](../omy-learning/SKILL.md). Select OMY's own model and procedure rather than borrowing another product's commands.

For AI Worker/FFW requests use [AI Worker](../ai-worker/SKILL.md): [installation and connections](../ai-worker-setup/SKILL.md), [ROS 2 control](../ai-worker-control/SKILL.md), [Leader/VR teleoperation](../ai-worker-teleop/SKILL.md), or [demonstration learning](../ai-worker-learning/SKILL.md). Keep these separate from the K1 workflows below.

Use the [active host adapter](../../references/hosts.md) for Skill invocation and discovered MCP tool identifiers. The shared instructions do not require Codex-specific URIs or tool prefixes.

When invoked for setup, use [first use and first success](../../references/first-run.md). Ask which goal the user wants and complete the relevant safe local check; do not enable hardware or install unrelated dependencies as an onboarding side effect.

Read [execution boundaries](../../references/execution.md) and [device runtime](../../modules/dynamixel/README.md) before tool use. Existing task restrictions always apply; documentation or a tool being available is not permission to access hardware.

For the broader ROBOTIS portfolio start with [product expert](../robotis-expert/SKILL.md); software integration uses [integration](../robotis-integrate/SKILL.md); actuator explanations and Control Table, motor-control and ID/baud/LED/profile requests use [DYNAMIXEL expert](../dynamixel-expert/SKILL.md). Custom/unindexed actuators and user-supplied XML/register tables also use that skill and its [external-table workflow](../../references/custom-control-tables.md). Use the standalone product MCP for catalog and reviewed custom-table operations; do not bypass explicit policy denials or failed live preconditions.

Classify the goal before selecting tools. For K1 manual facts use [docs](../ai-sapiens-docs/SKILL.md); walking uses [walking](../ai-sapiens-walking/SKILL.md); video/Mimic uses [video](../ai-sapiens-video-mimic/SKILL.md); deployment preparation uses [Sim2Real](../ai-sapiens-sim2real/SKILL.md). Preserve selected backend and ask Cyclo Lab or Cyclo MJLab when a walking request leaves it unknown.

Actuator inspection, Return Delay Time, baud, LED, torque, mode, goals and other resolved Control Table items use the product MCP. Reset/reboot/flashing are separate protocol workflows and are not inferred from register requests. GMR/K1 LeRobot/Cyclo Intelligence support remains bounded by the current official pages.

For first use, read [setup and first success](../../references/first-run.md). Respect the current task's device and execution restrictions. Hardware tools are available by default; obtain missing authorization for a specific port/bus and operation before discovery or execution. A read or scan still accesses hardware. Report documentation, mock execution, host invocation and physical runtime evidence separately.
