# First use and first success

Choose the user's goal before setup: official manual/model selection, DYNAMIXEL configuration, robot-arm software integration or AI Sapiens learning/deployment preparation. An explanation or selection question needs no device connection. Installing this package creates no hardware permission, GPU executor or credentials.

## Prepare the package

Extract the ZIP, preserving its `ai-sapiens-dev` directory. In that directory use Node >=22 and Python >=3.9. Install local Node dependencies with `npm ci --ignore-scripts --no-audit --no-fund`. For offline validation use a separate Python environment with `python3 -m pip install -r validation/requirements.txt`, then `npm test`. Do not install globally. Missing tools are prerequisites, not permission to modify system packages.

Use the host's supported private/local plugin flow. The portable root manifest declares two local stdio servers, both hardware-disabled by default. A cloud upload alone does not run Node. After host installation, start a fresh conversation and invoke `$cyclo` or run the declared setup. Ask a manual question; when product MCP tools are available, `robotis_sources` and `dynamixel_registry` are local, device-free first-success checks. If tools are absent, report that installation/runtime boundary and provide the relevant Skill guidance; do not claim a successful tool call or reinstall repeatedly.

Examples: “내 용도에 맞는 다이나믹셀 골라줘”, “전류기반 위치제어 설명해줘”, “로봇 팔 DHI와 ROS 2 control 설정 도와줘”, “AI Sapiens 보행 policy 학습 준비해줘”. For model selection ask required continuous load/torque-speed, voltage, interface, size and environment, then retrieve exact official specifications. Do not choose from stall torque alone or substitute a related model.

## Unknown actuator: discover, choose, configure

Live access remains off until the operator permits a concrete bus/operation and deliberately configures the separate runtime. Use mocks when live access is outside scope. A port-only operator config can authorize bounded discovery without knowing model, firmware, current ID or baud:

```json
{
  "allowPortDiscovery": false,
  "buses": {
    "bench": {
      "port": "/dev/REPLACE_WITH_CONFIRMED_ADAPTER",
      "allowScan": true,
      "allowConfigure": false
    }
  },
  "targets": {}
}
```

The placeholder is not a discovered device. If OS port catalog access is separately permitted, enable `allowPortDiscovery`, call `dynamixel_ports`, show candidates and have the operator confirm the intended adapter. Add that port to a task-local bus config, preserving other entries; restart only this MCP process to load it. Catalog permission does not grant scan/configure permission. Building the pinned SDK with `npm run build:device-runtime` does not access hardware. Set `CYCLO_PRODUCTS_CONFIG` to the operator file and `CYCLO_PRODUCTS_ENABLE_HARDWARE=1` only for the separately authorized real session. Never change the packaged default or global host settings as a shortcut.

1. Ask which bounded IDs/rates to inspect. For example `{bus:"bench", ids:[1,2,3], bauds:[57600,1000000]}` is a small initial range, not a universal scan or default identity. Call `dynamixel_scan` first with its default dry run. A full matrix may need explicit bounded batches; do not broaden automatically.
2. Execute only the agreed read-only scan. Zero responders: inspect completeness/errors, power/interface/port/rate assumptions; do not infer an absent device. Multiple responders: show identities/rates, ask which device, physically isolate it and rescan. Unsupported model/firmware: use its official manual; the executable matrix has not expanded.
3. A complete scan with confirmed closure/released bus lease returns short-lived `scanId` and `candidateId`. Ask for explicit selection and physical single-device isolation; call `dynamixel_select` with those tokens, a new target name, `confirmed:true`, `isolatedBus:true`. It creates a session handle only if the bus already permits configuration. A scan-only grant cannot be upgraded by selection. Port replacement, newer observations, expired tokens or context changes require re-identification. Even one responder is not automatically selected.
4. Validate the requested named change with `dynamixel_configure`'s default dry run. Confirm the exact target, effect and intended values before the real call if that authorization is still missing. Execution rechecks model/firmware/protocol/snapshot, torque already off, isolation and destination collision. ID and baud changes are separate operations; no torque or position goal is sent.
5. On fully verified change with confirmed closure and released reservation, the session target advances to the observed new ID/baud. The next operation on that name uses the new location and re-verifies identity. Dry runs never advance it. Failed/uncertain operations or changed binding block further writes. Confirm closure and exclusivity, then rescan and explicitly select a new handle for reconciliation. Never repeat an uncertain write automatically.
6. `dynamixel_targets` shows ready/blocked state, revision and current location. Handles and observations are session-local. Operator config files are never silently rewritten; restart requires fresh discovery/selection or an explicitly reviewed current target config. Do not copy a blocked candidate location into config as if verified.

The allowlist remains XL330-M288-T firmware52 and XM430-W350-T/R firmware42. These are curated mock-tested profiles, not manufacturer certification. Full snapshot continuity checks are stronger than a destination-ID reply but cannot establish a unique physical serial identity when the hardware provides none; physical isolation and operator confirmation remain necessary. No arbitrary writes, mode/torque changes, motion, reset or flashing are added.

## Robot arm and learning preparation

For ROS 2/DHI, read [integration guidance](../skills/robotis-integrate/references/ros-sdk.md). Collect the actual platform URDF, joint/actuator mapping, distribution and versioned model tables. For a new isolated mock scaffold use `python3 scripts/prepare_ros2_mock.py SPEC.json NEW_OUTPUT_DIRECTORY`; [synthetic fixture](../tests/fixtures/arm-mock-spec.json) shows required fields and is not a calibrated product configuration. The generator preserves existing files and emits Xacro, controller YAML, a mock-only launch file and a separate DHI review plan. Expand with `xacro`, inspect joint/interface consistency, and keep the real DHI plugin out of mock bringup. Launch only after the requested ROS environment exists and network/process startup is authorized. Xacro validation does not prove ROS runtime or real robot acceptance.

For walking ask Cyclo Lab or Cyclo MJLab, then use [walking](../skills/ai-sapiens-walking/SKILL.md). Check actual prerequisites and executor before a bounded environment-list/simulation smoke test. If Python/ROS/simulator/GPU prerequisites are missing, identify that boundary and deliver the preparation steps; do not start downloads, GPU training or a substitute environment implicitly.

Scaffold sources: [Jazzy mock components](https://control.ros.org/jazzy/doc/ros2_control/hardware_interface/doc/mock_components_userdoc.html), [controller manager/spawner](https://control.ros.org/jazzy/doc/ros2_control/controller_manager/doc/userdoc.html), and the [pinned DHI plugin declaration](https://github.com/ROBOTIS-GIT/dynamixel_hardware_interface/blob/6bb5f93ecad1fe3c231e3ece580344e8f0a6efc3/dynamixel_hardware_interface_plugin.xml). The scaffold is a synthetic two-joint-style preparation aid, not a replacement for the product's real URDF, transmissions or driver lifecycle review.
