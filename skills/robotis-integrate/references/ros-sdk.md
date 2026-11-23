# ROS 2, SDK and hardware-interface integration

The [DYNAMIXEL SDK overview](https://docs.robotis.com/docs/software/dynamixel_sdk/overview) covers packet communication for Protocol 1 and 2. The SDK and Cyclo AI use separate source-bound transport and item contracts; neither establishes DHI's actual runtime behavior. Neither packet support nor a model filename alone establishes safe writes, units or torque semantics for a model/firmware.

The [ROBOTIS hardware-interface README](https://github.com/ROBOTIS-GIT/dynamixel_hardware_interface) describes a ros2_control plugin and names Humble, Jazzy and Rolling. It instructs cloning distribution-matched branches of `DynamixelSDK`, `dynamixel_hardware_interface` and `dynamixel_interfaces`. Check each branch actually exists before proposing that setup. These are upstream documented support claims, not runtimes tested by this plugin.

For a clean user-approved workspace (instructions only here), first verify the branch exists for all dependencies. If it does not (for example Rolling in the indexed DHI branch inventory), resolve an explicitly compatible revision instead of running this template unchanged:

```sh
cd "$WORKSPACE/src"
git clone -b "$ROS_DISTRO" https://github.com/ROBOTIS-GIT/DynamixelSDK.git
git clone -b "$ROS_DISTRO" https://github.com/ROBOTIS-GIT/dynamixel_hardware_interface.git
git clone -b "$ROS_DISTRO" https://github.com/ROBOTIS-GIT/dynamixel_interfaces.git
cd "$WORKSPACE"
colcon build
source install/setup.bash
```

Before execution, verify OS/distribution support against the [ROS installation index](https://docs.ros.org/en/jazzy/Installation.html), branch/tag, package.xml dependencies and local overlays. If ROS docs are blocked by bot protection, say so and consult official source documentation; do not infer support from the host's installed Python. Resolve required system dependencies only within the requested scope; these commands do not provision hardware access.

Configuration separates port/baud and motor IDs/model tables from joint/transmission mappings and controller command/state interfaces. Compare the exact xacro and controller YAML at the selected revision. A missing plugin error calls for checking the built plugin XML, package exports and sourced workspace; a missing interface calls for comparing declared interfaces and controller requirements. Build success does not validate the wiring, model tables or motion behavior.

The [ros2_control hardware-components documentation](https://control.ros.org/jazzy/doc/ros2_control/hardware_interface/doc/hardware_components_userdoc.html) describes the upstream abstraction. The hardware interface connects that abstraction to DYNAMIXEL; the SDK handles protocol packets; controllers generate commands. Zenoh middleware transports ROS traffic and is not a replacement for the hardware plugin or a motor control loop.

Do not launch real hardware/controller-manager or call set-data, reboot or torque services to diagnose an installation. Prefer source review, offline URDF/config validation and a separately configured simulation/mock backend. Generic examples may include motion-capable launch files: inspect before running. Read-only graph/state queries still contact a running system and require authorization for that system.
