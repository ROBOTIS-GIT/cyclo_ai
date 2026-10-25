---
name: ai-sapiens-diagnostics
description: Inspect AI Sapiens K1 development prerequisites, cycloctl service status and logs, or route ROS 2 and Python SDK troubleshooting to official manuals.
---

# Ai Sapiens Diagnostics

Read [execution boundaries](../../references/execution.md) before preparing commands or changing files. Read [source map](../../references/sources.md) to locate current official manuals. Explicit user instructions take precedence over these workflow guidelines; do not expand authorization from a general learning request. This package supplies guidance and one offline asset audit, not GPU, robot or registry services. The separately gated firmware MCP is not an executor for this learning/deployment workflow.

Diagnose a specific development problem with the smallest relevant read-only checks.

1. Read [diagnostics](references/diagnostics.md) and execution boundaries. Identify workstation versus robot SBC versus container, exact checkout/version, expected behavior, observed error and last successful step. Collect only relevant logs; redact secrets and network details before sharing.
2. For setup failures, inspect driver/toolkit/Docker compatibility and submodule/LFS status before reinstalling. For motion issues, check repo cwd, Python version, input schema, matching model and missing meshes. For training/export errors, confirm backend, task registration and exact checkpoint.
3. For robot services, verify identity and authorized access first. cycloctl must run on the robot because it uses cyclod's local Unix socket. Start with service status and documented logs; interpret actual output and distinguish service down, feedback missing, RC missing and asset/config mismatch. Do not restart services, switch Wi-Fi, start controllers or change ROS/network settings without scope.
4. For ROS 2 topics or Python SDK, read the exact current official page and installed CLI/API help before proposing code. Topic publishing or SDK control can actuate the robot. Do not invent generic operational endpoints or equate a ROS subscriber with a safe motor-control test.
5. Return a grounded cause or ranked hypotheses, supporting observations, smallest corrective plan, checks after the fix and rollback for changes. If access is absent, provide an operator-run read-only checklist and mark it unexecuted.

Examples: “Check cycloctl status and logs”; “The retarget viewer is missing STL files”; “Explain the K1 ROS 2 topics before I write control code.”

Read [coverage and evidence levels](../../references/coverage.md) when describing support. Recheck the current original source using [retrieval rules](../../references/sources.md); report source failures and never equate a prepared command with execution.
