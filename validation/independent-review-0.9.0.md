# Independent review: feature-hardware-ready-defaults

Date: 2026-10-26. Read-only review of the current uncommitted Cyclo Plugin tree. Scope: shared availability/offline gating, firmware confirmation/preview wrapper, multi-device selection and destination collision checks, canonical item compiler/inventory, JavaScript item engine and Python validation. Only isolated mocked/in-memory operations were executed. No hardware, actual port enumeration/resolution, network, authentication, installation, global settings, or project source edits occurred.

## Reproduced code findings, now corrected

### 1. A dual-axis endpoint could be its own peer

Original location: `modules/dynamixel/selection.mjs:44-46`. The new peer filter matched by asserted peer ID without excluding the selected candidate. A completed observation containing only model1090 ID1 accepted `peerIds:[1]` and returned a ready dual-axis target. Generic table EEPROM preconditions could then read torque twice from the same axis instead of establishing both axes.

Verified correction: selection rejects equal primary/peer IDs; `modules/dynamixel/table.mjs:49` rejects the invalid cohort before connecting; Python binding independently rejects it. My original fixture now returns `Dual-axis selection requires the explicitly observed peer endpoint`. New selection and generic-engine negative fixtures pass.

### 2. Python accepted a peer write using primary-axis conditions

Locations: `modules/dynamixel/sdk_bridge.py:85-90` and `validate_table_write`. The outer validator allowed any bound primary/peer ID, but generic item identity, mode and limit checks read the primary `b.id`. An isolated validator fixture bound 2XL primary1/peer2, with primary mode3/MaxPosition4095 and peer mode1/MaxPosition10, accepted a Goal Position1000 write addressed to ID2 while reading only ID1. The current Node table path always writes its primary target, so this was a private-adapter validation mismatch, not an arbitrary public MCP ID parameter.

Verified correction: generic item writes require the primary binding ID. Peers remain a precondition cohort, not alternate item-write targets. The new Python negative fixture passes.

### 3. Raw-port aliases bypassed explicit read-only operator policy

Locations: `modules/dynamixel/selection.mjs:resolve` and `modules/dynamixel/server.mjs:onBus`. Policy comparisons initially used raw port strings, while connection later used the lease's canonical port. In a fully injected in-memory server fixture, a configured `/MOCK-CANONICAL` bus with `allowConfigure:false` was reached via `/MOCK-ALIAS`; a fake lease resolved it to the restricted canonical path, selection granted configuration, and an LED call produced one verified mock write.

Verified correction: `modules/dynamixel/server.mjs:29` constructs the session with `dynamicPorts:false` whenever an explicit operator config is supplied. Its users must select a named configured bus/target; raw canonical spellings and aliases both fail before provider access. No-policy default sessions retain explicit dynamic port selection. The targeted policy regression passes, and direct checks reject both mock spellings.

## Remaining actionable documentation finding

**P2: package guidance still contradicts newly executable item operations.**

- `README.md:69`: “Drive/Operating/Protocol mode changes are outside this release.” Operating Mode is now a resolved generic operation for applicable source-backed models.
- `references/first-run.md:40`: “No arbitrary writes, mode/torque changes, motion, reset or flashing are added.” The generic item tool now supports explicit resolved Torque Enable, Operating Mode and Goal writes. The sentence is accurate only for the legacy named configuration path if scoped accordingly.

Update these statements to distinguish the conservative `dynamixel_configure`/firmware path from source-resolved `dynamixel_write_item`, retaining truthful reset/flashing/arbitrary-address exclusions and operation-specific prerequisites. This matters because customers otherwise receive conflicting guidance about executable actions and risks. The parent indicated documentation cleanup is underway; these statements remained in the tree at the last read.

## Validation actually executed

- `node --test --test-isolation=none tests/hardware-defaults.test.mjs tests/table-items.test.mjs tests/selection.test.mjs`: **32 passed**, zero failures. Evidence: `/tmp/cyclo-hardware-ready-tests.txt`. Includes injected-provider no-I/O checks, offline/missing-confirmation blocks, previews, multi-device selection/collisions, item conditions/readback, explicit-policy restrictions and invalid self-peer rejection. These are mock tests, not serial/device acceptance.
- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s validation -p test_control_items.py -v`: **6 passed**, zero failures. Evidence: `/tmp/cyclo-hardware-ready-python.txt`. Fake SDK packet interfaces only, including signed limits, mode/torque preconditions and primary/peer binding restrictions.
- Rebuilt the item inventory from the local blob-checked official source cache into `/tmp/cyclo-reviewed-control-items.json`; byte comparison with `references/control-items.json` returned equality. Observed counts: **89 actuator documents, 5,901 retained/readable raw rows, 563 resolved writable rows, 3,962 unresolved writable rows**. Counts describe source rows and metadata resolution, not physical validation or universal operational support.
- Independently exercised the self-peer, wrong-axis Python conditions and alias-policy cases above. No unknown source code, MDX or actual SDK port implementation was executed.

## Assessment and limits

No additional reproducible code blocker remains in the paths reviewed after the three corrections. The generic metadata deliberately leaves unresolved writes blocked and distinguishes raw readable bytes from signed/unit semantics; that boundary is appropriate and should not be replaced with guessed addresses or feature applicability. Per-operation confirmation precedes live provider/executor access, and default availability alone does not start port discovery. Firmware dynamic previews bypass the resolver, while configured previews remain local argument construction.

The remaining documentation mismatch should be fixed before delivery. This review does not certify every conditional source semantic, full repository regressions, final ZIP bytes, installed Codex/Claude invocation, real serial baud/transport behavior, duplicate-device exclusion, physical trajectories, or CI. The parent must perform those applicable release checks separately. No denied or uncertain external action occurred; all side effects were temporary fixtures only.

## Author follow-up after the review

Both documentation contradictions listed above were corrected: README now routes generic item support explicitly, and first-run guidance identifies supported goal/torque/mode items and unresolved coverage. The final source/ZIP validation and full regression run occur after these corrections. This follow-up is not a claim that the reviewer performed physical or installed-host testing.
