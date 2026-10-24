# Text-to-motion preparation

Source: [Kimodo](https://docs.robotis.com/docs/systems/aisapiens/motion_generation_retargeting/kimodo/), reviewed 2026-10-23. Use the ROBOTIS-GIT/kimodo fork for its BVH fix. Baseline prerequisites: Python 3.10+, PyTorch 2.0+, practical CUDA GPU, existing Hugging Face authorization and gated Meta-Llama-3-8B-Instruct access. Do not create credentials or accept access/license terms for the user.

Select the manual's isolated package/source/container install path; review dependency and model downloads first. After an authorized environment is ready, representative CLI syntax is:

```bash
kimodo_gen "A person walks forward." --model Kimodo-SOMA-RP-v1 --duration 5.0 --output output/walk_forward --bvh
```

First use may auto-download models. For repeated generation, kimodo_textencoder is a real long-running service requiring a tracked executor; TEXT_ENCODER_DEVICE=cpu is documented when appropriate. kimodo_demo also opens a browser service; no service is supplied or started here.

SOMA NPZ/BVH is human source motion, not a K1 policy. For Soma-retargeter export BVH without --bvh_standard_tpose. Check actual generated files, duration/FPS, subject/scale and continuity. G1 CSV is not K1-compatible by renaming. Constraints and multi-prompt durations require current CLI/schema verification; never invent constraint JSON fields. Hand reviewed motion to [retarget/Mimic](../../ai-sapiens-video-mimic/references/motion.md). Stop at missing gated access or unsupported output, retaining source artifacts.
