# First use and first success

Choose the user's goal before setup: official manual/model selection, DYNAMIXEL configuration, robot-arm software integration or AI Sapiens learning/deployment preparation. An explanation or selection question needs no device connection. Installing this package creates no hardware permission, GPU executor or credentials.

## Prepare the package

Extract the ZIP, preserving its `cyclo-ai` directory. Use Node >=22 and Python >=3.9.
The `-install.zip` release includes the MCP JavaScript dependencies, pyserial and
PyYAML: run `node scripts/doctor.mjs --hardware-deps`, then load the directory in
your host. No npm/pip install or virtual environment is needed. Keep the whole
extracted directory together when copying it to a host cache. ROS, training and
simulation dependencies are not included.

For the source ZIP or a Git checkout only: Run `npm ci --ignore-scripts`, `npm run setup`, and `npm run doctor -- --hardware-deps`. Setup creates a local virtual environment without accessing devices. For offline validation use a separate Python environment with `python3 -m pip install -r validation/requirements.txt`, then `npm test`. Do not install globally. Missing tools are prerequisites, not permission to modify system packages.

Use the host's supported private/local plugin flow. The portable root manifest declares one local stdio server, hardware-ready by default, with no startup device I/O. A cloud upload alone does not run Node. After host installation, start a fresh conversation and invoke the Cyclo Skill using the [active host's syntax](hosts.md): `$cyclo` in Codex, `/cyclo-ai:cyclo` in Claude Code, or the host's declared setup entrypoint. Ask a manual question; when product MCP tools are available, `robotis_sources` and `dynamixel_registry` are local, device-free first-success checks. If tools are absent, report that installation/runtime boundary and provide the relevant Skill guidance; do not claim a successful tool call or reinstall repeatedly.

Examples: “Help me select a DYNAMIXEL for my application”, “Explain current-based position control”, “Help me prepare robot-arm DHI and ROS 2 control configuration”, “Prepare AI Sapiens walking-policy training”. For model selection ask required continuous load/torque-speed, voltage, interface, size and environment, then retrieve exact official specifications. Do not choose from stall torque alone or substitute a related model.

## Unknown actuator: discover, choose, configure

For custom models, customer-supplied Control Tables, or a requested transport/rate outside the bundled provider, first use [custom devices and external Control Tables](custom-control-tables.md). Import a reviewed custom profile first, then use the same product MCP selection steps below. Do not force a custom device into a different catalog model or require another approval solely because a custom profile is needed. Preserve actual operator policy restrictions and source/live prerequisite checks.

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

The placeholder is not a discovered device. Without an operator file, a customer-authorized `dynamixel_ports({confirmed:true})` can list adapters, followed by a bounded scan on the explicitly selected `port`. Do not create a configuration file merely to unlock normal use. An optional restrictive policy can set `allowPortDiscovery:false` or scan-only buses; preserve those choices and use its named bus/target rather than a dynamic alias. Prepare the local product Python dependency only in an operator-selected environment. Serial and explicit TCP/UDP bridge endpoints use the standalone product provider; no external device CLI is required. No global enable flag is required. `CYCLO_OFFLINE=1` requests device-free planning; legacy module flags set to `0` also disable their respective module. Preserve the task's scope and host settings.

1. Resolve the requested bus, IDs, rates and protocols from the user's command and observed adapter information. Ask only when that scope is missing or ambiguous. A preview is available through `dryRun:true`; it is optional when the request already specifies an executable operation.
2. Scan with `dryRun:false, confirmed:true`. Inspect identities and communication errors. Multiple responders are normal on a robot bus; select the requested set without asking again when the user's command identifies it. Unknown tables can be imported using the custom-table workflow. Pair dual-axis endpoints from actual observations.
3. A complete scan returns `scanId` and `candidateId` values. Use `dynamixel_select` or `dynamixel_select_many` to create named targets. Read-only buses stay read-only. Selection and reads do not require a claim that addressing is unique; writes independently require that verification. Reuse the scan for other candidates until it expires or a bus operation invalidates it.
4. Read named items or execute the requested source-resolved change. The existing concrete user command supplies `confirmed:true`; do not ask for redundant approval. Writes check actual identity, documented conditions and destination collisions. A prerequisite such as torque-off follows the device's contract, rather than a universal rule for all devices.
5. A verified transition updates the target's ID/baud. If an operation is uncertain, inspect its partial result and establish transport closure before further access. Perform a fresh scan and reselect the blocked target under the same name. Never retry an uncertain write automatically.
6. `dynamixel_targets` shows ready/blocked state and current location. Session state does not silently rewrite operator config. On restart, rediscover devices or use an explicitly maintained target config.

All indexed actuator records use one source-bound capability engine; absence/unresolved conditions block only that operation. No physical-device certification is implied. Full snapshot continuity checks are stronger than a destination-ID reply but cannot establish a unique physical serial identity when the hardware provides none; verified addressing and operator confirmation remain necessary. The [generic Control Table tools](control-table-runtime.md) also handle source-resolved Torque Enable, Operating Mode and goal items after the customer explicitly requests them. No unknown raw address, reset, recovery or flashing action is inferred. The current inventory retains two unresolved manufacturer write contracts: Current(68) on original MX-64/MX-106. Do not guess their semantics or promise physical-device certification.

## Robot arm and learning preparation

For ROS 2/DHI, read [integration guidance](../skills/robotis-integrate/references/ros-sdk.md). Collect the actual platform URDF, joint/actuator mapping, distribution and versioned model tables. For a new isolated mock scaffold use `python3 scripts/prepare_ros2_mock.py SPEC.json NEW_OUTPUT_DIRECTORY`; [synthetic fixture](../tests/fixtures/arm-mock-spec.json) shows required fields and is not a calibrated product configuration. The generator preserves existing files and emits Xacro, controller YAML, a mock-only launch file and a separate DHI review plan. Expand with `xacro`, inspect joint/interface consistency, and keep the real DHI plugin out of mock bringup. Launch only after the requested ROS environment exists and network/process startup is authorized. Xacro validation does not prove ROS runtime or real robot acceptance.

For walking ask Cyclo Lab or Cyclo MJLab, then use [walking](../skills/ai-sapiens-walking/SKILL.md). Check actual prerequisites and executor before a bounded environment-list/simulation smoke test. If Python/ROS/simulator/GPU prerequisites are missing, identify that boundary and deliver the preparation steps; do not start downloads, GPU training or a substitute environment implicitly.

Scaffold sources: [Jazzy mock components](https://control.ros.org/jazzy/doc/ros2_control/hardware_interface/doc/mock_components_userdoc.html), [controller manager/spawner](https://control.ros.org/jazzy/doc/ros2_control/controller_manager/doc/userdoc.html), and the [pinned DHI plugin declaration](https://github.com/ROBOTIS-GIT/dynamixel_hardware_interface/blob/6bb5f93ecad1fe3c231e3ece580344e8f0a6efc3/dynamixel_hardware_interface_plugin.xml). The scaffold is a synthetic two-joint-style preparation aid, not a replacement for the product's real URDF, transmissions or driver lifecycle review.

Select multiple candidates from the same scan with `dynamixel_select_many`, or reuse the scan for successive `dynamixel_select` calls. Read-only buses create read-only targets; addressing verification is required before writes. A fresh completed scan can reconcile a blocked target using its original name. Large raw and Sync Read requests are batched automatically.
