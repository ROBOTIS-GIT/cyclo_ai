# Zenoh integration and troubleshooting

[Zenoh upstream](https://zenoh.io/docs/overview/what-is-zenoh/) defines the transport/data framework; [ROBOTIS zenoh_ros2_sdk](https://github.com/ROBOTIS-GIT/zenoh_ros2_sdk) provides Python ROS-compatible communication, while [AI Sapiens ROS 2 communication](https://docs.robotis.com/docs/systems/aisapiens/development_guide/ros2_communication/) defines the robot-specific setup. Distinguish a Zenoh router, ROS `rmw_zenoh` integration, this Python SDK and application controllers. A generic router connecting does not prove matching topic types, discovery or command authority.

The [K1 Python SDK guide](https://docs.robotis.com/docs/systems/aisapiens/development_guide/zenoh_ros2_sdk/) provides a `/joint_states` subscription example. Its external-PC endpoint example is an address to replace with the actual robot router, not a discovery registry or default robot identity. It also contains a zero impedance publish example: zero positions/gains are still a command publication and are not a safe automatic connectivity test.

The reviewed repository metadata reports Python >=3.9, version 0.1.8, and broad dependency lower bounds including eclipse-zenoh>=0.10.0. This is not proof all future Zenoh versions interoperate. Inspect the selected release's API/config schema and the robot image's pinned ROS/RMW/router versions before installing. The SDK can load message/service definitions from repositories; record their revisions and allow network retrieval only in scope. K1's interface package/topic schema must match that robot image, not a similarly named interface from another product.

Troubleshoot in order, with local artifacts first:

1. Compare configured endpoint, client/peer/router mode, robot image and selected SDK/RMW versions. Check whether the expected router process is already running from provided logs; do not start or expose a new listener automatically.
2. Inspect topic name, type name/hash, domain/discovery configuration, namespaces and exact message package revision. Being connected at TCP level does not establish ROS discovery compatibility.
3. Check schema and array length/order against the robot's joint configuration. Joint names and values must remain aligned. A transport fix cannot repair an incorrect actuator or joint map.
4. Only in a later authorized network session use the documented topic-list or read-only subscription diagnostics. Stop after a bounded sample and close resources. Do not publish control commands to test connectivity.
5. If data is visible but commands are ignored, inspect the robot-specific authority/RC and heartbeat requirements. Do not disable failsafes or infer that a successful publish caused motion. Heartbeat loss is not an emergency damping guarantee.

For K1 control semantics and simulation preparation use [existing control guidance](../../ai-sapiens-control/SKILL.md) and [Sim2Sim preparation](../../ai-sapiens-sim2real/references/deployment.md). No network or robot runtime was exercised in this release.
