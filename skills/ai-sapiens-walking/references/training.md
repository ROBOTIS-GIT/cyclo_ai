# Backend preparation and training

For Mimic, first select the [learning method](../../ai-sapiens-video-mimic/references/methods.md). These existing RSL-RL examples describe PPO. Runtime, physics backend and learner are independent; the version table is a dated packaged baseline, not detection of a feature checkout.

Read the selected setup and locomotion pages in [source map](../../../references/sources.md). The following are command examples, not executed jobs. Resolve every placeholder and check the checkout's CLI help before use. Commands run inside the indicated container unless labeled host.

| Backend | Checkout / runtime | Container cwd |
|---|---|---|
| Cyclo Lab PhysX | reviewed `3cbd6259`; Isaac Sim 6.2 / Isaac Lab 3.0; explicit `physics=isaacsim_physx` | /workspace/cyclo_lab |
| Cyclo Lab Newton | same reviewed `3cbd6259`; inherited Newton/MJWarp default | /workspace/cyclo_lab |
| Updated Cyclo MJLab | main 1.1.0 at e17230e2; Python 3.12, stable MJLab 1.6.1; root requirements.lock | /workspace/cyclo_mjlab |

On the real host, inspect OS, GPU/driver (`nvidia-smi` when installed), Docker/Compose (`docker version`, `docker compose version`), toolkit, storage and mounts. These inspection commands are host checks, not ROBOTIS wrappers. Missing tools are prerequisites, not permission to install system packages. Review current Isaac Sim GPU requirements for Cyclo Lab. Do not assume a GPU is provisioned by this plugin.

Host setup examples in a new authorized project folder:

```bash
# Choose exactly one checkout; never switch an unrelated existing checkout.
git clone https://github.com/ROBOTIS-GIT/cyclo_lab.git
git -C cyclo_lab checkout 3cbd62592750ee0095df67f54399a0a320164e29
git -C cyclo_lab submodule update --init --recursive
# Or choose MJLab:
git clone --recurse-submodules https://github.com/ROBOTIS-GIT/cyclo_mjlab.git
```

From the chosen repo root, after reviewing container configuration and authorization:

```bash
git submodule status --recursive
./docker/container.sh start
./docker/container.sh enter
```

Both start scripts can build/download and initialize submodules. Do not execute these during package validation. Keep experimental and default checkouts and container names separate. Check the current branch and actual versions inside the container before training.

Cyclo Lab PhysX example:

```bash
cd /workspace/cyclo_lab
# list_envs.py starts Isaac Sim; inspect task registration source for offline discovery.
python scripts/reinforcement_learning/rsl_rl/train.py --task Cyclo-Velocity-Flat-K1-Rev1-v0 --num_envs 4096 --headless physics=isaacsim_physx
python scripts/reinforcement_learning/rsl_rl/play.py --task Cyclo-Velocity-Flat-K1-Rev1-v0 --checkpoint logs/rsl_rl/k1_rev1_velocity/RUN/model_ITERATION.pt --num_envs 16 --headless physics=isaacsim_physx
```

For Newton on this pinned Lab checkout, omit the explicit PhysX override. Older branches use different runtime and visualization flags; do not transfer their `--viz none` convention to these launchers.

Cyclo MJLab example:

```bash
cd /workspace/cyclo_mjlab
python scripts/list_envs.py
python scripts/reinforcement_learning/train.py Cyclo-Velocity-Flat-K1-Rev1-v0 --env.scene.num-envs 4096
python scripts/reinforcement_learning/play.py Cyclo-Velocity-Flat-K1-Rev1-v0 --checkpoint-file logs/rsl_rl/k1_velocity/RUN/model_ITERATION.pt --num-envs 1 --viewer native
# For export without viewer, replace --viewer native with --export-only True.
```

Viser is available via `--viewer viser`; it may open a listening service. Do not expose it or alter firewall/network settings implicitly. Select explicit native or export-only mode when network exposure is outside scope.

The 4096 environments are the documented example, not a promise of available memory or a minimal smoke test. Agree resources before starting; a smaller count is an intentional adaptation that needs verification against the checkout. Collect logs, checkpoint, params/agent.yaml, env.yaml and sim2real.yaml. Evaluate a pinned checkpoint, confirm exported/policy.onnx and policy.pt exist, and preserve their run association. Both policy.onnx and sim2real.yaml must come from that run. No training or evaluation has been executed by this package build.

For BeyondMimic PPO, current Cyclo Lab 6.2 uses `Cyclo-Mimic-K1-Rev1-Dance1` for both train and play. MJLab main 1.1.0 registers `Cyclo-BeyondMimic-K1-Rev1-Dance1` and its Dance2/Rev2 variants; legacy Cyclo-Mimic aliases are absent in this revision. Older Lab branches may require `-Play`; inspect registration instead of appending it unconditionally. Choose the custom registered IDs when using user motion. Cyclo Lab's example log root is cyclo_mimic_k1_rev1_dance1; MJLab uses k1_mimic for multiple dance tasks, so verify exact task/run provenance. Verify matching motion CSV in addition to policy/config.

On failure: preserve outputs; check task registration, GPU/driver/container versions, checkpoint path and memory errors. Do not retry full training to solve a conversion or export error. Success requires observed setup checks, an explicitly tracked job if launched, evaluation evidence and matched artifacts; prepared commands alone are “ready for execution”.
