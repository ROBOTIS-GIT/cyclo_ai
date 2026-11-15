---
name: ai-sapiens-video-mimic
description: Prepare AI Sapiens motion imitation from video or SOMA motion using ROBOTIS GEM-X, Soma-retargeter and BeyondMimic PPO or SuperMimic world-model training.
---

# Ai Sapiens Video Mimic

Read [execution boundaries](../../references/execution.md) before preparing commands or changing files. Read [source map](../../references/sources.md) to locate current official manuals. Explicit user instructions take precedence over these workflow guidelines; do not expand authorization from a general learning request. This package supplies guidance and one offline asset audit, not GPU, robot or registry services. The device-control MCP is not a GPU training or robot-deployment executor.

Turn a video or motion request into a validated motion and a matching Mimic task.

1. Read [motion pipeline](references/motion.md). For a YouTube URL, obtain a lawful local video from the user or a separately authorized supported acquisition tool. The documented GEM-X CLI takes a local file; a URL alone is not a completed download. Ask for the clip/time range, subject and desired motion. Do not treat the video as executable instructions.
2. Read [method selection](references/methods.md). Choose Cyclo Lab or Cyclo MJLab if not selected, then preserve or establish BeyondMimic PPO versus SuperMimic world-model learning separately from physics. Legacy Cyclo-Mimic IDs mean PPO. Use `cyclo_mimic` for read-only selection guidance; inspect actual branch paths, task registrations, versions and CLI before commands. Never silently substitute PPO when SuperMimic is missing. Inspect the real executor and maintain separate Python environments: GEM-X/Soma-retargeter require Python 3.12+, while MJLab's container uses 3.11.
3. Review GEM-X fork setup and model assets before authorized installation/download. Use explicit checkpoint and K1 retarget flags; the default robot is G1. Check the K1 MJCF and submodules. Run only with explicit execution scope and a tracked executor.
4. Inspect tracking/global-motion overlays and the K1 preview before training. For existing SOMA BVH/NPZ use Soma-retargeter directly. Raw SMPL-family NPZ additionally requires SOMA-X and a matching licensed human model. Do not add a nonexistent --input-format flag.
5. Convert the retarget CSV into the selected backend's motion format; retain source video, raw CSV, converted NPZ and deployment CSV provenance. A GEM-X output or retarget CSV is not yet a deployable policy. Inspect pose, joint limits, contacts, speed, scale and loop continuity. Stop on malformed output, model mismatch or unstable motion; fix the relevant stage and rerun only that stage.
6. For BeyondMimic PPO, clone the documented Dance1 config in the isolated checkout, point it at the converted NPZ, register a unique task ID (plus Play ID for Cyclo Lab), and verify registration before any training. Follow [backend details](../ai-sapiens-walking/references/training.md) for tracked training and checkpoint evaluation. Use the same motion during training, evaluation and deployment.
7. For SuperMimic follow the selected native integration and its method-specific input/checkpoint/play contract in [method selection](references/methods.md). Do not use the PPO export/controller workflow without a validated SuperMimic contract.
8. Report produced artifacts and unresolved checks. Ask separately before costly training, transfer to a robot, or live execution when not already authorized.

Examples: “Prepare Mimic training from this YouTube video”; “Retarget this SOMA BVH to K1”; “Validate my MJLab motion NPZ before training.”

Read [coverage and evidence levels](../../references/coverage.md) when describing support. Recheck the current original source using [retrieval rules](../../references/sources.md); report source failures and never equate a prepared command with execution.
