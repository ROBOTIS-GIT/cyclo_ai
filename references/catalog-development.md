# Developing the bundled catalog

Generated JSON records source facts and reviewed execution rules. Keep generator changes and their generated output together. Do not hand-edit a register address only in the generated inventory.

The index pins the ROBOTIS docs revision and each source blob. Obtain that exact checkout and the supplement revisions in `references/control-source-supplements.json`. The supplemental cache layout is `_official/<owner>/<repository>/<revision>/<path>` beneath the same pinned-docs checkout/cache used by the item compiler. `scripts/control_source.py` verifies source blobs; a missing or mismatched file is a build failure.

For an existing pinned index, use the documented checkout/cache as input:

```sh
python scripts/compile_control_tables.py /absolute/path/pinned-docs
python scripts/compile_control_items.py /absolute/path/pinned-docs
npm test
```

Run each command with `--help` for output overrides. The item compiler invokes enrichment and specialization; do not run a partial stage and treat its output as the final write catalog. Generators read the package version from `plugin.json`.

When changing the documentation revision, first update `references/dynamixel-docs.json` with `scripts/index_dynamixel_docs.py` using the matching checkout and Git tree inventory. Review model aliases, shared component dependencies and firmware conditions before regenerating contracts. Changes to counts in regression tests should follow a reviewed source change, not suppress an unexpected compiler failure.

For a new condition, add a declarative rule plus a failing and succeeding fixture in both runtime validation layers. Prefer local synthetic sources and packets for reproducible CI. Keep manufacturer-derived provenance in the resulting contract and original license notices in retrieved source.

A complete automated source-fetch/update command is not yet provided. Source acquisition and revision selection remain explicit maintainer steps; ordinary contributors can work with custom profiles and synthetic fixtures without rebuilding the manufacturer inventory.
