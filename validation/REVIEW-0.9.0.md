# Hardware-ready defaults and generic Control Table review

## Delivered source behavior

Both host manifests omit global hardware enable overrides. Shared defaults allow hardware-capable tools, while startup, initialization, capabilities and documentation perform no serial I/O. `CYCLO_OFFLINE=1` blocks firmware and products, including catalog and dynamic resolution paths. Legacy module flags set to `0` remain explicit opt-outs. Firmware calls now default to dry run and require confirmation for actual access; its dynamic previews bypass the upstream resolver that otherwise runs before dryRun. Product tools preserve dry-run defaults. An existing explicit customer command supplies confirmation without another plugin unlock or repeated question.

Default product use supports confirmed port listing and bounded scans of an explicitly selected port without an operator file. A supplied restrictive operator file requires its named bus/target; aliases cannot bypass its policy. Multi-device selection chooses the exact candidate and retains TTL, catalog/protocol/firmware bindings, cooperative leases, collision checks and uncertain-state reconciliation. Dual-axis peers must be distinct and observed; unrelated motors do not require disconnection. A scan alone does not establish the absence of duplicate IDs or secondary listeners.

Three new product tools expose generic table inventory, item reads and item writes. The shared canonical item metadata is independently enforced by JavaScript and the private official-SDK bridge. Explicit Torque Enable, Operating Mode, signed Goal Current/Velocity and Goal Position writes are implemented where conditions are source-resolved. Applicable EEPROM and controller/mode/limit conditions remain, without a universal torque-off requirement for RAM writes. No torque, mode, safety-limit, recovery or flash action is automatically performed to satisfy a different command.

## Coverage limitation requiring continued implementation

The source inventory contains 89 actuator documents and 5,901 Control Table rows. All present rows have bounded raw-read metadata and pass one-engine per-model mock reads. 563 per-document writable rows have resolved rules; 3,962 RW or conditional R/RW rows remain unresolved. This PR does not fulfill universal write semantics for every Control Table item. Remaining firmware/mode conditions, legacy direction-bit interpretation, many gains/limits/watchdog/indirect/external-port items and other model-specific descriptions need further evidence-backed resolution. Metadata counts are neither all physical variants nor hardware certification. Existing named profile capabilities remain available separately.

## Validation evidence

- 357 tests passed: 71 retained upstream mocks, 68 product/default/item tests, 138 catalog execution tests, 4 official-SDK stdio fixtures, 7 documentation-reader tests, 5 dual-host stdio tests, 3 retained firmware integration tests and 61 Python tests.
- All-row generic reads cover 5,901 rows across all 89 actuator documents in memory, not actual ports.
- Mock tests cover selected-target-only writes, duplicate addresses, ID/baud collision preflight, multiple responders, distinct dual-axis cohorts, incomplete scans, mode enums, signed values, raw legacy formats, EEPROM/torque conditions, lost acknowledgement, wrong post-transition identity, closure uncertainty and no blind retries.
- Independent review reproduced three defects: self-peer selection, generic private-bridge peer write using primary conditions, and alias bypass of configured port restrictions. All were corrected and regression-tested. See the independent report for its exact reviewed scope.
- Source hashes of vendored firmware/SDK files remain unchanged. English-only, manifest, local-reference, version and canonical source-binding checks pass.

No physical serial discovery, device access, motor operation, live-host installation of these changed defaults, credential/security changes or authenticated host acceptance of the new tools was performed. The normal ProArt installation remains the previously verified package. Packaging tests are separate from physical and installed-host certification.
