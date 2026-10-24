---
name: ai-sapiens-sim2real
description: Prepare and review AI Sapiens K1 Sim2Real policy assets and robot identity from a serial number, or validate the deployment in MuJoCo Sim2Sim.
---

# Ai Sapiens Sim2Real

Read [execution boundaries](../../references/execution.md) before preparing commands or changing files. Read [source map](../../references/sources.md) to locate current official manuals. Explicit user instructions take precedence over these workflow guidelines; do not expand authorization from a general learning request. This package supplies guidance and one offline asset audit, not GPU, robot or registry services. The separately gated firmware MCP is not an executor for this learning/deployment workflow.

Prepare a concrete, reviewable deployment without confusing file installation with motor execution.

1. Read [deployment](references/deployment.md). Collect backend/run, velocity or mimic mode, exported asset paths, target robot/revision and requested scope: local staging, robot file transfer, or live operation. A serial number does not authorize connection or motion by itself.
2. Audit the export locally with [asset_audit.py](scripts/asset_audit.py). Require policy.onnx and sim2real.yaml from one run; require a deployment motion CSV for Mimic. This helper checks layout/hashes only. If an original export record exists, read [manifest consistency](references/provenance.md) and use --provenance to compare bytes/metadata with it; an unsigned record does not prove provenance or validate ONNX semantics/robot compatibility.
3. Review policy_joints, controller robot_joint_order, observations/order, action scaling/offset/clipping, dimensions, control rates and Mimic reference/FPS/window against the checked-out runtime. Do not declare compatibility from matching filenames or a passing helper.
4. For a serial request, follow the manual's mDNS hostname convention only after rechecking the SSH guide. Resolve on the actual reachable host/network; verify SSH host key through trusted evidence, configured authentication, and robot identity/revision via operator label and authorized inventory. Do not infer credentials or disable host-key verification. If discovery or identity fails, stop target actions and request the actual reachable endpoint or trusted inventory. No automatic registry is bundled.
5. Stage a new named asset and minimal config diff. Preserve original policy, configs, RC selector mappings, transitions and failsafes. Capture hashes, backup destination and exact restore/restart plan. Use a fresh folder; never overwrite an existing asset silently.
6. Prefer validating that staged config in a separate MuJoCo Sim2Sim checkout with explicit --sim. Check Damping, ReadyPose, assigned policy/mimic mode, feedback and failsafe behavior. No real robot connection is needed for this simulation.
7. Before any authorized file transfer, present target, destinations, checksums, backup, compatibility evidence and rollback. Verify transferred bytes and config separately. A successful transfer is only “files staged”.
8. Live control is a separate authorization gate requiring an onsite operator, physical support/clear zone, RC override/Damping and emergency-stop readiness, current manual startup checklist, feedback/timeout checks and a tested rollback. API authority also needs physical RC toggle and continuous heartbeat. Do not bypass any failsafe or send a launch/mode/velocity command during preparation.

Examples: “시리얼 K1 번호로 배포 준비해줘”; “Stage this walking export locally”; “Test my policy in MuJoCo Sim2Sim.”

Read [coverage and evidence levels](../../references/coverage.md) when describing support. Recheck the current original source using [retrieval rules](../../references/sources.md); report source failures and never equate a prepared command with execution.
