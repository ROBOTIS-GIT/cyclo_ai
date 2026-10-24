# SOMA representation and conversion choices

Source: [SOMA-X](https://docs.robotis.com/docs/systems/aisapiens/motion_generation_retargeting/soma_x/), reviewed 2026-10-23. SOMA-X normalizes human body-model representations; it does not produce robot IK, balance or hardware validation. Existing SOMA motion can go directly to Soma-retargeter.

Classify model/input schema first. py-soma-x supplies the soma package; optional SMPL-family dependencies and separately licensed matching body-model assets are prerequisites. First use may download assets. A package install does not include repository tools.* modules: those commands need a source checkout with LFS from the manual's linked upstream repository and its environment setup. Do not repair a missing tools module by inventing a pip package.

For AMASS, after verified setup and authorized conversion, the documented source-root form is:

```bash
python -m tools.convert_amass_to_soma --input path/to/amass_sequence.npz --output-npz out/soma.npz --no-render
```

Use tools.mhr2soma or tools.smpl2soma only for matching input and actual CLI. Check output schema, joint names, root translation, reconstruction error, identity/scale and units/FPS. Licensed model topology is authoritative; stop on mismatched families. Mesh correctives are a beta human-mesh feature, not robot joint-limit correction.

For K1 raw SMPL-family files, the ROBOTIS retargeter's optional SOMA-X path may perform conversion and retargeting together. Inspect that current manual rather than running duplicate normalization stages. Continue via [retarget/Mimic](../../ai-sapiens-video-mimic/references/motion.md); retain human-model provenance and converted artifacts.
