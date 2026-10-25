# Independent Cyclo Plugin 0.5.0 review

Date: 2026-10-25. Reviewed the actual working tree at `/home/hc/Documents/Codex/2026-10-23/task/proart-ai-sapiens-development/cyclo-plugin`. Project source was not edited. All test I/O used injected fixtures or temporary generated files. No real serial discovery/device operation, OpenRB use, ROS/Zenoh robot connection, GPU job, global installation or credential access occurred.

## Findings requiring correction

1. **Generated ROS controller parameter wiring is incomplete.** In `scripts/prepare_ros2_mock.py`, the `forward_position_controller` spawner does not receive `--param-file controllers.yaml`. The controller-specific `joints` parameters are only in the `forward_position_controller` YAML node, while the file is passed only to `ros2_control_node`. No controller `params_file` is configured on the manager either. This can leave the later spawned controller without its required joints list, even though XML/YAML/AST tests pass. The Jazzy spawner's own implementation explicitly loads controller parameter files passed through `-p/--param-file` or its own ROS `--params-file`: https://raw.githubusercontent.com/ros-controls/ros2_control/jazzy/controller_manager/controller_manager/spawner.py . Pass the same generated YAML to the spawner and add an AST assertion for that dependency. This is a source-backed configuration defect; ROS runtime reproduction was unavailable and was not claimed.
2. **One remaining session-specific Skill sentence.** `skills/ai-sapiens-walking/SKILL.md` step 3 still says: “For this package's development/evaluation task they are not authorized.” That development-history sentence belongs in producer evidence rather than a reusable customer Skill. Permanent scope/authorization safeguards should remain.

No unsafe write/retarget defect was observed in the reviewed state-management paths. The explicit hardware-disabled default, operation permission checks, one-candidate selection, user confirmation/isolation, expired/cross-session/context-invalid token rejection, identity checks, closure/lease conditions and write lock after failure are coherent. Full snapshot continuity remains a heuristic on a physically isolated bus, not a unique serial identity proof; the first-run reference explicitly discloses that limit.

## Executed checks

- `node --test tests/selection.test.mjs tests/dynamixel.test.mjs tests/products-integration.test.mjs`: **40 passed**, no skipped/cancelled/failing tests. This includes actual local stdio initialize/list/call with injected fixtures; it is not installed-host invocation.
- `CYCLO_XACRO_TEST_PATH=/tmp/cyclo-v050-python PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s validation -p test_ros2_artifacts.py -v`: **3 passed**. This expands the generated Xacro with actual Xacro and checks XML/YAML/AST mappings and preservation of existing files; it does not run ROS.
- Additional isolated adversarial probe: after a mock ID write, changed the destination's unchanged Drive Mode snapshot while retaining the same model/firmware/new ID. `configure` returned `uncertain`, `Transition continuity mismatch: drive; stop without retargeting`, exactly one write, and confirmed closure. Settling that result retained the old location and changed the target to `reconciliation-required`. Thus an ID response alone did not count as continuity or silently advance the handle.

## Independent forward responses (English translation)

The historical evaluation used Korean prompts/responses. These translations preserve their meaning and recorded decisions; they are not new host acceptance results.

1. **First connection, unknown ID: help with setup.** An unknown ID does not block a port-only bounded read scan plan. The response asked for adapter and TTL/RS-485 interface, required authorized access and a confirmed port, then proposed a small ID/baud range. Zero responders require checking range/power/wiring; multiple responders require isolating the chosen device and rescanning. One responder is not selected automatically. Model/firmware, explicit choice and isolation precede setup; discovery permission is not a write grant.
2. **I changed to ID 7; turn on the LED.** A verified same-session result advances the selected handle to ID 7. The response would first inspect local dynamixel_targets for ready/current state, plan the allowed LED change and recheck device identity on execution. A user's statement alone or reconciliation-required state does not justify attaching an arbitrary new ID. Confirm closure/exclusivity and rescan/select before further writes. No torque or position goal is sent.
3. **Prepare robot-arm ROS 2 control and DHI Xacro.** The response requested exact platform, ROS distribution, real URDF/Xacro and joint-actuator mapping, separating SDK packets, DHI, controllers and Zenoh. Without real platform inputs it offered an isolated Jazzy mock scaffold, Xacro/controller checks and a DHI review plan, not a real driver/motor launch. Synthetic dimensions/limits are not calibration. Code review still found the controller-parameter wiring defect recorded above.
4. **Recommend a DYNAMIXEL.** The response asked for use case, continuous load/torque-speed, voltage, TTL/RS-485, size/weight and environment, then proposed comparing exact official specifications. It would not infer continuous capability from stall torque, availability from a surviving manual or a concrete recommendation without requirements. No connection was needed.
5. **Prepare AI Sapiens walking training.** The response asked Cyclo Lab or Cyclo MJLab and preserved an already selected environment/project. It would inspect OS, GPU/driver, container tools, storage and the real executor, prepare version-matched commands and a bounded environment smoke check. Installation does not supply a GPU; a large example training job is not started automatically. Experimental Isaac/Newton is distinct from the default stack. The remaining development-session sentence was separately flagged and later removed.

## Remaining evidence boundary

No installed Codex host installation/discovery/invocation was tested by this independent reviewer. No full ROS controller runtime, simulator task runtime, GPU training or physical-device acceptance was tested. The default hardware capability matrix was not expanded or recertified by these results.

## Follow-up verification of reported fixes

Both reported defects were corrected in the subsequently inspected working tree. The walking Skill's step 3 now retains scope-appropriate authorization without the producer-session prohibition. Both generated controller spawners now pass `--param-file` with `str(root / "controllers.yaml")`, and the artifact test parses each spawner's AST arguments to assert that exact file dependency. The generated spawners also have a bounded controller-manager wait.

Re-ran the affected actual-Xacro/artifact test file after those changes: **3 tests passed**. No new defect was observed in the affected fixes. This confirms source wiring and offline generated artifacts; no ROS runtime or hardware acceptance was added to the evidence.

## Final target-grant guard follow-up

Read the added `TargetSession.select` guard and ran the selection suite: **7 tests passed**, including rejection of a different supported model/firmware pair, a different ID and a different rate when the scan derives from a target-specific grant. The check runs before binding verification and target creation. Port-only buses remain the explicit operator-granted path for selecting an initially unknown supported identity; a scan-only bus cannot acquire configuration rights.

An additional isolated assertion verified the interaction with session continuation: after a verified, closed/released transition from ID1/57600 to ID7/1000000, a matching scan under the updated target grant can be explicitly selected into a new handle, whereas the old ID1/57600 observation is rejected as outside the current target-specific grant. No device I/O occurred. No new defect was observed in this permission correction.
