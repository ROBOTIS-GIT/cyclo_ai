# Coverage and evidence matrix — 0.2.1

Reviewed 2026-10-23 against the official AI Sapiens sidebar. The [machine-readable index](manual-index.json) contains every current leaf-page URL and owner. Category headings are navigation groups, not additional implementations. Recheck the live sidebar before claiming current completeness.

- **Guidance:** a topic-specific explanation or source-navigation path; not a complete operating procedure.
- **Procedure:** packaged decisions, prerequisites, representative commands or operator steps, and checks. It does not mean every option in the manual is implemented or tested.
- **Unsupported:** no K1 procedure claimed; the official page is Coming Soon.
- **Runtime:** no robotics workflow in this version has been executed here. Host plugin ingestion/invocation is also unverified. Independent file-based model evaluations and offline helper tests are separate evidence in the release report. No overall support percentage is claimed.

| Manual page | Coverage | Manual status at review | Read when needed | Robotics runtime |
|---|---|---|---|---|
| [Introduction](https://docs.robotis.com/docs/systems/aisapiens/introduction/) | guidance | documented | [ai-sapiens-docs](../references/sources.md) | untested |
| [Video Gallery](https://docs.robotis.com/docs/systems/aisapiens/video_gallery/) | guidance | documented | [ai-sapiens-docs](../references/sources.md) | untested |
| [Hardware](https://docs.robotis.com/docs/systems/aisapiens/specifications/hardware/) | guidance | partial-coming-soon | [ai-sapiens-docs](../skills/ai-sapiens-docs/references/platform.md) | untested |
| [Electrical System](https://docs.robotis.com/docs/systems/aisapiens/specifications/electrical_system/) | guidance | partial-coming-soon | [ai-sapiens-docs](../skills/ai-sapiens-docs/references/platform.md) | untested |
| [Software Architecture](https://docs.robotis.com/docs/systems/aisapiens/specifications/software/) | guidance | documented | [ai-sapiens-docs](../skills/ai-sapiens-docs/references/platform.md) | untested |
| [Operation Guide](https://docs.robotis.com/docs/systems/aisapiens/quick_start_guide/operation_guide/) | procedure | partial-coming-soon | [ai-sapiens-operation](../skills/ai-sapiens-operation/references/operation.md) | untested |
| [Using the Remote Controller](https://docs.robotis.com/docs/systems/aisapiens/quick_start_guide/using_remote_controller/) | procedure | documented | [ai-sapiens-operation](../skills/ai-sapiens-operation/references/rc.md) | untested |
| [Networking](https://docs.robotis.com/docs/systems/aisapiens/development_guide/networking/) | procedure | documented | [ai-sapiens-connectivity](../skills/ai-sapiens-connectivity/references/network.md) | untested |
| [How to SSH into the Robot](https://docs.robotis.com/docs/systems/aisapiens/development_guide/ssh/) | procedure | documented | [ai-sapiens-connectivity](../skills/ai-sapiens-sim2real/references/deployment.md) | untested |
| [Bringup with cycloctl](https://docs.robotis.com/docs/systems/aisapiens/development_guide/cycloctl/) | procedure | documented | [ai-sapiens-diagnostics](../skills/ai-sapiens-diagnostics/references/diagnostics.md) | untested |
| [DYNAMIXEL-Q and Impedance Control](https://docs.robotis.com/docs/systems/aisapiens/development_guide/dynamixel_q_impedance_control/) | guidance | documented | [ai-sapiens-control](../skills/ai-sapiens-control/references/impedance.md) | untested |
| [ROS 2 Communication](https://docs.robotis.com/docs/systems/aisapiens/development_guide/ros2_communication/) | procedure | documented | [ai-sapiens-control](../skills/ai-sapiens-control/references/ros2.md) | untested |
| [ROS 2 Package Structure and Topic Description](https://docs.robotis.com/docs/systems/aisapiens/development_guide/ros2_package_structure/) | guidance | documented | [ai-sapiens-control](../skills/ai-sapiens-control/references/impedance.md) | untested |
| [Control with Python SDK](https://docs.robotis.com/docs/systems/aisapiens/development_guide/zenoh_ros2_sdk/) | procedure | documented | [ai-sapiens-control](../skills/ai-sapiens-control/references/sdk.md) | untested |
| [Sim2Real](https://docs.robotis.com/docs/systems/aisapiens/development_guide/sim2real/) | procedure | documented | [ai-sapiens-sim2real](../skills/ai-sapiens-sim2real/references/deployment.md) | untested |
| [MuJoCo Sim2Sim](https://docs.robotis.com/docs/systems/aisapiens/development_guide/sim2sim/) | procedure | documented | [ai-sapiens-sim2real](../skills/ai-sapiens-sim2real/references/deployment.md) | untested |
| [Cyclo Lab](https://docs.robotis.com/docs/systems/aisapiens/reinforcement_learning/cyclo_lab/) | procedure | documented | [ai-sapiens-walking](../skills/ai-sapiens-walking/references/training.md) | untested |
| [Lab Locomotion](https://docs.robotis.com/docs/systems/aisapiens/reinforcement_learning/cyclo_lab/locomotion/) | procedure | documented | [ai-sapiens-walking](../skills/ai-sapiens-walking/references/training.md) | untested |
| [Lab Mimic](https://docs.robotis.com/docs/systems/aisapiens/reinforcement_learning/cyclo_lab/mimic/) | procedure | documented | [ai-sapiens-video-mimic](../skills/ai-sapiens-video-mimic/references/motion.md) | untested |
| [Cyclo MJLab](https://docs.robotis.com/docs/systems/aisapiens/reinforcement_learning/cyclo_mjlab/) | procedure | documented | [ai-sapiens-walking](../skills/ai-sapiens-walking/references/training.md) | untested |
| [MJLab Locomotion](https://docs.robotis.com/docs/systems/aisapiens/reinforcement_learning/cyclo_mjlab/locomotion/) | procedure | documented | [ai-sapiens-walking](../skills/ai-sapiens-walking/references/training.md) | untested |
| [MJLab Mimic](https://docs.robotis.com/docs/systems/aisapiens/reinforcement_learning/cyclo_mjlab/mimic/) | procedure | documented | [ai-sapiens-video-mimic](../skills/ai-sapiens-video-mimic/references/motion.md) | untested |
| [GEM-X](https://docs.robotis.com/docs/systems/aisapiens/motion_generation/gem-x/) | procedure | documented | [ai-sapiens-video-mimic](../skills/ai-sapiens-video-mimic/references/motion.md) | untested |
| [Kimodo](https://docs.robotis.com/docs/systems/aisapiens/motion_generation_retargeting/kimodo/) | procedure | documented | [ai-sapiens-motion-sources](../skills/ai-sapiens-motion-sources/references/kimodo.md) | untested |
| [SOMA-X](https://docs.robotis.com/docs/systems/aisapiens/motion_generation_retargeting/soma_x/) | procedure | documented | [ai-sapiens-motion-sources](../skills/ai-sapiens-motion-sources/references/soma.md) | untested |
| [Soma-retargeter](https://docs.robotis.com/docs/systems/aisapiens/motion_generation_retargeting/soma_retargeter/) | procedure | documented | [ai-sapiens-video-mimic](../skills/ai-sapiens-video-mimic/references/motion.md) | untested |
| [GMR](https://docs.robotis.com/docs/systems/aisapiens/motion_generation_retargeting/gmr/) | unsupported | coming-soon | [ai-sapiens-docs](../references/sources.md) | untested |
| [Imitation Learning Overview](https://docs.robotis.com/docs/systems/aisapiens/imitation_learning/overview/) | guidance | overview-only | [ai-sapiens-docs](../references/sources.md) | untested |
| [LeRobot](https://docs.robotis.com/docs/systems/aisapiens/imitation_learning/lerobot/) | unsupported | coming-soon | [ai-sapiens-docs](../references/sources.md) | untested |
| [Cyclo Intelligence](https://docs.robotis.com/docs/systems/aisapiens/imitation_learning/cyclo_intelligence/) | unsupported | coming-soon | [ai-sapiens-docs](../references/sources.md) | untested |
| [Open Source](https://docs.robotis.com/docs/systems/aisapiens/resources/open_source/) | guidance | partial-coming-soon | [ai-sapiens-docs](../references/sources.md) | untested |
| [Release Notes](https://docs.robotis.com/docs/systems/aisapiens/resources/release_notes/) | guidance | external-channel | [ai-sapiens-docs](../references/sources.md) | untested |
| [Building Humanoid Skills](https://docs.robotis.com/docs/systems/aisapiens/resources/technical_story/building_humanoid_skills/) | guidance | documented | [ai-sapiens-docs](../references/sources.md) | untested |
| [Support](https://docs.robotis.com/docs/systems/aisapiens/resources/support/) | guidance | documented | [ai-sapiens-docs](../references/sources.md) | untested |

Partial pages need section-level checks: hardware BoM/STEP/covers/tutorials and electrical PCB/MCU/wiring/pinout resources are Coming Soon. Operation Guide mode-switch/LED sections are Coming Soon, while the separate RC page documents its own mode flow. Open Source says USD is not yet public. A linked repository or article is not proof that its K1 workflow is ready. The technical story includes AI Worker manipulation; do not transfer those claims to K1.
