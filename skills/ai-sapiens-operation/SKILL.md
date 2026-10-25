---
name: ai-sapiens-operation
description: Explain AI Sapiens K1 power, battery, RadioMaster RC modes, telemetry and emergency-stop procedures from the official manuals.
---

# Ai Sapiens Operation

Read [execution boundaries](../../references/execution.md) before commands or changes, and [official retrieval](../../references/sources.md) before factual guidance. Fetch only the relevant source and reference; do not load the whole manual. Preserve the user's instructions and authorization. This workflow has no GPU/robot executor or credential store; the separate firmware MCP cannot execute it.

1. Establish explanation versus a requested onsite operation, robot/controller revision and current condition. Read [operation](references/operation.md) for power/battery, or [RC](references/rc.md) for controls and telemetry. Fetch the live matching section before physical steps.
2. For explanation provide the relevant documented flow without pretending to operate the robot. A powered robot, Ready Pose, Damping, E-STOP and power-off are distinct states. Do not infer safety from a switch name or recommend a mode to diagnose unknown hardware.
3. For any later physical operation, require the task's actual authorization, onsite operator, support/clear zone, current manual and emergency-stop access. Do not remotely release E-STOP, request motion, or bypass missing telemetry.
4. On weak/lost link or missing battery telemetry, stop operation guidance at the documented condition and identify what needs onsite inspection. Use diagnostics for logs after verified authorized access.
5. Return the relevant steps, normal indications, stopping conditions and what remains unverified. Source pictures/controller display are authoritative if layout differs. LED code meanings and Operation Guide mode switching are not filled in from guesses.

Examples: “SC와 SB 스위치 차이가 뭐야?”; “NO BATT인데 걸어도 돼?”; “배터리와 전원 순서를 설명해줘.”
