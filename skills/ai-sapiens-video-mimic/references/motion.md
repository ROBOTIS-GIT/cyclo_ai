# Video to Mimic

First read [method selection](methods.md). The training/registration and deployment examples below describe BeyondMimic PPO. SuperMimic and BlinkMimic need their selected native adapters and distinct resume/play/export contracts; BlinkMimic custom libraries use --motion-dir rather than --motion-file. Select the matching Rev.1/Rev.2 task and model before conversion.

Authoritative pages: [GEM-X](https://docs.robotis.com/docs/systems/aisapiens/motion_generation/gem-x/), [Soma-retargeter](https://docs.robotis.com/docs/systems/aisapiens/motion_generation_retargeting/soma_retargeter/), [Lab Mimic](https://docs.robotis.com/docs/systems/aisapiens/reinforcement_learning/cyclo_lab/mimic/) and [MJLab Mimic](https://docs.robotis.com/docs/systems/aisapiens/reinforcement_learning/cyclo_mjlab/mimic/). Review current instructions before running.

Use the ROBOTIS forks, git submodules and LFS assets, Python 3.12+ and a compatible CUDA/PyTorch stack for GEM-X. Follow its live setup guide in a separate venv. Scope model/dependency downloads explicitly; checkpoints may download automatically if omitted. Keep motion-generation dependencies separate from the native simulator environments, even when their Python versions match. Updated MJLab uses Python 3.12/stable MJLab 1.6.1 for all task families; consult the selected consumer lock.

```bash
# New authorized checkout only:
git clone --recursive https://github.com/ROBOTIS-GIT/GEM-X.git
# After following its documented environment/assets install, from GEM-X root:
python third_party/soma-retargeter/tools/generate_ai_sapiens_retarget_mjcf.py --check
python scripts/demo/demo_soma.py --video /data/clip.mp4 --output_root outputs --ckpt inputs/pretrained/gem_soma.ckpt --retarget --robot ai_sapiens_k1
```

Confirm actual frame rate, selected person and clip boundaries. Review overlay/global renders, K1 retarget preview, the matching BVH and clip_retarget_ai_sapiens_k1.csv under outputs/clip/. Reconstruction can fail with occlusion, camera motion or poor scale. Never claim visual similarity establishes safe contact dynamics.

For existing SOMA BVH/NPZ, use the standalone ROBOTIS soma-retargeter fork from its repo root. Requires venv 3.12+, LFS/submodules; headless CPU is supported. Missing STL files require checking the AI Sapiens submodule/LFS, not overwriting MJCF with --force. Validate MJCF dimensions using its documented helper. `--check` does not generate or overwrite.

```bash
python tools/generate_ai_sapiens_retarget_mjcf.py --check
python ./app/bvh_to_csv_converter.py --config ./assets/default_ai_sapiens_bvh_to_csv_converter_config.json --viewer null --input /data/motion.bvh --output-dir /data/k1-output
```

The AI Sapiens config uses target ai_sapiens and 23 joint CSV output. Raw SMPL/SMPL-H/SMPL-X NPZ requires the optional SOMA-X installation and matching licensed human model; inspect the relevant section for --human-model use. A mismatch is a stopping condition, not permission to coerce or rename the schema. SOMA BVH does not need that model. Inspect units/FPS/header against the current converter; fallback FPS is not a measured FPS.

Backend conversion examples (inside chosen training container; first copy the reviewed headered output to the indicated source path without destroying its original):

```bash
# Cyclo Lab: /workspace/cyclo_lab
python3 scripts/tools/motion/soma_retargeter_csv_converter.py -f source/cyclo_lab/data/motions/K1_rev1/my_motion/my_motion_soma.csv --output_name source/cyclo_lab/data/motions/K1_rev1/my_motion/my_motion.npz --headless
# Cyclo MJLab: /workspace/cyclo_mjlab; these Rev.1 examples explicitly override the Rev.2 model default.
python scripts/tools/motion/soma_retargeter_csv_converter.py --model third_party/ai_sapiens/ai_sapiens_description/mujoco/k1/k1.xml -f source/assets/motions/K1_rev1/my_motion/my_motion_soma.csv --output_name source/assets/motions/K1_rev1/my_motion/my_motion.npz
python scripts/tools/motion/replay_npz.py --model third_party/ai_sapiens/ai_sapiens_description/mujoco/k1/k1.xml -f source/assets/motions/K1_rev1/my_motion/my_motion.npz --validate-only
python scripts/tools/motion/replay_npz.py --model third_party/ai_sapiens/ai_sapiens_description/mujoco/k1/k1.xml -f source/assets/motions/K1_rev1/my_motion/my_motion.npz --loop
```

Current MJLab conversion/replay defaults use the Rev.2 model. For Rev.1, preserve the explicit `--model` above; inspect the selected model path for any other revision. CSV input quaternion order is separate from NPZ wxyz output; check `csv_to_npz.py --root-quat-order` against the source CSV.

Keep raw *_soma.csv distinct from the converted deployment CSV and training NPZ. Verify generated files rather than assuming output from exit status alone. Review motion before expensive training.

Lab: clone dance1_env_cfg.py in source/cyclo_lab/cyclo_lab/manager_based/mimic/config/k1_rev1/, set TRAJECTORY_FILE to the new NPZ, register task IDs in __init__.py using the checked-out Gym pattern (current Lab 6.2 shares train/play IDs; older branches may require separate -Play IDs), and inspect the registration source. `python3 scripts/tools/list_envs.py` starts Isaac Sim, so it is not an offline discovery command; run it only within authorized simulator scope.

MJLab: clone source/tasks/beyondmimic/config/k1_rev1/dance1_env_cfg.py as my_motion_env_cfg.py, rename its factory, set TRAJECTORY_FILE to the generated source/assets/motions NPZ, then import/register using register_mjlab_task in __init__.py and the existing runner. Keep the `Cyclo-BeyondMimic-` prefix, for example `Cyclo-BeyondMimic-K1-Rev1-MyMotion`: the common PPO launcher filters accepted task families. Verify with `python scripts/list_envs.py --keyword MyMotion`. Do not copy Gym registration into MJLab.

Reuse the actual checked-out template and manual rather than guessing changed class names. Show config/registration diffs for review. Train with the selected custom ID only after registration and execution authorization; evaluate exact checkpoint and compare reference motion. MJLab supports `--reference-ghost-offset 1.4,0,0` for side-by-side review. Deployment still requires same-run ONNX/config and converted motion CSV plus the Sim2Real review.
