---
name: omx-learning
description: Use when collecting OMX demonstrations, reviewing or converting datasets, training imitation policies, evaluating checkpoints, or preparing Cyclo Intelligence or native LeRobot inference.
---

# OMX Learning

Read [execution boundaries](../../references/execution.md) and the selected learning pages in [official sources](../omx/references/sources.md). Preserve ROS 2/Cyclo Intelligence or native LeRobot already selected. If unknown and it changes the next command, resolve the workflow first. Preserve a deliberately selected supported legacy workflow rather than migrating it silently.

1. Establish OMX role/revision, host, current stage, camera hardware and dataset/task. Keep recording, training and inference resources explicit. Recording/data-tool GPU requirements differ from the selected training/inference policy; check actual requirements rather than starting a sample GPU job.
2. For Cyclo Intelligence, verify its installed OMX robot config and the actual joint/action/camera schema. An absent OMX choice does not justify selecting OMY, F1 or F2. Verify supported release/configuration before proposing changes. Check running configured topics, camera keys, rates and timestamps after [teleoperation](../omx-teleop/SKILL.md) readiness. Record a short rosbag2 episode and inspect playback before scaling collection.
3. For native LeRobot, use the matching OMX drivers, stable robot identity, ports and camera settings established during teleoperation. Adapt the current recording/tutorial interface to OMX, not its example robot. Native data collection does not require Cyclo Intelligence or a rosbag conversion step. Inspect installed upload defaults and select local-only behavior unless publication to a specific destination is explicitly requested; if uncertain, resolve that before recording.
4. Review episode completeness, task labels, images and actions. Preserve originals before deletion, renumbering or merging. Convert ROS recordings only when required by the selected training schema, using measured camera rates for FPS. Record dataset version, output paths, camera/joint/action ordering and conversion settings. Do not assume datasets or checkpoints transfer between stacks without schema/normalization checks.
5. Train in the chosen external environment with pinned framework/dataset/policy configuration. For Cyclo Intelligence return, confirm a compatible inference backend before training. Establish GPU/memory, budget, logs, checkpoints and stopping method before an authorized run; use a real executor and observed status.
6. Evaluate a specific checkpoint. Match robot/camera/action schema, normalization and backend/platform support. For Cyclo Intelligence, distinguish simulated action chunks from Real Robot Deploy and use the correct Follower-only bringup after stopping teleoperation. For native evaluation, verify current rollout/recording CLI semantics and exclusive USB ownership; do not promise Cyclo's simulation mode exists there. Physical evaluation needs concrete motion authorization and control readiness.

Deliver reproducible provenance, prepared commands and actual run status. Mark unavailable execution pending.
