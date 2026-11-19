---
name: ai-worker-teleop
description: Use when setting up or troubleshooting AI Worker teleoperation with an A1, A2 or LG2 Leader, or a VR headset and ROBOTIS Vuer.
---

# AI Worker Teleoperation

Read [execution boundaries](../../references/execution.md). Retrieve the selected Leader or VR manual through [official sources](../ai-worker/references/sources.md); do not load both workflows unless comparing or switching them.

1. Establish Follower model/revision separately from the input device: A1, A2, LG2 or VR. Confirm the installed software, robot/user-PC placement and current stage. Route missing SSH/Zenoh to [setup](../ai-worker-setup/SKILL.md) and controller readiness to [control](../ai-worker-control/SKILL.md). Do not select a Follower from the Leader name.
2. For a physical Leader, use its own wiring, alignment and launch section. Check joint alignment marks before operation; do not compensate for misalignment with guessed offsets. Select the Follower launch independently. Retrieve the exact engagement, release and stop controls for that release rather than assuming the input device is already commanding the robot.
3. For VR, verify the currently supported headset and software, Vuer hosting machine, endpoint and transport requirements. Prepare the documented calibration and ready pose. Retrieve the model mapping: the VR publisher's shared model alias can differ from the motion controller's actual Follower model. The controller must match the real robot. Verify endpoint/certificate identity instead of globally disabling security checks or exposing ports.
4. Inspect existing Zenoh, cameras, publishers and motion controllers before starting duplicates. Confirm input and feedback visibility before engagement. Treat physical initial-pose changes, follower bringup and teleoperation engagement as actuation, even if described as setup. Require an onsite operator, clear workspace, bounded initial movement and a known release/stop method before authorized operation.
5. Check release behavior, tracking loss and stale input using the current implementation; do not invent a watchdog guarantee. Disengage and stop on unexpected motion. Report each process, host, selected model, calibration state and observed result separately.

For demonstrations, hand off to [learning](../ai-worker-learning/SKILL.md) after robot and camera readiness. Starting teleoperation alone does not establish that data is being recorded.

Examples: "Use an A2 Leader with my F2"; "Prepare VR teleoperation for F1."
