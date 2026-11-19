---
name: ai-worker-learning
description: Use when collecting AI Worker demonstrations, reviewing or converting datasets, training imitation policies, evaluating checkpoints, or preparing model inference with Cyclo Intelligence.
---

# AI Worker Learning

Read [execution boundaries](../../references/execution.md) and the relevant learning pages in [official sources](../ai-worker/references/sources.md). Preserve the user's existing framework/version where supported. F1/F2 recording and inference use Cyclo Intelligence in the reviewed manual; do not substitute K1 walking or Mimic commands.

1. Establish Follower/revision, recording host, dataset/task and requested stage. Distinguish the robot, Cyclo Intelligence host and external training machine. Fetch current requirements and inspect existing checkout, Docker, disk, UI ports and Zenoh before installation. Recording/data tools do not require a GPU; inference and the selected training policy have their own GPU requirements.
2. For recording, first verify [teleoperation](../ai-worker-teleop/SKILL.md) and camera readiness within the authorized scope. Select the Follower robot config separately from its Leader. Check configured joint/action/image topics, camera names, measured rates and timestamp alignment. Publishing a topic does not make it part of the recording configuration. Record a short episode and inspect playback, joint data and camera completeness before a larger collection.
3. Review failed/incomplete episodes and task labels. Back up originals before deletion or renumbering. Merge compatible task/config datasets, then convert to a LeRobot format supported by the chosen training version. Set FPS from observed camera rates. Record source episodes, output path, schema, camera/joint ordering and conversion settings. Upload only when explicitly requested for a specific destination; avoid exposing tokens.
4. Training runs outside Cyclo Intelligence. Check the current policy/backend compatibility and training framework documentation; do not promise a bundled training container. Pin dataset/version and framework revision, then agree on policy, GPU/memory, run budget and stopping/checkpoint strategy before an authorized job. Use the real executor and run record from execution boundaries; preserve logs and checkpoint identity.
5. Evaluate the chosen checkpoint with recorded evidence. For inference, match robot, cameras, normalization, action schema and backend architecture/GPU support. Inspect the exact checkpoint path and policy settings. Distinguish 3D Sim Deploy from Real Robot Deploy; obtain concrete physical-actuation scope and [control](../ai-worker-control/SKILL.md) readiness before the latter. A loaded model or simulated action chunk is not a validated autonomous policy.

Deliver dataset/checkpoint provenance, commands and actual run status. Mark unavailable execution as pending.
