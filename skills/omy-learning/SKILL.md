---
name: omy-learning
description: Use when collecting OMY demonstrations, reviewing or converting datasets, training imitation policies, evaluating checkpoints, or preparing Cyclo Intelligence model inference for OMY.
---

# OMY Learning

Read [execution boundaries](../../references/execution.md) and the relevant OMY learning pages in [official sources](../omy/references/sources.md). Use current Cyclo Intelligence guidance unless the user deliberately selected a supported legacy workflow. AI Worker FFW configs and K1 learning commands do not establish OMY support.

1. Identify OMY model/revision, current stage and the robot, recording/camera and training hosts. The documented OMY SBC Manager environment does not include Cyclo Intelligence; prepare it on the appropriate user/external PC instead of treating a missing robot-side button as a failure. Recording/data tools can run without a GPU; check GPU requirements separately for training and inference.
2. Verify installed robot configs before selecting an OMY type. Do not invent a config filename or substitute F1/F2. If the matching config is absent, inspect the actual robot's joint/action/camera schema and supported release before proposing a scoped configuration change. Confirm running robot/camera topics through [teleoperation](../omy-teleop/SKILL.md) within the authorized scope.
3. Check configured topics, camera keys, measured rates and timestamps. Record a short episode, then inspect playback, images, joints and task/subtask labels before larger collection. Record dataset identity and host/container output paths; only configured topics are collected.
4. Review and preserve originals before deletion, renumbering or merging. Convert compatible episodes into the format supported by the selected training version, using measured camera rates for FPS. Keep source-to-output provenance and joint/image/action ordering. Dataset/model upload or transfer requires an explicitly requested destination; keep credentials out of logs.
5. Train outside Cyclo Intelligence using a policy with a matching inference backend. Pin dataset/framework versions and policy configuration; establish GPU resources, budget, checkpoints, logs and stop procedure before an authorized job. Use a real executor and report actual status. A checkpoint file alone does not prove completion or policy quality.
6. Evaluate a specific checkpoint and verify robot/camera/action schema, normalization and backend architecture/GPU support. Test the documented simulated action chunk before proposing physical inference. Stop teleoperation, confirm exclusive command ownership, then use the matching Follower-only bringup from the current OMY guide. Real Robot Deploy needs concrete motion authorization and [control](../omy-control/SKILL.md) readiness; simulation is separate evidence.

Deliver reproducible dataset/checkpoint paths, preparation results and observed run status; mark unavailable execution pending.
