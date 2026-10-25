---
name: dynamixel-expert
description: Explain DYNAMIXEL models and control modes from official manuals, or guide model-aware ID, baud, LED and profile configuration using the explicitly gated product MCP.
---

# DYNAMIXEL expert

For a question such as “전류기반 위치제어 설명해줘” or “DYNAMIXEL Y cascade 제어기 설명해줘”, use [control explanations](references/control.md), fetch the exact model manual as needed and cite it. Do not call port discovery, ping, scan, state or configuration tools for explanation-only requests.

For “연결된 다이나믹셀 ID 바꿔줘”, distinguish ID from baud. Ask the desired new ID and resolve one physical device; do not interpret it as a baud change. Read [first connection and selection](../../references/first-run.md) and [configuration procedure](references/configuration.md) before action. Multiple devices/rates, ambiguous model or unknown firmware require a targeted question, not automatic selection. Discovery itself requires authorization for the selected port/bus; a documentation question does not grant it.

For “프로파일 세팅해줘”, ask intended behavior, exact model/firmware and operating mode, time versus velocity profile, physical units, and application acceleration/velocity limits. Explain zero/infinite settings and profile activation. Produce an explicit plan; do not send a position goal to demonstrate it.

The new MCP provides local `robotis_sources`, `dynamixel_registry`, gated `dynamixel_ports`, bounded `dynamixel_scan`, explicit observed-target `dynamixel_select`, session-state `dynamixel_targets`, and named `dynamixel_configure`. Read [module/runtime boundaries](../../modules/dynamixel/README.md). Only XL330-M288-T firmware 52 and XM430-W350-T/R firmware 42 have curated mock-tested configuration profiles in this release. These firmware selections are a deliberately narrow plugin review policy, not a manufacturer's hardware certification or claim that other firmware lacks the feature. Y, other X models, P/PRO/MX/AX and Protocol 1 actions remain unsupported here; document guidance can still cover their exact manuals.

Never use the legacy firmware tool or raw ROS/SDK calls to bypass a rejection. No arbitrary register writes, torque changes, motion, reset/reboot or flashing are exposed by this module. A stale/unknown/uncertain result stops writes and leads to read-only reconciliation after confirmed closure. Default hardware access remains disabled until deliberately configured and authorized. Use mocks when live access is outside the task.
