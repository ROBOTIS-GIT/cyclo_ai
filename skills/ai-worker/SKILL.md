---
name: ai-worker
description: Use when asking about ROBOTIS AI Worker or FFW models, official manuals, specifications, supported workflows, or which AI Worker task skill to use.
---

# AI Worker

Use [official sources and evidence rules](references/sources.md) for product questions. Retrieve only the relevant live manual sections; a source link is not reviewed content. Answer in the user's language with exact citations and version limits. Do not contact a robot for an explanation.

Identify the Follower model and revision when they affect the answer. Keep BG2, SG2, BH5, SH5, F1 and F2 procedures distinct; do not infer the model from a sample launch command. The Leader is a separate input device. Ask only for missing details needed for the next decision.

Route by requested outcome:

- Installation, SSH, network, Docker, Cyclo Manager or external-PC Zenoh: [setup](../ai-worker-setup/SKILL.md).
- ROS 2 bringup, controller status, joint interfaces, Cyclo Control or motion commands: [control](../ai-worker-control/SKILL.md).
- A1/A2/LG2 Leader or VR operation: [teleoperation](../ai-worker-teleop/SKILL.md).
- Demonstration recording, dataset conversion, training, evaluation or policy inference: [learning](../ai-worker-learning/SKILL.md).
- DHI implementation, ros2_control lifecycle or TableSync: [ROBOTIS integration](../robotis-integrate/SKILL.md).
- Individual actuator Control Tables: [DYNAMIXEL expert](../dynamixel-expert/SKILL.md).

For a full workflow, follow setup, control readiness, teleoperation, then learning; resume at the user's current stage rather than reinstalling completed stages. Fetch the platform's own simulation/navigation manual when requested. K1 walking, GEM-X/Mimic and K1 Sim2Real procedures do not establish AI Worker support.

Read [execution boundaries](../../references/execution.md) before commands or changes. This package provides instructions and local source analysis, not an AI Worker executor, training service or credentials. Report prepared commands, observed execution and remaining prerequisites separately.

Examples: "Which AI Worker model is this?"; "Help me go from F2 setup to demonstration learning."
