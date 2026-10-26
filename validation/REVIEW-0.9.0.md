# Hardware-ready defaults and generic Control Table review

## Delivered source behavior

Both host manifests omit global hardware enable overrides. Shared defaults allow hardware-capable tools, while startup, initialization, capabilities and documentation perform no serial I/O. `CYCLO_OFFLINE=1` blocks firmware and products, including catalog and dynamic resolution paths. Legacy module flags set to `0` remain explicit opt-outs. Firmware calls now default to dry run and require confirmation for actual access; its dynamic previews bypass the upstream resolver that otherwise runs before dryRun. Product tools preserve dry-run defaults. An existing explicit customer command supplies confirmation without another plugin unlock or repeated question.

Default product use supports confirmed port listing and bounded scans of an explicitly selected port without an operator file. A supplied restrictive operator file requires its named bus/target; aliases cannot bypass its policy. Multi-device selection chooses the exact candidate and retains TTL, catalog/protocol/firmware bindings, cooperative leases, collision checks and uncertain-state reconciliation. Dual-axis peers must be distinct and observed; unrelated motors do not require disconnection. A scan alone does not establish the absence of duplicate IDs or secondary listeners.

Three new product tools expose generic table inventory, item reads and item writes. The shared canonical item metadata is independently enforced by JavaScript and the private official-SDK bridge. Explicit Torque Enable, Operating Mode, signed Goal Current/Velocity and Goal Position writes are implemented where conditions are source-resolved. Applicable EEPROM and controller/mode/limit conditions remain, without a universal torque-off requirement for RAM writes. No torque, mode, safety-limit, recovery or flash action is automatically performed to satisfy a different command.

## Completed metadata coverage and explicit manufacturer gaps

The 89 actuator documents supply 5,901 source rows and 14,532 expanded indirect slots: 20,433 effective items, comprising 19,055 resolved writable contracts, two genuine manufacturer write-contract gaps and 1,376 read-only items. All effective rows have bounded raw-read metadata. The two gaps are original MX-64/MX-106 Current(68); their official RW labels do not establish valid semantic writes. Official SDK SET_CURRENT uses Goal Torque(71), which must not be substituted silently. This is an evidence limitation, not a remaining generic-parser task. Counts repeat shared fields and are not physical-device certification.

## Validation evidence

- Final per-suite results and exact counts are retained in `current/test-results.json` and the adjacent logs. The complete offline suite and extracted archive are checked separately.
- All-row generic reads cover 20,433 effective rows across all 89 actuator documents in memory, not actual ports.
- Mock tests cover selected-target-only writes, duplicate addresses, ID/baud collision preflight, multiple responders, distinct dual-axis cohorts, incomplete scans, mode enums, signed values, raw legacy formats, EEPROM/torque conditions, lost acknowledgement, wrong post-transition identity, closure uncertainty and no blind retries.
- Independent review reproduced three defects: self-peer selection, generic private-bridge peer write using primary conditions, and alias bypass of configured port restrictions. All were corrected and regression-tested. See the independent report for its exact reviewed scope.
- Source hashes of vendored firmware/SDK files remain unchanged. English-only, manifest, local-reference, version and canonical source-binding checks pass.

No physical serial discovery, device access, motor operation, live-host installation of these changed defaults, credential/security changes or authenticated host acceptance of the new tools was performed. The normal ProArt installation remains the previously verified package. Packaging tests are separate from physical and installed-host certification.

## Extended independent review

Follow-up review corrected conditional Shutdown masks, Secondary ID sentinels, legacy RAM Lock enforcement, typed device-status errors, later-selected secondary listeners and conditional external-port indirect aliases. Regression cases cover each correction. Shared golden vectors exercise firmware/mode/range boundaries in both engines, and fake byte ports exercise the actual pinned SDK for both protocols. Representative descriptor mocks do not independently prove every source interpretation. See the separate review reports for the exact scope and chronology.

Final source suite: 436 tests passed across 9 counted test groups, plus SDK compilation and package validation. The 46 shared boundary vectors are included in the Node count and exercised again by one Python parity wrapper; they are not 92 independently sourced facts. The representative-write loop covers 19,055 contracts inside family tests.

Active host descriptions and runtime guidance were subsequently aligned with default availability, the explicit offline opt-out and the two manufacturer gaps. A dual-host metadata regression checks those advertised defaults; historical reports retain their original observations.
