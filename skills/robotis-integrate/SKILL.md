---
name: robotis-integrate
description: Guide ROBOTIS software integration and installation troubleshooting across ROS 2, ros2_control, DYNAMIXEL SDK and hardware interface, Zenoh and Cyclo simulation stacks with explicit version boundaries.
---

# ROBOTIS integration

Resolve the layer before giving commands: device/electrical bus → packet SDK → model-aware hardware interface → ros2_control/controller → ROS middleware/transport → application/learning stack. A service or API being present does not authorize calling it.

For serial SDK, ROS 2 build, URDF/xacro, controller or hardware-interface questions, read [ROS and SDK workflow](references/ros-sdk.md). For router/discovery/type/transport issues, read [Zenoh workflow](references/zenoh.md). Use [compatibility records](../../references/compatibility.json) as dated evidence, then fetch exact release sources through [retrieval rules](../robotis-expert/references/retrieval.md). Do not mix a package's default branch with another distribution's dependencies.

For “Should I use Cyclo Lab or Cyclo MJLab?” use [walking](../ai-sapiens-walking/SKILL.md): identify target task, GPU/OS, existing environment and simulator preference. Their CLI syntax and task registration differ. A request to train without a backend requires the Lab/MJLab choice, not automatic installation. An Isaac Sim 6/Newton experimental branch is not the validated default stack.

For a new isolated robot-arm mock scaffold, use [first-run artifact preparation](../../references/first-run.md); collect the real model/mapping and do not substitute a synthetic arm for product calibration.

For installation failures, ask for the exact failing command and first useful error plus OS, architecture, distribution, environment and commit. Inspect user-provided logs/config locally without secrets. Classify missing dependency, version conflict, overlay contamination, API/schema mismatch, transport failure or hardware issue; propose the smallest reversible next check and expected result. Do not prescribe reinstalling the OS, overwriting global settings or running a controller as a generic diagnostic.

Start with local/offline evidence. Serial or ROS/Zenoh device connections, GPU training, persistent connections and production changes require appropriate task authorization. Explain which suggested checks contact a network/device before execution. Documented commands remain instructions until a separately authorized executor actually runs them. Examples: “The hardware interface fails to build on Jazzy”, “What is the difference between the SDK and ros2_control?”, “I cannot see joint_states through Zenoh”.
