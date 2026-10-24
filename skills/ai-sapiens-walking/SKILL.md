---
name: ai-sapiens-walking
description: Prepare AI Sapiens K1 walking policy training with Cyclo Lab or Cyclo MJLab, including environment setup, simulation evaluation and export.
---

# Ai Sapiens Walking

Read [execution boundaries](../../references/execution.md) before preparing commands or changing files. Read [source map](../../references/sources.md) to locate current official manuals. Explicit user instructions take precedence over these workflow guidelines; do not expand authorization from a general learning request. This package supplies guidance and one offline asset audit, not GPU, robot or registry services. The separately gated firmware MCP is not an executor for this learning/deployment workflow.

Help the user go from a walking request to a reproducible training and evaluation plan.

1. If no backend is selected, ask “Cyclo Lab 또는 Cyclo MJLab 중 어느 환경을 사용할까요?” Briefly explain Isaac Lab versus MuJoCo. Preserve a backend already selected. For Cyclo Lab, use PhysX/main by default; discuss experimental Newton only when relevant.
2. Read [training](references/training.md) and the selected backend's live setup and locomotion manual. Establish the actual host/executor, OS, GPU/driver, Docker/Compose, toolkit, free space and isolated project path. Never infer ProArt hardware from its name. Inspect existing files before changes.
3. Produce a scoped preparation plan and exact commands for that checkout. Once authorized, prepare only that environment; installation, downloads, container creation and GPU jobs each need scope appropriate to the current request. For this package's development/evaluation task they are not authorized.
4. Verify submodules, branch/version and available task IDs. Propose the documented example, requested environment count and resource budget. Do not silently start the documented 4096-environment job. For an authorized run, use a real executor and record command, cwd, process/job ID, timestamps, log and checkpoint paths and stopping method per execution boundaries.
5. Evaluate a specific checkpoint in simulation and export it. Pin the selected run instead of relying on “latest”. Inspect falls, stability, velocity tracking and logs; do not invent a reward threshold. Preserve matched policy/config provenance.
6. Deliver preparation results, pending prerequisites, run status, reproducible evaluation command and exported paths. Hand off to Sim2Real preparation only on request.

Examples: “AI Sapiens 보행 policy 학습 시켜줘”; “Use MJLab to evaluate my walking checkpoint”; “Prepare Cyclo Lab on a new workstation.”

Read [coverage and evidence levels](../../references/coverage.md) when describing support. Recheck the current original source using [retrieval rules](../../references/sources.md); report source failures and never equate a prepared command with execution.
