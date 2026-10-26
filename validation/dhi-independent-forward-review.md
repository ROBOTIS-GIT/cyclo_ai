# Independent forward evaluation: ROBOTIS integration source workbench

Date: 2026-10-26.

Scope: Used the updated `robotis-integrate` Skill, its source-workbench and product/TableSync references, local source inventories, and the supplied offline official checkouts. No web retrieval, upstream source execution, xacro/launch evaluation, ROS bringup, service calls, device access, port discovery or authentication changes occurred. The plugin's offline artifact inspector was run only against synthetic files under `/tmp`.

This is a fresh agent's source-grounded behavior evaluation, not installed Codex/Claude acceptance, an exhaustive implementation audit or real-device testing.

## 1. HX5-D20 rev2 right, use_mock_hardware=true: does starting its position controller enable torque?

Actual answer:

If that argument reached the expanded Hand configuration shown in the pinned source, its non-Gazebo mock branch selects `mock_components/GenericSystem`, rather than `dynamixel_hardware_interface/DynamixelHardware`. Starting a controller against that mock component does not execute DHI's device torque-enable path. That is a conclusion about this selected plugin chain; it is not proof that every physical motor is currently off or that another process is not controlling hardware. The argument string alone is not sufficient evidence that the running component actually selected the mock plugin. The Hand launch passes the argument into xacro, and the rev2 right wrapper forwards it to the hardware macro. [Launch forwarding](https://github.com/ROBOTIS-GIT/robotis_hand/blob/6f9e22a5fc86fe2f0947a44405e52e776c8c08c8/robotis_hand_bringup/launch/hx5_d20_right.launch.py#L93-L118), [wrapper forwarding](https://github.com/ROBOTIS-GIT/robotis_hand/blob/6f9e22a5fc86fe2f0947a44405e52e776c8c08c8/robotis_hand_description/urdf/hx5_d20_rev2/hx5_d20_right.xacro#L25-L28), [conditional plugin selection](https://github.com/ROBOTIS-GIT/robotis_hand/blob/6f9e22a5fc86fe2f0947a44405e52e776c8c08c8/robotis_hand_description/ros2_control/hx5_d20_rev2/hx5_d20_right.ros2_control.xacro#L5-L31).

Do not confuse starting a position controller with activating physical DHI hardware. In the pinned Jazzy DHI implementation, `on_activate` calls `start`; that path maps initial state/commands, writes, then attempts to enable the GPIO-selected set. `disable_torque_at_init=true` does not mean that a later hardware activation can never request torque. A successful lifecycle return also does not prove a device accepted the enable: the reviewed implementation can return success after its enable retries fail. [DHI activation/start](https://github.com/ROBOTIS-GIT/dynamixel_hardware_interface/blob/3375b3d0c99c5bcdab11b2dc15c89a2923e2bca2/src/dynamixel_hardware_interface.cpp#L538-L590), [activation-set construction](https://github.com/ROBOTIS-GIT/dynamixel_hardware_interface/blob/3375b3d0c99c5bcdab11b2dc15c89a2923e2bca2/src/dynamixel_hardware_interface.cpp#L901-L909).

For certainty about your actual launch, please supply existing artifacts rather than rerunning bringup:

- The exact launch command, all overrides, namespace/controller-manager target, product repository commit and local patches, and which overlay/package path was selected.
- The actual expanded `robot_description`, including every ros2_control component/plugin and parameter, not just the input xacro or launch argument.
- The selected controller-manager YAML, spawner arguments and the loaded controller type/version. The pinned Hand launch starts more than a position controller, including an effort controller and a separate effort command publisher; it should not be reduced to a single controller event. [Spawner](https://github.com/ROBOTIS-GIT/robotis_hand/blob/6f9e22a5fc86fe2f0947a44405e52e776c8c08c8/robotis_hand_bringup/launch/hx5_d20_right.launch.py#L150-L164), [separate effort publisher](https://github.com/ROBOTIS-GIT/robotis_hand/blob/6f9e22a5fc86fe2f0947a44405e52e776c8c08c8/robotis_hand_bringup/launch/hx5_d20_right.launch.py#L203-L224).
- Existing startup logs and controller/interface/hardware-lifecycle observations that identify the loaded plugin and claims. If the claim is about physical torque, existing device feedback is additionally needed; a mock configuration cannot establish it. Collecting new live evidence would require authorization and is outside this evaluation.

Observed decision: answered conditionally from the actual branch, avoided importing real-DHI behavior into GenericSystem, separated controller and hardware lifecycle, and requested concrete artifacts rather than asserting motor state.

## 2. Custom arm with effort and acceleration: calibrated torque and acceleration on Jazzy?

Actual answer:

Those YAML names do not establish either claim. In the indexed Jazzy implementation, `effort` maps to `Goal Current`; it is not intrinsically calibrated motor or joint torque in N.m. The DHI header maps position, velocity and effort but has no corresponding acceleration command mapping. Its initialization accepts an acceleration interface, while the cyclic `MapInterfaces` path skips interface keys absent from the conversion map. Therefore interface acceptance/export is not evidence of a working acceleration-to-register path. [Accepted names](https://github.com/ROBOTIS-GIT/dynamixel_hardware_interface/blob/3375b3d0c99c5bcdab11b2dc15c89a2923e2bca2/src/dynamixel_hardware_interface.cpp#L309-L322), [command maps](https://github.com/ROBOTIS-GIT/dynamixel_hardware_interface/blob/3375b3d0c99c5bcdab11b2dc15c89a2923e2bca2/include/dynamixel_hardware_interface/dynamixel_hardware_interface.hpp#L379-L397), [missing-map behavior](https://github.com/ROBOTIS-GIT/dynamixel_hardware_interface/blob/3375b3d0c99c5bcdab11b2dc15c89a2923e2bca2/src/dynamixel_hardware_interface.cpp#L1302-L1355).

For a concrete illustration, the pinned XM430-W350 DHI model file gives Goal Current and Present Current a multiplier of 1.0 with the unit `raw`, rather than N.m. That illustrates why the selected driver's model data must be read; it does not identify the motors on your custom arm. GPIO unit overrides and the joint/transmission mapping can further change the data path, and the reviewed special gripper conversion only applies to the named position path. [Model unit rows](https://github.com/ROBOTIS-GIT/dynamixel_hardware_interface/blob/3375b3d0c99c5bcdab11b2dc15c89a2923e2bca2/param/dxl_model/xm430_w350.model#L1-L8), [unit overrides](https://github.com/ROBOTIS-GIT/dynamixel_hardware_interface/blob/3375b3d0c99c5bcdab11b2dc15c89a2923e2bca2/src/dynamixel_hardware_interface.cpp#L823-L896), [joint-to-transmission conversion](https://github.com/ROBOTIS-GIT/dynamixel_hardware_interface/blob/3375b3d0c99c5bcdab11b2dc15c89a2923e2bca2/src/dynamixel_hardware_interface.cpp#L1377-L1393).

I created a synthetic one-joint fixture based on the supplied test fixture, declaring effort and acceleration in both the expanded URDF and controller YAML, with an explicit Goal Current GPIO command. The offline inspector reported `effort -> Goal Current`, `acceleration -> null`, `effort-unit-unverified` and `unmapped-interface`. It did not infer active controller state or physical units. That is a static result for the synthetic configuration, not your real arm.

Next, provide your expanded URDF, actual selected controller YAML/type, motor models and firmware, selected `.model` files/folder, unit overrides, transmission matrices and calibration/current-to-torque information, plus exact DHI binary revision/patches. Then the actual source path can be traced. Until it is established, do not treat a torque value as current ticks or substitute a goal/profile acceleration register for an unimplemented ROS acceleration path. No device test is necessary to establish the declaration/mapping mismatch.

Fixture artifacts:

- `/tmp/cyclo-dhi-review-custom.urdf`
- `/tmp/cyclo-dhi-review-custom.yaml`
- `/tmp/cyclo-dhi-review-custom-report.json`

Inspector invocation: `python3 scripts/inspect_ros2_control.py --urdf /tmp/cyclo-dhi-review-custom.urdf --controllers /tmp/cyclo-dhi-review-custom.yaml --profile jazzy --ros-distro jazzy`.

Observed decision: distinguished declaration, mapping, conversion and calibration; did not promise that YAML acceptance means functional control or that Jazzy names guarantee SI torque.

## 3. OMY end, K1 HAT and Hand use TableSync: copy addresses and use_table_sync?

Actual answer:

No. First establish whether each selected product configuration actually initializes device-side mirroring. The pinned K1 HAT xacro does not declare a TableSync enable/mapping sequence: it declares a sensor GPIO and state items, with optimized read parameters in its hardware configuration. I cannot infer a TableSync layout for K1 HAT from its name or from OMY/Hand. Those optimized parameters also need an intended driver revision; their presence in a xacro does not prove the indexed DHI consumes them. [K1 HAT hardware parameters and sensor](https://github.com/ROBOTIS-GIT/ai_sapiens/blob/937c67d66db1015a73a359f2c742943810a74e3a/ai_sapiens_description/ros2_control/k1_rev1/k1_hat.ros2_control.xacro#L14-L99).

The OMY F3M end-unit configuration does explicitly route a virtual actuator using model 231 and `comm_id=210`, then programs END-specific read/write mirror address/size items and SyncTable Enable. The END model table places that enable at address 46. The Hand rev2 right configuration instead uses controller 110, an initial Table Sync Enable=0/mapping phase, a later enable phase, and virtual devices decoded through model numbers 6001+ with `comm_id=110`. Its controller model table places Table Sync Enable at 70. These are different controller/mirror address spaces, not interchangeable physical servo tables. [OMY virtual route and END setup](https://github.com/ROBOTIS-GIT/open_manipulator/blob/ee9a720bcc45acda9c0df8fe689b1182844307db/open_manipulator_description/ros2_control/omy_f3m_end_unit.ros2_control.xacro#L71-L104), [END table](https://github.com/ROBOTIS-GIT/dynamixel_hardware_interface/blob/6bb5f93ecad1fe3c231e3ece580344e8f0a6efc3/param/dxl_model/omy_end.model#L22-L26), [Hand disable/mapping phase](https://github.com/ROBOTIS-GIT/robotis_hand/blob/6f9e22a5fc86fe2f0947a44405e52e776c8c08c8/robotis_hand_description/ros2_control/hx5_d20_rev2/hx5_d20_right.ros2_control.xacro#L230-L281), [Hand enable/virtual route](https://github.com/ROBOTIS-GIT/robotis_hand/blob/6f9e22a5fc86fe2f0947a44405e52e776c8c08c8/robotis_hand_description/ros2_control/hx5_d20_rev2/hx5_d20_right.ros2_control.xacro#L831-L860), [Hand controller table](https://github.com/ROBOTIS-GIT/dynamixel_hardware_interface/blob/6bb5f93ecad1fe3c231e3ece580344e8f0a6efc3/param/dxl_model/hx5_d20_rr.model#L1-L30).

There is no generic `use_table_sync` hardware flag in the indexed DHI. Device TableSync mirroring, SDK GroupSyncRead/Write and ros2_control controller operation are different layers. The practical next step is to identify the exact product/controller/firmware and dependency commits, then compare the selected xacro's ordered GPIO initialization, physical-versus-virtual roles, mirror model definitions and controller manual. Preserve separate disable/configure/enable phases; do not flatten them into a shared dictionary. Nothing in this explanation grants controller-register writes or proves the mirror is currently enabled.

Observed decision: challenged the unsupported K1 premise, preserved exact product/controller distinctions and did not invent a generic switch or a reusable address template.

## Guidance and retrieval findings

No critical behavioral defect was observed for these three requests. The updated Skill routes to source tracing rather than relying on generic ROS or DYNAMIXEL knowledge. It supported conditional answers and useful exact artifact requests without contacting the system.

The practical boundaries/gaps are:

1. The K1 HAT source profile does not establish its complete device-side table, and indexed main/Jazzy DHI does not establish the intended implementation of its optimized-read parameters. The current guidance correctly identifies source drift, but a per-product unresolved-dependency/table entry would make this gap more discoverable before users assume TableSync parity.
2. Product launch files may do more than spawn the named controller. Hand's effort publisher and post-spawner processes were found by following the actual launch file, not by reading the short product summary alone. The existing instruction to trace launch/spawner/caller chains was sufficient; this is a reminder that lexical artifact inventories cannot stand in for an expanded launch trace.
3. The offline inspector deliberately does not load/calibrate the actual motor model or identify an installed driver. It can detect unmapped interfaces but cannot resolve real SI torque, firmware-specific table selection or runtime activation from YAML. The evaluated answer retained those missing artifacts rather than claiming the helper solved them.
4. No controller-manager or GenericSystem implementation snapshot was supplied in the local DHI/product inventory. The conditional mock conclusion follows from selecting a mock plugin rather than DHI; exhaustive behavior of a patched mock plugin or its inherited lifecycle would require the exact loaded upstream/custom implementation. The answer did not claim that every unrelated node or device was safe/off.

The main and Jazzy header/model files used in scenario 2 share exact blob hashes in `references/dhi-sources.json`; Jazzy links above intentionally cite the Jazzy commit rather than silently substituting a main branch. Product `.repos` references do not establish that their users installed the indexed DHI commit, so every hardware-specific inference remains conditional on matching artifacts.

## Evidence limits

The review is offline. Only the plugin's deterministic local artifact inspector executed, on explicitly synthetic files. No upstream source, xacro or launch file was executed. No controller, service, network listener, ROS graph, robot or serial device was touched. No source edits or installs occurred. The report and fixture outputs are under `/tmp`; no acceptance or physical behavior test is claimed.

## Follow-up: added upstream framework/controller source inventory

The earlier inventory gap in finding 4 is now addressed at the **indexed-source evidence** level. `references/dhi-sources.json` now includes selected `ros-controls/ros2_control` hardware-interface, controller-interface and controller-manager sources, and selected `ros-controls/ros2_controllers` implementations at explicit Humble, Jazzy and master commits. It marks runtime testing false. I compared the indexed Jazzy blobs for GenericSystem header/implementation, resource manager, controller manager, joint trajectory controller and forward command controller against the supplied local Git snapshots; all six matched.

The read-only follow-up inspected these exact Jazzy sources:

- `ros2_control` revision `67646cfe21853fe3a66386b106daed1853dc5197`: [GenericSystem write](https://github.com/ros-controls/ros2_control/blob/67646cfe21853fe3a66386b106daed1853dc5197/hardware_interface/include/mock_components/generic_system.hpp#L64-L67) returns OK without a device write; [mock read/loopback](https://github.com/ros-controls/ros2_control/blob/67646cfe21853fe3a66386b106daed1853dc5197/hardware_interface/src/mock_components/generic_system.cpp#L343-L383) mirrors commands to states; [controller activation](https://github.com/ros-controls/ros2_control/blob/67646cfe21853fe3a66386b106daed1853dc5197/controller_manager/src/controller_manager.cpp#L2654-L2748) processes controller interfaces and claims; [hardware component state management](https://github.com/ros-controls/ros2_control/blob/67646cfe21853fe3a66386b106daed1853dc5197/hardware_interface/src/resource_manager.cpp#L2328-L2400) is a separate resource-manager path.
- `ros2_controllers` revision `d71703b362a6bbb4637a246d22b9960f8d149b20`: selected joint-trajectory and forward-command implementations are now indexed and available for tracing the exact configured controller type.

No prior substantive conclusion changes. The mock-versus-DHI distinction now has direct implementation evidence in the available index rather than relying only on selecting different plugin classes. Mock acceleration/dynamics support, when configured, would not establish DHI acceleration mapping or physical acceleration support. Controller activation and hardware activation remain distinct; exact loaded configuration and framework/controller versions still determine the user's runtime path.

Installed-binary identity, local patches/overlays, actual loaded components, lifecycle/claims and physical torque state remain unverified. Indexing framework source does not prove ABI/package compatibility with a consumer's installed ROS release. The K1 HAT intended-driver/table and optimized-read implementation gap is unchanged. This follow-up read files/Git objects only and did not edit the project, build or execute upstream source, start services, or contact hardware.
