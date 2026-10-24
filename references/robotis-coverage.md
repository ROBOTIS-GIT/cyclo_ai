# ROBOTIS expert coverage, 0.4.0

Inventory date: 2026-10-24. This is a staged expert architecture, not a claim to have read every ROBOTIS page or support every product operation. Product lifecycle is unknown unless a retrieved official notice says otherwise. Public repository archived flags are preserved as repository metadata, not product-discontinuation claims.

| Domain | Knowledge/procedure coverage | Executable module and evidence |
| --- | --- | --- |
| AI Sapiens K1 manual | Existing 34-page matrix and nine focused task Skills retained, including RC, operation, networking, cycloctl, ROS/SDK, learning, motion and deployment preparation | Offline asset helper only; no robotics runtime |
| DYNAMIXEL XL330-M288 and XM430-W350 | Reviewed control-table constants, mode distinctions, ID/baud/LED/profile preparation, firmware footnotes and failure handling | New exact firmware profiles 52/42 respectively, mock-tested; real SDK provider unverified |
| DYNAMIXEL Y | Reviewed named YM070 position/velocity/current cascade explanation with official diagram and table distinctions | No Y configuration writes |
| Other X, Y variants, P/PRO, MX/AX/EX/DX/RX, DYD | Official family/model navigation routes, exact-model retrieval required | Unsupported by new configuration engine |
| SDK/protocol | Focused packet/API/protocol distinction; model-specific access/units remain mandatory | Legacy Cyclo module retained; new Protocol 2 configuration subset only |
| ROS 2 / ros2_control / dynamixel_hardware_interface | Focused installation, branch/dependency, overlay, interface and controller troubleshooting procedures | Documentation only; no ROS stack installation or launch test |
| Zenoh / rmw_zenoh / zenoh_ros2_sdk | Reviewed transport versus integration boundaries, type/schema/router and version troubleshooting; K1 state versus command distinction | Documentation only; no router or robot connection |
| Cyclo Lab / CYCLO MJLab | Retained setup/task/backend selection, locomotion/Mimic CLI distinction and compatibility notes | No GPU training or simulator runtime |
| Robot platforms, hands and manipulators beyond K1 | Navigation-discovered products plus task-oriented retrieval/selection/setup workflow | No generic cross-product launch or deployment executor |
| Controllers, interfaces, accessories | Source discovery and wiring/power/variant retrieval workflow | No board discovery, flashing or hardware test |
| Educational and older-generation products/software | Both documentation generations indexed; path tags preserve family names when links say only “LEVEL 1” | Discovery/guidance only; availability and lifecycle require official evidence |
| Newly released or unindexed products | Search/follow official navigation and ROBOTIS-GIT metadata; record actual sources and uncertainty | No automatic executable registry expansion |

Knowledge levels in the JSON source inventory are explicit: `discovered-only`, `reviewed-guidance`, and retained K1 `guidance`/`procedure`/`unsupported`. A hash proves byte identity, a metadata/manifest test proves structure, a model evaluation demonstrates a response in that context, and a mock transaction demonstrates code behavior against the fixture. None proves physical compatibility or successful installed-host invocation.
