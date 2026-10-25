---
name: cyclo
description: Route ROBOTIS product questions and development tasks to official-source expertise, integration, AI Sapiens workflows or explicitly gated DYNAMIXEL configuration.
---

# Cyclo

Use the [active host adapter](../../references/hosts.md) for Skill invocation and discovered MCP tool identifiers. The shared instructions do not require Codex-specific URIs or tool prefixes.

When invoked for setup, use [first use and first success](../../references/first-run.md). Ask which goal the user wants and complete the relevant safe local check; do not enable hardware or install unrelated dependencies as an onboarding side effect.

Read [execution boundaries](../../references/execution.md) and [firmware module](../../modules/firmware/README.md) before tool use. Existing task restrictions always apply; documentation or a tool being available is not permission to access hardware.

For the broader ROBOTIS portfolio start with [product expert](../robotis-expert/SKILL.md); software integration uses [integration](../robotis-integrate/SKILL.md); actuator explanations and ID/baud/LED/profile requests use [DYNAMIXEL expert](../dynamixel-expert/SKILL.md). The legacy firmware module remains available for its original specific scope and must not bypass new-module refusals.

Classify the goal before selecting tools. For K1 manual facts use [docs](../ai-sapiens-docs/SKILL.md); walking uses [walking](../ai-sapiens-walking/SKILL.md); video/Mimic uses [video](../ai-sapiens-video-mimic/SKILL.md); deployment preparation uses [Sim2Real](../ai-sapiens-sim2real/SKILL.md). Preserve selected backend and ask Cyclo Lab or Cyclo MJLab when a walking request leaves it unknown.

For actuator inspection or the supported XL330 settings/LED workflow use [firmware](../cyclo-firmware/SKILL.md). Firmware MCP is not a policy-training, robot-motion, flashing or deployment engine. GMR/K1 LeRobot/Cyclo Intelligence support remains bounded by the current official pages.

For first use, read [setup and first success](../../references/first-run.md). Respect the current task's device and execution restrictions. Hardware is disabled by default; obtain missing authorization for a specific port/bus and operation before discovery or execution. A read or scan still accesses hardware. Report documentation, mock execution, host invocation and physical runtime evidence separately.
