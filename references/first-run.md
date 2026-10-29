# First use and first success

Choose the user's goal before setup: official manual/model selection, DYNAMIXEL configuration, robot-arm software integration or AI Sapiens learning/deployment preparation. An explanation or selection question needs no device connection. Installing this package creates no hardware permission, GPU executor or credentials.

## Prepare the package

Extract the ZIP, preserving its `cyclo-plugin` directory. In that directory use Node >=22 and Python >=3.9. Install local Node dependencies with `npm ci --ignore-scripts --no-audit --no-fund`. For offline validation use a separate Python environment with `python3 -m pip install -r validation/requirements.txt`, then `npm test`. Do not install globally. Missing tools are prerequisites, not permission to modify system packages.

Use the host's supported private/local plugin flow. The portable root manifest declares two local stdio servers, both hardware-ready by default, with no startup device I/O. A cloud upload alone does not run Node. After host installation, start a fresh conversation and invoke the Cyclo Skill using the [active host's syntax](hosts.md): `$cyclo` in Codex, `/cyclo-plugin:cyclo` in Claude Code, or the host's declared setup entrypoint. Ask a manual question; when product MCP tools are available, `robotis_sources` and `dynamixel_registry` are local, device-free first-success checks. If tools are absent, report that installation/runtime boundary and provide the relevant Skill guidance; do not claim a successful tool call or reinstall repeatedly.

Examples: “Help me select a DYNAMIXEL for my application”, “Explain current-based position control”, “Help me prepare robot-arm DHI and ROS 2 control configuration”, “Prepare AI Sapiens walking-policy training”. For model selection ask required continuous load/torque-speed, voltage, interface, size and environment, then retrieve exact official specifications. Do not choose from stall torque alone or substitute a related model.

## Unknown actuator: discover, choose, configure

For custom models, customer-supplied Control Tables, or a requested transport/rate outside the bundled provider, first use [custom devices and external Control Tables](custom-control-tables.md). The catalog selection steps below apply to the product MCP; do not force a custom device into a different catalog model or require another approval solely because a compatible external executor is needed. Preserve actual operator policy restrictions and source/live prerequisite checks.

Live tools are available, but a concrete bus/operation must be authorized and its runtime configured before use. Use mocks when live access is outside scope. Without an operator file, explicitly confirmed port listing and a bounded scan using `port` can establish an observed target; no global unlock is required. An optional port-only operator config can persist or restrict discovery without knowing model, firmware, current ID or baud:

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

The placeholder is not a discovered device. Without an operator file, a customer-authorized `dynamixel_ports({confirmed:true})` can list adapters, followed by a bounded scan on the explicitly selected `port`. Do not create a configuration file merely to unlock normal use. An optional restrictive policy can set `allowPortDiscovery:false` or scan-only buses; preserve those choices and use its named bus/target rather than a dynamic alias. Prepare the local product Python dependency only in an operator-selected environment. No global enable flag is required. `CYCLO_OFFLINE=1` requests device-free planning; legacy module flags set to `0` also disable their respective module. Preserve the task's scope and host settings.

1. Ask which bounded IDs/rates/protocols to inspect. For example `{bus:"bench", ids:[1,2,3], protocols:[1,2], bauds:[57600,1000000]}` is a small initial range, not a universal scan or default identity. Call `dynamixel_scan` first with its default dry run. A full matrix may need explicit bounded batches; do not broaden automatically.
2. Execute only the agreed read-only scan with `dryRun:false, confirmed:true`. Zero responders: inspect completeness/errors, power/interface/port/rate assumptions; do not infer an absent device. Multiple responders: show identities/rates, ask which device, select the exact port/protocol/baud/ID and verify unique addressing. Unknown identity or unresolved capability: inspect its exact source record; do not guess a register. Dual-axis modules require both observed endpoints and explicit pairing.
3. A complete scan with confirmed closure/released bus lease returns short-lived `scanId` and `candidateId`. Ask for explicit selection and unique addressing, including no conflicting secondary listeners; call `dynamixel_select` with those tokens, a new target name, `confirmed:true`, `addressingVerified:true`. It creates a session handle only if the bus already permits configuration. A scan-only grant cannot be upgraded by selection. Port replacement, newer observations, expired tokens or context changes require re-identification. Even one responder is not automatically selected.
4. Validate the requested named change with `dynamixel_configure`'s default dry run. Confirm the exact target, effect and intended values before the real call; pass `dryRun:false, confirmed:true` only after that user approval. Execution rechecks model/firmware/protocol/snapshot, torque already off, verified addressing and destination collision. ID and baud changes are separate operations; no torque or position goal is sent.
5. On fully verified change with confirmed closure and released reservation, the session target advances to the observed new ID/baud. The next operation on that name uses the new location and re-verifies identity. Dry runs never advance it. Failed/uncertain operations or changed binding block further writes. Confirm closure and exclusivity, then rescan and explicitly select a new handle for reconciliation. Never repeat an uncertain write automatically.
6. `dynamixel_targets` shows ready/blocked state, revision and current location. Handles and observations are session-local. Operator config files are never silently rewritten; restart requires fresh discovery/selection or an explicitly reviewed current target config. Do not copy a blocked candidate location into config as if verified.

All indexed actuator records use one source-bound capability engine; absence/unresolved conditions block only that operation. No physical-device certification is implied. Full snapshot continuity checks are stronger than a destination-ID reply but cannot establish a unique physical serial identity when the hardware provides none; verified addressing and operator confirmation remain necessary. The [generic Control Table tools](control-table-runtime.md) also handle source-resolved Torque Enable, Operating Mode and goal items after the customer explicitly requests them. No unknown raw address, reset, recovery or flashing action is inferred. The current inventory retains two unresolved manufacturer write contracts: Current(68) on original MX-64/MX-106. Do not guess their semantics or promise physical-device certification.

## Robot arm and learning preparation

For ROS 2/DHI, read [integration guidance](../skills/robotis-integrate/references/ros-sdk.md). Collect the actual platform URDF, joint/actuator mapping, distribution and versioned model tables. For a new isolated mock scaffold use `python3 scripts/prepare_ros2_mock.py SPEC.json NEW_OUTPUT_DIRECTORY`; [synthetic fixture](../tests/fixtures/arm-mock-spec.json) shows required fields and is not a calibrated product configuration. The generator preserves existing files and emits Xacro, controller YAML, a mock-only launch file and a separate DHI review plan. Expand with `xacro`, inspect joint/interface consistency, and keep the real DHI plugin out of mock bringup. Launch only after the requested ROS environment exists and network/process startup is authorized. Xacro validation does not prove ROS runtime or real robot acceptance.

For walking ask Cyclo Lab or Cyclo MJLab, then use [walking](../skills/ai-sapiens-walking/SKILL.md). Check actual prerequisites and executor before a bounded environment-list/simulation smoke test. If Python/ROS/simulator/GPU prerequisites are missing, identify that boundary and deliver the preparation steps; do not start downloads, GPU training or a substitute environment implicitly.

Scaffold sources: [Jazzy mock components](https://control.ros.org/jazzy/doc/ros2_control/hardware_interface/doc/mock_components_userdoc.html), [controller manager/spawner](https://control.ros.org/jazzy/doc/ros2_control/controller_manager/doc/userdoc.html), and the [pinned DHI plugin declaration](https://github.com/ROBOTIS-GIT/dynamixel_hardware_interface/blob/6bb5f93ecad1fe3c231e3ece580344e8f0a6efc3/dynamixel_hardware_interface_plugin.xml). The scaffold is a synthetic two-joint-style preparation aid, not a replacement for the product's real URDF, transmissions or driver lifecycle review.
