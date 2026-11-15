# Backend preparation and training

For Mimic, first select the [learning method](../../ai-sapiens-video-mimic/references/methods.md). These existing RSL-RL examples describe PPO. Runtime, physics backend and learner are independent; the version table is a dated packaged baseline, not detection of a feature checkout.

Read the selected setup and locomotion pages in [source map](../../../references/sources.md). The following are command examples, not executed jobs. Resolve every placeholder and check the checkout's CLI help before use. Commands run inside the indicated container unless labeled host.

| Backend | Checkout / runtime | Container cwd |
|---|---|---|
| Cyclo Lab PhysX | main; Isaac Sim 5.1.0 / Isaac Lab 2.3.0 | /workspace/cyclo_lab |
| Cyclo Lab Newton | k1/isaacsim-6-newton; Sim 6.0.1 / Lab 3.0.0-beta2; experimental K1 only | /workspace/cyclo_lab |
| Cyclo MJLab | Python 3.11, MJLab 1.2.0, MuJoCo/Warp 3.5.0, Warp 1.12.0 | /workspace/cyclo_mjlab |

On the real host, inspect OS, GPU/driver (`nvidia-smi` when installed), Docker/Compose (`docker version`, `docker compose version`), toolkit, storage and mounts. These inspection commands are host checks, not ROBOTIS wrappers. Missing tools are prerequisites, not permission to install system packages. Review current Isaac Sim GPU requirements for Cyclo Lab. Do not assume a GPU is provisioned by this plugin.

Host setup examples in a new authorized project folder:

```bash
# Choose exactly one checkout; never switch an unrelated existing checkout.
git clone --branch main --recurse-submodules https://github.com/ROBOTIS-GIT/cyclo_lab.git
# Alternative experimental checkout, only when selected:
git clone --branch k1/isaacsim-6-newton --recurse-submodules https://github.com/ROBOTIS-GIT/cyclo_lab.git cyclo_lab-newton
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
python3 scripts/tools/list_envs.py
python scripts/reinforcement_learning/rsl_rl/train.py --task Cyclo-Velocity-Flat-K1-Rev1-v0 --num_envs 4096 --headless
python scripts/reinforcement_learning/rsl_rl/play.py --task Cyclo-Velocity-Flat-K1-Rev1-Play-v0 --checkpoint logs/rsl_rl/k1_rev1_velocity/RUN/model_ITERATION.pt --num_envs 16 --headless
```

For selected Newton use the same task but `--viz none` instead of `--headless`; the Git branch selects physics. Do not mix branch versions or describe a visualization flag as backend selection.

Cyclo MJLab example:

```bash
cd /workspace/cyclo_mjlab
python scripts/list_envs.py
python scripts/reinforcement_learning/train.py Cyclo-Velocity-Flat-K1-Rev1-v0 --env.scene.num-envs 4096
python scripts/reinforcement_learning/play.py Cyclo-Velocity-Flat-K1-Rev1-v0 --checkpoint-file logs/rsl_rl/k1_velocity/RUN/model_ITERATION.pt --num-envs 1 --viewer native
# For export without viewer, replace --viewer native with --export-only.
```

Viser is available via `--viewer viser`; it may open a listening service. Do not expose it or alter firewall/network settings implicitly. Select explicit native or export-only mode when network exposure is outside scope.

The 4096 environments are the documented example, not a promise of available memory or a minimal smoke test. Agree resources before starting; a smaller count is an intentional adaptation that needs verification against the checkout. Collect logs, checkpoint, params/agent.yaml, env.yaml and sim2real.yaml. Evaluate a pinned checkpoint, confirm exported/policy.onnx and policy.pt exist, and preserve their run association. Both policy.onnx and sim2real.yaml must come from that run. No training or evaluation has been executed by this package build.

For BeyondMimic PPO, Cyclo Lab uses `Cyclo-Mimic-K1-Rev1-Dance1` and `Cyclo-Mimic-K1-Rev1-Dance1-Play`; MJLab uses the same `Cyclo-Mimic-K1-Rev1-Dance1` ID for train and play. Choose the custom registered IDs when using user motion. Cyclo Lab's example log root is cyclo_mimic_k1_rev1_dance1; MJLab uses k1_mimic for multiple dance tasks, so verify exact task/run provenance. Verify matching motion CSV in addition to policy/config.

On failure: preserve outputs; check task registration, GPU/driver/container versions, checkpoint path and memory errors. Do not retry full training to solve a conversion or export error. Success requires observed setup checks, an explicitly tracked job if launched, evaluation evidence and matched artifacts; prepared commands alone are “ready for execution”.
