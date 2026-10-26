---
name: robotis-expert
description: Answer ROBOTIS product, software, compatibility and troubleshooting questions from official sources, including products outside the existing task-specific Cyclo workflows.
---

# ROBOTIS product expert

Cyclo is ROBOTIS's Physical AI brand. Start from the user's task and exact product, not from the list of example products in this package. For explanations, never discover ports or contact devices.

Use [source and coverage inventory](../../references/robotis-sources.json) or the local-metadata `robotis_sources` MCP tool when available. Its results are routes, not retrieved document contents. Read [retrieval and evidence rules](references/retrieval.md) before answering unfamiliar or changing facts. Use the host's existing web/search tools to fetch the exact official page; this plugin does not install a remote documentation MCP. If tools or pages are unavailable, explain the missing evidence and limit the answer to reviewed local references.

Route by task:

- Actuator modes, control tables, IDs, baud, LEDs, profiles: [DYNAMIXEL expert](../dynamixel-expert/SKILL.md).
- ROS 2, ros2_control, SDK, Zenoh, installation or integration failures: [integration](../robotis-integrate/SKILL.md).
- K1 manual, RC, operation, connectivity, impedance: [AI Sapiens docs](../ai-sapiens-docs/SKILL.md) and its task skills.
- Training, video and deployment: preserve [walking](../ai-sapiens-walking/SKILL.md), [video/Mimic](../ai-sapiens-video-mimic/SKILL.md), [Sim2Real](../ai-sapiens-sim2real/SKILL.md). Ask Cyclo Lab or Cyclo MJLab when unspecified.
- Other platforms, hands, controllers, interfaces, education kits and legacy software: [portfolio workflow](references/portfolio.md); fetch their own manual before proposing a procedure.

Answer in the user's language. Cite exact model/version pages near claims. Separate documented behavior, inferred troubleshooting, mock-tested implementation and physical runtime evidence. No claim of universal product knowledge or compatibility follows from a catalog entry. Preserve the current task's restrictions and authorization. Hardware tools are available by default; explanation and model-selection questions need no device access.

Examples: “What is the difference between OMY and OMX?”, “Which software should I use with this older CM controller?”, “Help me choose Cyclo Lab or Cyclo MJLab”, “Can you guide me with this product too?”
