# Cyclo Plugin 0.7.0 independent code and metadata review

Review date: 2026-10-25. Scope: the uncommitted working tree in `proart-ai-sapiens-development/cyclo-plugin`, generic DYNAMIXEL catalog/compiler, identity and configuration engine, session selection, SDK bridge/provider, and focused offline tests. This was a read-only project review; only temporary review reports and fixtures were written. No host serial enumeration, serial connection, device access, torque, motion, flashing, GPU job, login, or global installation occurred.

## Final assessment

No remaining reproducible release-blocking defect was found in the reviewed paths after the fixes below. This is a bounded source/code/mock assessment, not installed-host or physical-device acceptance. The configuration API remains named ID/baud/LED/profile operations; Drive Mode, Operating Mode, Protocol Type, torque, reset, goal/motion and firmware writes are outside its operation set. Metadata coverage is not equivalent to physically verified support.

## Reproduced findings and verified corrections

1. **Profile operating-mode applicability:** the initial compiler accepted mode 5 for XL330 from the general Operating Mode table even though the Profile Velocity caller did not enable current-based position applicability. A mock configuration initially produced writes to 108/112 in that mode. The compiler now intersects the exact caller/default applicability with the model's operating-mode rows. The negative XL330 case and positive XM430 current-based case pass.
2. **Target grant preservation:** the initial selection guard did not preserve target-specific protocol/catalog/cohort restrictions. A synthetic scan could select the same numeric model/firmware/ID/baud under another protocol. The current guard binds protocol, canonical catalog and explicit peer cohort as well as numeric identity/location; the targeted negative fixtures pass.
3. **Dual-axis observation:** a single observed dual-axis endpoint initially accepted an asserted, unobserved peer ID. Both endpoints must now actually appear in the completed observation, with matching model, firmware, baud and protocol. The single-response negative fixture passes.
4. **Other-axis shadow identity:** a dual-axis mock with primary Secondary ID 255 and peer Secondary ID 1 initially permitted LED configuration. Current engine and SDK write guards check every endpoint's identity, protocol, baud, inactive shadow ID and already-disabled torque. The new peer constraints pass without writes.
5. **Firmware-scoped snapshot reads:** source-gated Drive/Profile fields are now omitted before the catalog's Drive Mode minimum firmware, rather than making unrelated ID/LED changes depend on unavailable feature registers. The implementation uses the observed firmware byte and retains feature-specific write gates.
6. **Owned bridge cleanup:** a synthetic child returning an error for `close` initially remained alive because stdin teardown occurred only after successful close. The provider now always ends stdin and waits for its owned process, with bounded TERM/KILL fallback. It preserves the original close error, so transport uncertainty and the bus reservation are retained. The subprocess regression confirms the child has exited; it uses a temporary mock executable and no SDK transport.

## Tests actually run against the final reviewed state

- `node --test --test-isolation=none tests/catalog-execution.test.mjs tests/selection.test.mjs tests/sdk-provider.test.mjs`: **151 tests passed**, zero failures. This includes all 89 actuator catalog entries, 38 source-resolved profile mappings, negative identity/scope/peer/mode cases and both Protocol 1 and Protocol 2 provider-to-Python stdio fixtures over fake bytes. The explicit non-isolated test mode was used to obtain individual test execution/counts in this environment; a preliminary default-isolation run only reported three file-level entries and is not counted as 151 tests.
- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s validation -p test_sdk_packets.py -v`: **6 tests passed**. The unmodified official SDK parses in-memory Protocol 1/2 packets. Fixtures trap serial construction, test endian read/write packets, CRC/checksum and status errors, bounded explicit protocols/rates, and rejection of non-configuration writes.
- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s validation -p test_control_tables.py -v`: **3 tests passed**. This includes independent header-aware witnesses for all 89 actuator tables, malformed-row handling, source bindings and SDK immutability.
- Independently computed all **11** SHA-256 entries in `SDK-UPSTREAM.json` and compared every file byte-for-byte with the pinned SDK 3.8.4 checkout at `0b29760ffa81d813bc749cb611a0019938c1e856`: zero mismatches.

Node execution evidence: `/tmp/cyclo-v070-independent-node.txt`. Metadata evidence: `/tmp/cyclo-v070-independent-metadata.txt`. Earlier independent source interpretation and row witnesses: `/tmp/cyclo-v070-metadata-review.md` and `/tmp/cyclo-v070-reviewed-rows.json`.

## Source interpretation and capability boundaries

- Pinned official docs: `c88527af0888baea6f7ef3305bbbbb911b960759`. All 89 actuator records enter the same identity/capability pipeline; the three DYD records are mechanical products, not packet identities.
- Numeric collisions 1070, 1080 and 1270 remain ambiguous until an exact catalog identity is chosen. MX/PRO generation and protocol distinctions are retained. A user assertion cannot by itself prove the marketed variant on a device; model/FW/protocol/table identity still needs observation and explicit isolation.
- Profile execution is source-resolved for the 38 X/MX2 mappings. P/PRO/Y profile descriptions retain unresolved/copied unit/address semantics and remain blocked for that capability. This does not prevent independently resolved ID/baud/LED guidance/configuration. XW LED absence remains unsupported rather than a guessed address; XL320 requires an explicit color mask and RGB models require explicit channels.
- Y Modbus model-number identities are rejected by the DYNAMIXEL packet transport. The documentation's mixed protocol statements are not treated as permission for mode changes, recovery or flashing.
- Destination baud support is checked against the actual pinned official SDK before the register write; the set of rates documented by a motor is larger than this SDK backend's supported set. A broader manual baud table is not a host capability claim.
- Real serial uniqueness cannot be established by bounded scans. Physical isolation and explicit dual-axis cohort confirmation remain necessary. Lost acknowledgements/readback/continuity/closure failures invalidate ready session use and must not trigger blind write retries. Verified ID/baud continuation requires successful identity and snapshot reconciliation plus confirmed closure/reservation release.

## Limits and remaining release work

This review did not run the whole repository suite, final ZIP/manifest validation, installation in Codex or Claude, real pyserial ports, devices, wiring/power/RS-485 behavior, USB baud behavior, or GPU/robot runtimes. The parent must run its complete final-artifact checks and exact-commit CI separately. Mock fixtures generated from the catalog demonstrate engine behavior but cannot independently certify every source semantic; the separate 89-table witness test adds row evidence, while unresolved partial semantics remain explicitly blocked. No authorization blocker or denied action occurred in this review.
