# Select a Mimic method

Choose **runtime** (Cyclo Lab or Cyclo MJLab), **physics backend** supported by
that checkout, and **learning method** independently. Existing Cyclo Mimic is
BeyondMimic `whole_body_tracking`-based PPO. SuperMimic learns a differentiable
world model from simulator transitions and trains a policy through imagined
rollouts. A new task name alone does not establish that learner is running.

Reviewed Lab contract: [3cbd6259](https://github.com/ROBOTIS-GIT/cyclo_lab/blob/3cbd62592750ee0095df67f54399a0a320164e29/docs/supermimic.md).
Reviewed published MJLab contract: [775c45ce](https://github.com/ROBOTIS-GIT/cyclo_mjlab/blob/775c45cecde17ea0551e24de46cd3c62100e6149/docs/supermimic.md),
using baseline `1dcc5fa6a0827585656d44009d7d21925e14b122`
(documentation follow-up to tested source `6e09bf7`).
These are revision-specific contracts, not detection of an installed checkout.

Both consumers use the real [ROBOTIS-GIT/supermimic submodule](https://github.com/ROBOTIS-GIT/supermimic/tree/10dd5dd3f02601caf1991790952a25db63a6fb99)
at `third_party/supermimic`, gitlink `10dd5dd3f02601caf1991790952a25db63a6fb99`.
It derives from official HybridRobotics `abc124c1`; consult its
[portable-core provenance](https://github.com/ROBOTIS-GIT/supermimic/blob/10dd5dd3f02601caf1991790952a25db63a6fb99/PATCHES.md).
BeyondMimic remains based on official `whole_body_tracking` PPO.
The read-only `cyclo_mimic` MCP returns guidance and checkout requirements; it
neither detects a checkout nor launches jobs.

| Runtime / method | Environment and input | Output and limits |
| --- | --- | --- |
| Lab / BeyondMimic PPO | Branch-pinned Isaac runtime; existing Cyclo NPZ | RSL-RL `model_*.pt`; existing exporter/controller workflow |
| Lab / SuperMimic | Isaac Sim 6.2 / Isaac Lab 3.0 / Python 3.12, inherited Newton/MJWarp or explicit PhysX; validated named 50 Hz NPZ | `logs/supermimic/<run>/model_<iteration>.pt`, strict v3 checkpoint; no robot export |
| MJLab / BeyondMimic PPO | Python 3.12 / stable MJLab 1.6.1; Cyclo body-state NPZ | Existing RSL-RL checkpoint/export contract |
| MJLab / SuperMimic | Same root Python 3.12 / stable MJLab 1.6.1; native MuJoCo, internal reference adapter | `logs/<task>/<timestamp>/` inference bundle; local offline playback; no validated robot export |

Both use `scripts/reinforcement_learning/train.py` and `play.py`, with optional
`--algorithm beyondmimic|supermimic` or recognized task-family inference. Lab uses
`--task`, MJLab a positional task. Preserve backend-specific flags. Legacy
`Cyclo-Mimic-*` IDs remain PPO and `Cyclo-BeyondMimic-*` aliases retain their configs.
Lab's current 6.2 PPO train/play share task IDs; do not append `-Play` for this
revision. Older branches may differ. Historical direct launchers remain valid,
including Lab `mimic.py --method` and MJLab `cyclo-supermimic`.

Lab supports GenCoord and MaxCoord K1, privileged `rep_state`, history 1,
one clip/encoder, fixed dynamics and zero context. Proprio/history deployment,
motion-to-velocity latent BC, official return sampling and multi-task/multi-clip
remain outside the integrated scope. Newton/MJWarp is inherited by default;
select PhysX with `physics=isaacsim_physx` or `--physics isaacsim_physx`.
Choose `--representation gencoord|maxcoord` independently of the existing
Dance1/Dance2 task. Conflicting physics spellings fail. Newton solver
`num_substeps=1` is distinct from policy decimation; there is no silent fallback.

MJLab selects GenCoord/MaxCoord by task ID. Both learners share its root stable
MJLab environment; the previous mandatory Python 3.13 research setup is obsolete.
Lab and MJLab retain separate native simulator environments despite aligned Python
3.12 and core source. The MCP input schema remains `runtime`, `method`, `stage`;
backend and representation choices are guidance for the consumer CLI, not extra
MCP inputs or an executing bootstrap job.

Initialize the shared submodule in the chosen consumer only when setup is authorized:

```bash
git submodule update --init third_party/supermimic
```

Lab uses its existing Isaac environment and `requirements/supermimic.txt` when
matching learner dependencies are missing. Do not install the core's optional
research extra or replace native dependencies with its standalone lock.
For MJLab, follow `docs/runtime-migration.md` and the root lock in a new authorized
environment (inspect existing `.venv` before reuse):

```bash
uv venv --python 3.12 .venv
uv pip sync --python .venv/bin/python --require-hashes requirements.lock
uv pip install --python .venv/bin/python --no-deps -e third_party/supermimic -e .
source .venv/bin/activate
```

`integrations/supermimic` is optional checkout compatibility targeting the same
stack. Ordinary train/play needs only the root environment. Preserve baseline
binary pins and existing data; missing core paths are prerequisites, not permission
to replace the simulator or silently select PPO.

## Checkout checks and examples

Before generating a command, record commit, branch, dirty state, submodule pins,
Python and actual library versions. Preserve existing work and environments.
Inspect task registration and the command parser before invoking help: some
launchers initialize simulation even for discovery. Use the right environment.
When these feature interfaces are absent, stop with the missing path/task/version
and inspect that branch's documentation; do not install a different learner or
silently train PPO. Compare explicit method and task family before launching.

Use the common selector with `--motion-file` for strict reference validation.
Direct legacy Lab PPO commands retain their historical unnamed-K1 fallback.
Custom registrations must follow the actual runtime's registration pattern.

Only after the paths, tasks and flags are verified in the selected checkout:

```bash
# Lab native integration, from repo root in its pinned Isaac environment:
python scripts/reinforcement_learning/train.py --algorithm supermimic \
  --task Cyclo-SuperMimic-K1-Rev1-Dance1 --motion-file /data/k1_motion.npz \
  --representation gencoord --num-envs 2 --iterations 1 --eager --headless
# Add physics=isaacsim_physx for explicit PhysX; use --representation maxcoord for MaxCoord.
# Playback/continuation must repeat compatible nondefault physics overrides:
python scripts/reinforcement_learning/play.py --algorithm supermimic \
  --checkpoint logs/supermimic/RUN/model_1.pt --num-envs 1 --play-steps 100 --eager --headless

# MJLab: original supported reference, adapted internally.
WANDB_MODE=offline python \
  scripts/reinforcement_learning/train.py --algorithm supermimic \
  Cyclo-SuperMimic-GenCoord-K1-Rev1 --motion-file /data/cyclo_motion.npz \
  --num-envs 2 --runner.max-iterations 1 --runner.run-name k1-check
```

These are prepared examples, not executed results or resource guarantees. Initial
compilation and upstream buffers/networks may be costly even for one iteration;
use the checkout's bounded verification recipe and agreed GPU budget. Network
logging, explicit W&B retrieval and a listening viewer need their own authorized scope.
Offline training/playback requires no W&B upload or sync.

## Data, checkpoints and evidence

Preserve source video, retarget CSV, runtime-specific NPZ and deployment CSV.
Lab's native loader reorders named joints to Isaac articulation order and handles
quaternion conventions at its bridge. The Lab selector requires explicit
`quaternion_order` or `quat_order`; the native loader converts to Isaac xyzw,
and the SuperMimic bridge converts root orientation to algorithm wxyz once.
Lab rejects missing/conflicting quaternion conventions rather than guessing.
SuperMimic additionally checks every frame/body against K1 URDF FK and supported
source-defined COM profiles, converting COM twists to link twists in memory.
Both runtimes reject complex arrays and values nonfinite after float32 conversion.
Missing producer/backend labels remain unspecified; physical agreement does not
identify the producer.

MJLab adapts the same original 50 Hz `csv_to_npz` reference internally; a separate
conversion CLI is optional. Verify adapter availability in the selected checkout.
The adapter must validate producer/backend-specific body and joint names and
orders, pelvis/root identity, finite shapes, units, frames, control rate and
quaternion convention. The reviewed MJLab adapter accepts Cyclo/MuJoCo wxyz
world-frame input; it rejects Isaac/xyzw inputs rather than converting backends.
It reorders by validated names. Complete named body-state input is checked
against K1 FK and supported link-origin/current-COM/historical-COM velocity
profiles, including COM-to-origin correction. Legacy producer labels may be
absent only when redundant body states establish the physical convention;
unknown or ambiguous profiles yielding different root velocity fail. Root-only
files require explicit `backend=mujoco`, `quaternion_order=wxyz`,
`velocity_frame=world`, `velocity_point=link_origin`. Never guess from a
23-column shape or unit quaternion norm.
Preserve the original bytes and 50 Hz reference; do not rewrite it in place.
Reference compatibility does not establish ONNX or Sim2Real policy compatibility.
The MJLab adapter uses a derived `.supermimic-data/adapter/` cache and
source-hash/model-signature manifest, revalidating original inputs every call.
This does not establish an unknown producer identity.
Both current K1 integrations require 50 Hz; resample using actual supported converters. Do not relabel a G1 dataset as K1.

PPO checkpoints, Lab checkpoints and MJLab bundles are not interchangeable.
Lab uses `--checkpoint` with `cyclo-supermimic-isaac-v3`: task, motion digest,
physical model, exact timestep/decimation, observations/actions and zero context
and representation must match. Strictly compatible legacy v2 loading is limited
to explicit PhysX/GenCoord; other legacy/backend/representation combinations fail. Relocating the same motion is supported; implicit
new-clip warm starts are not. Continuation restores learned/normalizer/optimizer
state into fresh simulator, replay and RNG state, not exact trajectory resume.

MJLab local `--checkpoint-dir` requires `manifest.json`, `world_model.pt`,
`actor.pt` and optional `critic.pt`. The versioned manifest validates task,
representation, actor mode, ordered robot/actions and exact environment timing.
It is an inference bundle, not an optimizer/replay continuation format. Use
exactly one local directory or explicit `--wandb-path`; authenticated retrieval
is untested. Example local playback after validating the saved contract:

```bash
python scripts/reinforcement_learning/play.py \
  --algorithm supermimic Cyclo-SuperMimic-GenCoord-K1-Rev1 \
  --motion-file /data/cyclo_motion.npz --checkpoint-dir logs/Cyclo-SuperMimic-GenCoord-K1-Rev1/RUN \
  --viewer headless --device cpu --num-steps-rollout 4
```

Lab reports four bounded Newton/PhysX × GenCoord/MaxCoord train/continue/play
cells and both BeyondMimic backend regressions passed. Lab learner compilation
and deployable proprio/history remain unvalidated.

MJLab baseline production Docker/CUDA PPO, checkpoint, export and EGL checks
passed. The integrated Docker suite passed 82 tests; both representations passed
CUDA eager and compiled/captured WM/actor updates, exact final save/reload and
local playback. Installed entry point and fresh-process common playback CLI
checks passed. Proprio/history-2 eager smoke passed, which does not establish
compiled history-mode acceptance. Historical trained-policy compatibility is
not established. See the pinned consumer's `docs/validation.md` for evidence.

WM parameters stay frozen during actor updates while gradients pass through
dynamics. These are bounded implementation-reported checks, not plugin execution,
convergence, robot export, hardware, interactive viewer or full-feature-parity
claims. Preserve the inference-bundle versus full training-continuation distinction.

Report each stage separately: interface checks; conversion; real simulator
transition; world-model and policy optimizer updates; finite metrics; saved
checkpoint reload; playback; export; Sim2Sim; hardware. A research smoke or a
short learner run does not validate tracking convergence, export or hardware.
This plugin's tests use synthetic evidence and device-free MCP calls only.

Existing PPO deployment requires same-run `exported/policy.onnx`,
`params/sim2real.yaml` and the matching converted motion CSV plus controller
review. For SuperMimic, stop deployment preparation with “No validated K1
export/controller contract for this method and revision.” Preserve artifacts;
never rename an actor checkpoint to ONNX or reuse PPO observation/action config.
