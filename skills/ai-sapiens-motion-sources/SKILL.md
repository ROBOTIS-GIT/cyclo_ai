---
name: ai-sapiens-motion-sources
description: Prepare AI Sapiens source motions from Kimodo text generation or SOMA-X human-model conversion before Soma-retargeter and Mimic training.
---

# Ai Sapiens Motion Sources

Read [execution boundaries](../../references/execution.md) before commands or changes, and [official retrieval](../../references/sources.md) before factual guidance. Fetch only the relevant source and reference; do not load the whole manual. Preserve the user's instructions and authorization. This workflow has no GPU/robot executor or credential store; the device MCP does not execute that workflow.

1. Classify input and purpose: text prompt/constraints, raw SMPL-family or AMASS/MHR motion, existing SOMA BVH/NPZ, or video. Ask only the missing choice. Video and existing SOMA inputs route to [video/Mimic](../ai-sapiens-video-mimic/SKILL.md); they do not automatically require SOMA-X.
2. For text read [Kimodo](references/kimodo.md); for human-model conversion read [SOMA](references/soma.md). Fetch the matching official section and actual checkout help. Preserve source format, units, frame rate, clip and licensed model identity.
3. Check task-local environment, real executor, model access/license and download budget before installation/generation. Do not create credentials, accept licenses or start a text-encoder/demo service implicitly. Model auto-download and localhost servers are real effects.
4. Prepare reproducible commands and output checks. Generated human/kinematic motion is not a K1 policy or contact-feasibility proof. Inspect motion and retarget to K1, then use the selected Lab/MJLab converter and custom Mimic task. Preserve artifacts instead of deleting source data.
5. On inaccessible/gated models, mismatched identity family, missing tools modules, malformed input or unsupported K1 guide, stop the affected stage and give the exact prerequisite. Do not guess formats from extensions alone or turn a G1 motion CSV into K1 by renaming it.

Examples: “I want to generate K1 motion from a text prompt”; “Convert an AMASS file to SOMA”; “The tools module is missing after installing py-soma-x.”
