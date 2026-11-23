# Deployable assets and target verification

Read [Sim2Real](https://docs.robotis.com/docs/systems/aisapiens/development_guide/sim2real/), [SSH](https://docs.robotis.com/docs/systems/aisapiens/development_guide/ssh/), [Sim2Sim](https://docs.robotis.com/docs/systems/aisapiens/development_guide/sim2sim/) and the current operation/RC guide before target actions. These examples are plans, not executed transfers or launches.

The SSH manual documents serial on the back label or controller LCD (SE button) and hostname k1-<SERIAL>.local on a shared reachable network. Example syntax after independent identity and host-key verification: `ssh root@k1-SERIAL.local`. Treat SERIAL as a placeholder and validate its literal value before constructing a command; do not interpolate untrusted strings into a shell. Use actual configured authentication. A documented factory account is not evidence of current credentials. DNS/mDNS resolution and a familiar hostname alone do not prove robot identity. Never disable StrictHostKeyChecking or auto-accept a changed key. Stop on mismatch; ask for physical label/authorized inventory and trusted fingerprint. There is no serial lookup service bundled here.

The following helper checks the conventional run layout for any method, including BlinkMimic after Viser export. MJLab SuperMimic nested exports and standalone export directories require separate path review; use [method-specific contracts](../../ai-sapiens-video-mimic/references/methods.md), matching training YAML and controller evidence before staging. Lab SuperMimic remains unsupported for export.

The offline helper is read-only:

```bash
python3 skills/ai-sapiens-sim2real/scripts/asset_audit.py --run /absolute/training/run --kind velocity
python3 skills/ai-sapiens-sim2real/scripts/asset_audit.py --run /absolute/training/run --kind mimic --motion /absolute/converted/my_motion.csv
```

It checks nonempty regular files, containment of policy/config in one run, rejects symlinks, and returns a SHA-256 inventory. The motion can reside outside the run because the manuals allow a matching reference from conversion; the operator must verify that it is the training motion. Copies from a mixed source run are not detectable by directory layout. No ONNX inference, YAML semantics, FPS or hardware safety validation is performed. Treat “layout checks passed” accordingly.

Stage under ai_sapiens_sim2real/assets/k1/locomotion/velocity/NAME/ for velocity or assets/k1/mimic/NAME/ for mimic. Preserve exported/policy.onnx, params/sim2real.yaml and for Mimic params/<motion_reference>.csv. Do not copy raw Soma-retargeter CSV as the deployment reference. Record original paths, hashes and task/run/commit in a task-local release record.

For velocity, add a state_behaviors entry with kind: policy and the new asset path, then change only existing Velocity.run. Preserve transitions. For Mimic, add kind: mimic, asset and motion, a new state with parent: Mimic and matching run, and an unused RC selector. Mimic is an abstract parent, not a directly selectable mode. Inspect actual config before choosing selector codes; do not replace existing mappings. Preserve backup and prepare a minimal diff plus explicit restore steps before transfer.

Review policy_joints versus robot_joint_order names/order, observation/action definitions and order, scales/offsets/clips and ONNX dimensions. Startup size checks can miss semantic errors. Review motion reference, FPS and playback range against training. Require operator review of these facts rather than asserting compatibility from layout.

Simulation preparation uses a new ai_sapiens development checkout and its container. Review/build according to the live Sim2Sim page only when authorized. Use its same assets/config with an explicit simulation command from ~/ros2_ws/src/ai_sapiens:

```bash
./run_k1_tmux.sh --sim --keyboard
# Alternatively choose exactly one documented input:
./run_k1_tmux.sh --sim --radiomaster-usb
./run_k1_tmux.sh --sim --dualsense
```

Confirm mujoco_hardware_interface and an isolated ROS/network context, with no real hardware services reachable. Inspect simulation gantry, Damping/ReadyPose and policy behavior. Container/network preparation is still an actual operation needing a real host, not an offline test provided by this package.

Before an authorized robot file transfer: resolve target identity, validate destination and free space, back up the exact config/assets, record remote original hashes and new hashes, stage a new version folder, inspect the config diff and verify bytes after transfer. Rollback restores prior config/assets from the recorded backup and verifies hashes. Restart/mode changes belong to a separately authorized live-operation plan with onsite operator.

A ROS launch normally publishes commands. Even a documented publisher-disabled diagnostic launch is a robot runtime action requiring authorization and does not prove actuator safety. Never launch it during asset inspection. Keep operator RC input and failsafes. API authority needs RC toggle plus heartbeat; heartbeat loss must not be presented as an emergency-stop guarantee. Use the current manual for actual Damping and shutdown behavior.

For an existing trusted export record, use optional [manifest consistency](provenance.md). It detects changed bytes and run/kind metadata conflicts against the supplied record, not original provenance or semantic compatibility.
