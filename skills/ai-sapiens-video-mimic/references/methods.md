# Select a Mimic method

Choose runtime, supported physics backend, robot revision and learning method
separately. BeyondMimic is `whole_body_tracking`-based PPO. SuperMimic learns a
world model and trains policies through imagined rollouts. MJLab also integrates
BlinkMimic's released world-model/policy recipe in an isolated worker. A task name
or an upstream G1 benchmark does not establish K1 convergence or robot readiness.

The read-only `cyclo_mimic` tool accepts `runtime`, `method`, `stage`. It supplies
checkout requirements and artifact guidance, never detects a local installation
or executes setup, training, export or robot operations. `blinkmimic` is supported
only with `mjlab`; unsupported pairs and explicit CLI algorithm/task mismatches
must fail rather than fall back to PPO. Backend, representation and revision are
consumer CLI choices, not additional MCP input fields.

## Reviewed sources and runtime boundaries

- Lab remains pinned to [3cbd6259](https://github.com/ROBOTIS-GIT/cyclo_lab/blob/3cbd62592750ee0095df67f54399a0a320164e29/docs/supermimic.md).
- MJLab **1.1.0 main** is reviewed at [e17230e2770aeee4ecfebeb4ea84012475a25397](https://github.com/ROBOTIS-GIT/cyclo_mjlab/tree/e17230e2770aeee4ecfebeb4ea84012475a25397), including its [CLI dispatcher](https://github.com/ROBOTIS-GIT/cyclo_mjlab/blob/e17230e2770aeee4ecfebeb4ea84012475a25397/scripts/reinforcement_learning/cli.py), task registries, Docker, checkpoint and exporter implementations. Older feature-branch documents are not this main revision's contract.

| Runtime / method | Environment and task selection | Checkpoints and export |
| --- | --- | --- |
| Lab / BeyondMimic | Branch-pinned Isaac runtime; existing Cyclo NPZ | Existing RSL-RL PPO checkpoint/export contract |
| Lab / SuperMimic | Isaac Sim 6.2 / Isaac Lab 3.0 / Python 3.12; Newton/MJWarp or explicit PhysX; GenCoord/MaxCoord | Strict v3 `--checkpoint`; no validated robot export/controller contract |
| MJLab / BeyondMimic | Python 3.12 / stable MJLab 1.6.1; Rev.1/Rev.2 Dance tasks | Existing RSL-RL `model_*.pt`; PPO play exports ONNX/TorchScript |
| MJLab / SuperMimic | Same native MJLab runtime; GenCoord/MaxCoord and Rev.1/Rev.2 | Combined checkpoints and legacy split inference bundles; method-specific ONNX exporter |
| MJLab / BlinkMimic | Same locked runtime; selected submodule runs in a separate process; Rev.1/Rev.2 | Native full/latest and model-only snapshots; method-specific FP32 ONNX exporter |

Lab's `third_party/supermimic` remains at `10dd5dd3f02601caf1991790952a25db63a6fb99`
(official HybridRobotics `abc124c1` lineage). Do not update Lab instructions or
submodules merely because MJLab changed.

MJLab's actual gitlinks are:

| Path | Repository / pinned commit |
| --- | --- |
| `third_party/supermimic` | [ROBOTIS-GIT/supermimic](https://github.com/ROBOTIS-GIT/supermimic/tree/a03f646d79bd92136b18095388b064e2ebe6dced), `a03f646d79bd92136b18095388b064e2ebe6dced`; PATCHES.md records official HybridRobotics `698ea39b` lineage |
| `third_party/blinkmimic` | [ROBOTIS-GIT/blinkmimic](https://github.com/ROBOTIS-GIT/blinkmimic/tree/029f4092be88654807849478b3188cf708a3fdc8), `029f4092be88654807849478b3188cf708a3fdc8`; consumer records released upstream `d264658d` |
| `third_party/ai_sapiens` | `0f1ca21e657c27aacd8a84d9ad3f1c7284c1aa03` |

Keep provenance and licenses. Shared core source does not make Lab/MJLab physics,
archives, actions or dependency environments interchangeable. Do not install an
upstream research extra or substitute its standalone lock for consumer dependencies.

## Lab contract (unchanged)

Lab common `scripts/reinforcement_learning/train.py` and `play.py` use `--task`
with optional `--algorithm beyondmimic|supermimic`. Historical task aliases and
direct launchers, including `mimic.py --method`, remain. Current Lab 6.2 PPO
train/play share task IDs; older checkouts may require separate `-Play` IDs.

SuperMimic supports GenCoord and MaxCoord K1, privileged `rep_state`, history 1,
one clip/encoder, fixed dynamics and zero context. Proprio/history deployment,
motion-to-velocity latent BC, official return sampling and multi-task/multi-clip
remain outside this reviewed Lab scope. Newton/MJWarp is inherited by default;
explicit PhysX uses `physics=isaacsim_physx` or `--physics isaacsim_physx`.
Representation is independent of Dance1/Dance2. Conflicting physics flags fail;
Newton solver `num_substeps=1` differs from policy decimation. No silent fallback.

Use the native Isaac environment and `requirements/supermimic.txt` as needed
under authorized setup. A MuJoCo sidecar is not Lab support.

```bash
python scripts/reinforcement_learning/train.py --algorithm supermimic \
  --task Cyclo-SuperMimic-K1-Rev1-Dance1 --motion-file /data/k1_motion.npz \
  --representation gencoord --num-envs 2 --iterations 1 --eager --headless
# Add physics=isaacsim_physx for explicit PhysX; use --representation maxcoord for MaxCoord.
python scripts/reinforcement_learning/play.py --algorithm supermimic \
  --checkpoint logs/supermimic/RUN/model_1.pt --num-envs 1 --play-steps 100 --eager --headless
```

Repeat compatible nondefault physics overrides during playback/continuation.
Lab `cyclo-supermimic-isaac-v3` checks task, physical model, motion digest, exact
timestep/decimation, representation and observations/actions. Strictly compatible
legacy v2 loading is limited to explicit PhysX/GenCoord. Continuation restores
learned/normalizer/optimizer state into fresh simulator/replay/RNG, not exact
trajectory resume. Lab's named NPZ selector requires explicit `quaternion_order`
or `quat_order`, reorders joints, converts to native xyzw, then bridges to algorithm
wxyz. It validates full-frame/body FK and source-defined COM profiles; missing
producer labels remain unspecified. Direct legacy PPO fallback behavior is unchanged.

Lab reported four bounded backend/representation train/continue/play cells and
both PPO backend regressions. Learner compilation and deployable proprio/history
remain unvalidated. This is historical consumer evidence, not a new plugin run.
Lab SuperMimic export/Sim2Real guidance still stops with “No validated K1
export/controller contract.” Preserve checkpoints; never rename them to ONNX.

## MJLab setup and task registry

Record commit, dirty state, submodule pins, robot revision and actual versions.
Check source parsers before invoking help: discovery can import simulator modules.
In an authorized checkout, initialize submodules with
`git submodule update --init --recursive`. The Dockerfile installs hashed
`requirements.lock`, then `--no-deps -e third_party/supermimic -e .`.
BlinkMimic is imported from its submodule in the selected worker; no separate
Python 3.13 research environment or invented `cyclo-blinkmimic` executable is needed.

The locked stack is Python 3.12, MJLab 1.6.1, MuJoCo/MuJoCo-Warp 3.11.0,
Warp 1.14.0 and Torch 2.14.0. The default image/container are
`cyclo-mjlab:latest` / `cyclo_mjlab`, cwd `/workspace/cyclo_mjlab`.
Review mounts, resource budget and existing jobs before authorized
`./docker/container.sh start` and `enter`. A git update does not upgrade an old
image: `build` followed by `recreate` replaces the container, preserving mounted
source/logs/cache but discarding its writable layer. Never recreate active user
work as an incidental setup step. `docker/check_environment.py` checks runtime;
`--gpu` also executes a CUDA tensor operation. Neither establishes training success.

| Method | Exact registered tasks |
| --- | --- |
| SuperMimic Rev.1 | `Cyclo-SuperMimic-GenCoord-K1-Rev1-001`, `Cyclo-SuperMimic-MaxCoord-K1-Rev1-001` |
| SuperMimic Rev.2 | `Cyclo-SuperMimic-GenCoord-K1-Rev2-001`, `Cyclo-SuperMimic-MaxCoord-K1-Rev2-001` |
| BlinkMimic | `Cyclo-BlinkMimic-K1-Rev1-001`, `Cyclo-BlinkMimic-K1-Rev2-001` |
| BeyondMimic PPO | `Cyclo-BeyondMimic-K1-Rev1-Dance1`, `Cyclo-BeyondMimic-K1-Rev1-Dance2`, and the corresponding `Rev2` tasks |

Current MJLab has no `Cyclo-Mimic-*` registration and no old SuperMimic IDs without
`-001`. This registry change does not change older checkouts or Lab aliases.
Common `train.py` / `play.py` take a positional task and optional
`--algorithm beyondmimic|supermimic|blinkmimic`; an explicit mismatch fails.
`python scripts/reinforcement_learning/train.py --algorithm blinkmimic --list-tasks`
is the family discovery form. The installed `cyclo-supermimic train|play|convert|smoke`
entry point remains; `convert` is optional and defaults to `--robot k1_rev2`, so
specify the intended robot explicitly when using it.

Task `001` defaults to both Dance1/Dance2 NPZs for the selected revision.
Do not infer revision from a 23-joint shape or rename Rev.1 data/checkpoints as Rev.2.
Motion conversion/replay scripts default to Rev.2; Rev.1 requires the matching
explicit `--model` (see [motion conversion](motion.md)).
SuperMimic fresh training defaults to `proprio`, history 10; checkpoint settings
are authoritative on reload. BlinkMimic uses the pinned `presets.sh` main recipe,
with full latest checkpoints and numbered snapshot retention. `--execution official`
is default; `compiled_no_torch_graphs` explicitly changes systems settings while
preserving learner settings. No automatic resource reduction or PPO fallback.

## MJLab motion and training examples

Keep original CSV/NPZ bytes and 50 Hz rate. Both adapters validate selected-robot
joint/body names, shapes, real/float32-safe values, normalized quaternions and
physical conventions. Complete named body states are checked against FK and
supported link-origin/current-COM/historical-COM profiles. Missing producer labels
remain unspecified. Conflicting or ambiguous conventions fail. Root-only inputs
require `backend=mujoco`, `quaternion_order=wxyz`, `velocity_frame=world`,
`velocity_point=link_origin`. This does not establish arbitrary Isaac NPZ compatibility.

SuperMimic accepts optional `--motion-file` as a single file, comma list or quoted
glob; an internal `.supermimic-data/adapter/` cache is derived without modifying
source files. No separate conversion CLI is required. BlinkMimic prepares task
motions automatically, or accepts a custom **prepared library** via `--motion-dir`.
Its prepare command writes byte-preserving copies plus a hashed
`cyclo.blinkmimic.exact-state.v1` manifest. Clip basenames must be unique. The exact
loader does not resample or re-differentiate NPZ states.

Prepared examples from the reviewed MJLab root (not executed jobs):

```bash
WANDB_MODE=offline python scripts/reinforcement_learning/train.py \
  --algorithm supermimic Cyclo-SuperMimic-GenCoord-K1-Rev2-001 \
  --motion-file /data/k1_rev2_motion.npz --num-envs 64 --runner.max-iterations 100

# Optional custom BlinkMimic library; built-in task motions need no preparation CLI.
python -m source.tasks.blinkmimic.prepare --task Cyclo-BlinkMimic-K1-Rev2-001 \
  /data/k1_rev2_motion.npz --output /data/new_blink_library
WANDB_MODE=disabled python scripts/reinforcement_learning/train.py \
  --algorithm blinkmimic Cyclo-BlinkMimic-K1-Rev2-001 \
  --motion-dir /data/new_blink_library --iterations 100
```

BlinkMimic does not take SuperMimic's `--motion-file` or `--runner.*` options.
Small iteration targets do not guarantee cheap compilation/buffers; agree resources
before execution. Offline local operation needs no W&B synchronization. Network
logging, authenticated retrieval and a listening viewer require their own scope.

## MJLab resume versus playback

| Method | Latest / historical checkpoint | Continuation |
| --- | --- | --- |
| SuperMimic | `logs/supermimic/<task>/<run>/last.pt`; `checkpoints/model_<step>.pt` | Combined `cyclo.supermimic.checkpoint.v1`: models, available optimizers and sampler state; numbered snapshots omit optimizers. Legacy split `manifest.json`/`actor.pt`/`world_model.pt` remains inference-only. |
| BlinkMimic | `logs/blinkmimic/<task>/<run>/last.pt`; `model_<iteration>.pt` | Latest full native state restores models/optimizers; numbered snapshots are model-only and warn that optimizers restart. Preserve `args.json`, `run-record.json` and motion manifest. |

Both train selectors use `--agent.resume True --agent.load-run RUN
--agent.load-checkpoint last.pt`. A checkpoint can be an absolute path.
SuperMimic `--runner.max-iterations` and BlinkMimic `--iterations` are **total**
targets that must exceed saved progress, not additional update counts. Both restart
simulation and replay. Same-robot clip/task transfer is compatibility-checked and
sampler state is remapped; it is not arbitrary cross-revision transfer or exact
trajectory resume. `--world-model-checkpoint` initializes dynamics in a fresh run,
not policy/optimizer continuation, and cannot be combined with resume.

```bash
python scripts/reinforcement_learning/train.py --algorithm supermimic \
  Cyclo-SuperMimic-GenCoord-K1-Rev2-001 --agent.resume True \
  --agent.load-run RUN --agent.load-checkpoint last.pt --runner.max-iterations 200
python scripts/reinforcement_learning/train.py --algorithm blinkmimic \
  Cyclo-BlinkMimic-K1-Rev2-001 --agent.resume True \
  --agent.load-run RUN --agent.load-checkpoint last.pt --iterations 200
```

SuperMimic play takes exactly one `--checkpoint FILE`, `--checkpoint-dir RUN` or
optional `--wandb-path`. A run directory prefers `last.pt`, otherwise reads a split
bundle; omitted selection searches the latest task run. Strict manifest checks
cover task/representation, actor mode, robot/action order and timestep/decimation.
BlinkMimic play accepts a numbered `model_N.pt` (legacy `ckpt_N.pt` also accepted)
or selects the highest numbered file in `--checkpoint-dir`; **its play selector
does not accept `last.pt`**. Omitted selection searches the latest saved training
run. Motion library recovery uses the run record; provide `--motion-dir` when needed.

```bash
python scripts/reinforcement_learning/play.py --algorithm supermimic \
  Cyclo-SuperMimic-GenCoord-K1-Rev2-001 \
  --checkpoint-dir logs/supermimic/Cyclo-SuperMimic-GenCoord-K1-Rev2-001/RUN \
  --motion-file /data/k1_rev2_motion.npz --viewer headless --num-steps-rollout 100
# Viser opens a listening viewer; use only within authorized network scope.
python scripts/reinforcement_learning/play.py --algorithm blinkmimic \
  Cyclo-BlinkMimic-K1-Rev2-001 \
  --checkpoint-dir logs/blinkmimic/Cyclo-BlinkMimic-K1-Rev2-001/RUN \
  --viewer viser --num-steps 100
```

BlinkMimic headless evaluation uses its isolated upstream evaluator; do not assume
Viser's `--num-steps` bounds that path. Playback may write exports and evaluation
logs; it is not a read-only checkpoint inspection operation.

## MJLab ONNX and Sim2Real artifacts

Both methods now have an explicit policy-only exporter. Do not retain the obsolete
blanket statement that MJLab SuperMimic has no exporter. The common entry point is
`scripts/reinforcement_learning/export.py --algorithm supermimic|blinkmimic`.
It does not replace PPO's existing play/export flow.

```bash
python scripts/reinforcement_learning/export.py --algorithm supermimic \
  Cyclo-SuperMimic-GenCoord-K1-Rev2-001 \
  --checkpoint logs/supermimic/Cyclo-SuperMimic-GenCoord-K1-Rev2-001/RUN/last.pt \
  --encoder motion --output-dir /data/new_super_export
python scripts/reinforcement_learning/export.py --algorithm blinkmimic \
  Cyclo-BlinkMimic-K1-Rev2-001 \
  --checkpoint logs/blinkmimic/Cyclo-BlinkMimic-K1-Rev2-001/RUN/model_1000.pt \
  --output-dir /data/new_blink_export
```

- **SuperMimic:** explicit output contains `policy.onnx`, `metadata.json` and
  software notices/licenses. Default/play output for a combined checkpoint is
  `<run>/exported/<checkpoint-stem>/`; legacy split bundles use `<run>/exported/`.
  Play refreshes active encoders by default. Non-motion encoders use a `velocity/`
  subdirectory. Training writes `params/sim2real.yaml` and, when active,
  `params/velocity/sim2real.yaml`. `--encoder velocity` requires a saved encoder;
  inspect its trained slot fraction rather than assuming it was trained.
  Graph inputs/outputs are `obs`/`actions`, with frozen normalization and
  **term-major** history followed by external goals. No world model or motion
  table is embedded. Privileged `rep_state` export requires history 1 and is not
  made deployable by relabeling it `proprio`.
- **BlinkMimic:** explicit output contains `exported/policy.onnx`, `metadata.json`
  and software notices/licenses; pair it with the training run's
  `params/sim2real.yaml`. Viser playback refreshes the run export; headless
  evaluation is a separate path. Export loads saved **`pi`**, not `pi_live`.
  The FP32 graph uses `observations`/`actions`, **frame-major** temporal history
  followed by future goals. Normalization and configured reference skip are
  inside the graph: do not normalize or add the reference action twice.
  FP32 policy equivalence does not promise bitwise BF16 CUDA equivalence. The
  exporter reconstructs using the selected task robot and does not enforce the
  checkpoint `args.robot` label; independently verify revision/run provenance.

The exporters do not embed reference clips or prove hardware readiness. Preserve
matching checkpoint, task/revision, robot/joint order, exact timing, history reset,
external-goal construction, action transforms, metadata and YAML. Check the actual
target controller supports `cyclo.supermimic.external_goal.v1` or BlinkMimic's
`cyclo.blinkmimic.csv.v1` YAML / `cyclo.blinkmimic.external_goal.v1` graph contract.
Keep matching deployment motion CSV and its provenance; CSV-derived velocities
and NPZ exact-state training are not automatically equivalent. Do not reuse PPO
YAML or force method-specific export folders into the legacy audit helper.
That helper checks layout/hashes only, not these controller semantics.

This revision was inspected without training, Docker startup or robot operations.
Source tests include synthetic ONNX equivalence and checkpoint/resume cases; their
presence is not an observed run or a Rev.1/Rev.2 acceptance matrix. Report conversion,
real optimizer updates, reload, play, export, Sim2Sim and hardware evidence
separately. No plugin test establishes convergence, old trained-policy compatibility
or real-robot safety. Deployment and live actuation remain separately authorized
operations with the target-specific Sim2Real review.
