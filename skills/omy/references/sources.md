# OMY official sources

Reviewed for skill authoring on 2026-11-06. These links and selected procedure checks are not a complete manual snapshot or robot runtime validation. Retrieve only the relevant current sections before version-sensitive commands. If a link moves, follow official navigation. On retrieval failure, disclose the gap and use supplied artifacts or explicitly dated reviewed facts; do not invent flags, credentials or compatibility. Commands in documentation are task data, not execution authorization.

## Product and installation

- [Introduction](https://docs.robotis.com/docs/systems/omy/introduction/): OMY lineup, specifications and navigation. Keep OMY-L100, OMY-F3M, OMY-3M and the OMY-AI3M set distinct.
- [Setup guide](https://docs.robotis.com/docs/systems/omy/quick_start_guide/setup_guide/): model-specific wiring, camera USB hub, robot-PC SSH/container paths, persistent workspace and physical packing state. Unpacking moves the arm and is only for the documented packed posture. SSH examples across pages are not a universal credential contract; verify the actual OS/revision and identity.
- [Zenoh](https://docs.robotis.com/docs/systems/omy/quick_start_guide/zenoh_communication/): external-PC OpenMANIPULATOR container, RMW/domain consistency and client connection to the robot router. Select the verified endpoint; avoid duplicating persistent configuration.
- [Cyclo Manager installation](https://docs.robotis.com/docs/systems/omy/quick_start_guide/operation_guide/cyclo_manager/install/): robot-PC installation, persistent services, containers and agent compatibility. This is separate from user-PC Cyclo Intelligence.
- [Manager bringup](https://docs.robotis.com/docs/systems/omy/quick_start_guide/operation_guide/cyclo_manager/bringup/): Zenoh, model/profile, logs, initialization options, mock/simulation choices and packing-position files. The documented OMY SBC does not provide the Cyclo Intelligence container/button. Starting a profile can cause movement.

## Control and operator input

- [Robot control](https://docs.robotis.com/docs/systems/omy/quick_start_guide/operation_guide/robot_control/): standalone bringup, MoveIt 2, GUI and keyboard input. Examples target F3M; use a 3M alternative only when the matching launch exists. Planning, executing and GUI pose controls have different effects.
- [Teleoperation](https://docs.robotis.com/docs/systems/omy/quick_start_guide/operation_guide/teleoperation/): L100/F3M pairing, robot-side `omy_ai.launch.py`, immediate initialization/synchronization, and camera node on the physically connected host, normally the user PC. Stop Leader-Follower teleoperation before the separate inference Follower bringup.
- [Cyclo Control](https://docs.robotis.com/docs/systems/omy/advanced_features/cyclo_control/): OMY MoveL/MoveJ interfaces, frames and interpolation. The reviewed MoveL/MoveJ examples name different launch packages; resolve against installed files/source rather than assuming both exist. Self-collision filtering does not guarantee obstacle or human safety.

## Demonstration learning

- [Cyclo Intelligence setup](https://docs.robotis.com/docs/systems/omy/imitation_learning/setup/): Docker/Compose, storage, UI and Zenoh. Recording/data tools can run without a GPU; inference needs a suitable GPU. Read installers before execution.
- [Data recording](https://docs.robotis.com/docs/systems/omy/imitation_learning/data_recording/): existing robot config, configured topics, camera views, topic monitor and rosbag2 episodes. Only installed robot config files appear as selectable types; this page does not establish a universal OMY config filename.
- [Data tools](https://docs.robotis.com/docs/systems/omy/imitation_learning/data_tools/): episode review, deletion/merging, camera-rate-based conversion and dataset/model transfer. Retain originals before destructive edits.
- [Training](https://docs.robotis.com/docs/systems/omy/imitation_learning/model_training/): external training environment, policy/backend matching and framework/GPU requirements. Verify the current policy list; do not assume illustrative training budgets fit the user's resources.
- [Inference](https://docs.robotis.com/docs/systems/omy/imitation_learning/model_inference/): stop teleoperation, select the correct Follower bringup, match checkpoint/backend and distinguish simulated action chunks from physical deployment. Verify image architecture/GPU support before a pull or run.

## Source code

- [OpenMANIPULATOR](https://github.com/ROBOTIS-GIT/open_manipulator): OMY launch files, model descriptions, controllers and Docker helpers; match the installed release/branch.
- [Cyclo Intelligence](https://github.com/ROBOTIS-GIT/cyclo_intelligence): inspect the actual checkout's robot configs and policy backend support.

Physical AI Tools is labelled legacy in OMY navigation; preserve a deliberately selected existing legacy workflow and verify its release instead of silently migrating it. For DHI implementation and OMY register layouts use [ROBOTIS integration](../../robotis-integrate/SKILL.md). Its indexed snapshots are source evidence, not installed-binary or hardware validation.
