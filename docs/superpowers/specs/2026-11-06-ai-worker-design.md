# AI Worker skills

The user selected five focused skills covering the full installation-to-learning workflow: `ai-worker`, `ai-worker-setup`, `ai-worker-control`, `ai-worker-teleop`, and `ai-worker-learning`.

## Approaches

A single skill with conditional references would minimize entrypoints. The selected five-skill approach follows the existing AI Sapiens pattern and allows direct discovery by task. The entrypoint handles documentation and routing; the four task skills remain independently usable.

## Constraints

Use English package content and existing Codex/Claude discovery conventions. Retrieve current official AI Worker sources before version-sensitive commands. Keep model/revision, Leader/Follower and execution-host distinctions explicit. Reuse existing integration guidance for source-level ROS 2 problems. Skill authoring does not authorize robot access, installation, training or live inference. No new runtime, dependencies, release version, commit, publication or live-profile installation is required.

## Validation

Validate five new frontmatters and UI records, local links, the 19-skill package inventory and source archive. Exercise representative task-selection and missing-information scenarios with an independent reader. Physical operation and training runtime remain untested.
