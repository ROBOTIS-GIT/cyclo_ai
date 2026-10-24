# Actuator and controller concepts

Source: [DYNAMIXEL-Q and Impedance](https://docs.robotis.com/docs/systems/aisapiens/development_guide/dynamixel_q_impedance_control/). The QDD architecture uses low reduction and a low-inertia PMSM; K1 communication is RS-485 at 6 Mbps. Its impedance equation is:

`torque = kp * (desired_position - position) + kd * (desired_velocity - velocity) + feedforward_torque`

Explain kp as position stiffness, kd as velocity damping and feedforward as the higher-level torque term. This is a conceptual description, not approved tuning values. Zero gains are still a physical control command; do not propose them as a harmless connectivity test. Joint-specific limits and measured dynamics require real robot/runtime evidence.

Source: [ROS 2 Package Structure](https://docs.robotis.com/docs/systems/aisapiens/development_guide/ros2_package_structure/). Messages/services live in ai_sapiens_interfaces. Bringup owns controller config, description owns models, and sim2real owns policy/mode runtime. The command topic /joint_group_impedance_controller/commands accepts JointImpedanceCommand arrays. Each positions/feedforward/kp/kd index follows the joints list in ai_sapiens_bringup/config/k1_rev1/k1_rev1_controllers.yaml; do not sort it or copy another robot's order. Read actual message schema and config before writing code. This package supplies no live command publisher or certified gain presets.
