# OMX skills

Extend the user's selected five-skill product structure to `omx`, `omx-setup`, `omx-control`, `omx-teleop` and `omx-learning`.

## Approach

Use focused discovery entrypoints and a shared official source map, matching AI Worker and OMY. Preserve a selected ROS 2/Cyclo Intelligence or native LeRobot workflow. A unified skill would reduce entrypoints but lose the task separation already selected by the user.

## Constraints

English package content; current official ROBOTIS and LeRobot sources. Distinguish OMX-L Leader, OMX-F Follower and OMX-AI set. Identify USB roles independently of tty numbering. Preserve factory IDs/offsets and avoid generic recalibration. Native LeRobot-only work does not require ROS 2. ROS Leader-Follower, standalone MoveIt/GUI/keyboard and Follower-only inference are distinct modes. Do not inherit OMY onboard-PC, unpacking or camera assumptions. Authoring does not authorize hardware access, installs, training, uploads, publication or live-profile changes. No runtime, dependency, release version or commit changes are required.

## Validation

Validate all five skills/UI records, references and the 29-skill package inventory. Independently exercise native-only setup, reversed tty numbering, mode selection, supplied-only diagnosis, absent OMX recording config, factory calibration and unavailable sources. Run Python regressions and validate the source ZIP. No physical or training runtime claim follows.
