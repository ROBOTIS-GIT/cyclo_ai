# Independent PR3 final recheck

Date: 2026-10-26. Read-only project review; all reproductions are local/in-memory mocks. No hardware, serial/OS discovery, network, installation, authentication or source edits.

## Prior findings verified fixed

- False `encoderError` callers now compile Shutdown mask53; XL330-M288 Shutdown raw8 is rejected as reserved.
- Secondary ID253,254,255 pass scalar and live conditions; stale0..252 rangeExpressions no longer override the explicit disable domain.
- Locked AX RAM LED validation succeeds while the Python named path preserves the original write register for EEPROM/Lock checks.
- The named workflow, as well as the generic table path, propagates typed device-status errors as uncertain rather than converting them to success after matching readback. An extra mock that applied LED1 then threw a typed device-status error returned uncertain.

## Remaining newly reproduced findings

### P1: known secondary listener is not checked for a target selected later

Location: `modules/dynamixel/selection.mjs`, `select`, `target`, and the secondary-listener handling in `settle`.

Current `settle` stores A.secondaryId and blocks already existing targets at that primary ID. It does not prevent a target being selected afterward at that known group-listening address. A pure session reproduction starts with A primary1, settles a verified Secondary ID7 change, then records/selects a separately observed primary7. `select` returns ready target B and `target('b')` succeeds while `target('a').secondaryId` remains7. A scan cannot erase the known secondary listener because secondary IDs do not provide distinct discovery responses. The generic table engine's extra listener check covers a dual-axis peer, not this separate known actuator, and no server cross-target check was present at review.

A later RAM write to primary7 can therefore reach B and the known A listener. Recheck session-known listeners when selecting and/or retrieving B, using port, baud and protocol. Keep A's unique primary1 usable: its own active secondary ID alone does not make a primary1 write a group operation. Add tests for secondary-first/selection-later and the reverse order, listener clear/reconciliation and protocol/rate separation.

### P2: indirect aliases incorrectly reject source-resolved conditional R/RW targets

Location: `modules/dynamixel/table-alias.mjs`, the `target.access!=='RW'` gate in `aliasPlan`.

JavaScript `writeRequest` and Python accept RW and R/RW with conditions. Alias resolution only accepts RW. A PH42-020-S300-R mock in External Port Mode1=1 accepts direct External Port Data1@600=1. Mapping a complete sequential indirect group to600/601 and writing Indirect Data1=1 instead returns not_written, `Indirect destination is read-only or has unresolved write semantics`. The source-resolved R/RW contract already requires output mode1; aliases should inherit this contract, not treat R/RW as unconditional read-only. Add positive mode1 and negative input-mode alias fixtures in both engines.

## Focused checks actually executed

- `node --test --test-isolation=none tests/table-transitions.test.mjs tests/full-table-execution.test.mjs tests/table-items.test.mjs`: **30 passed**, zero failures. `/tmp/cyclo-pr3-recheck-node.txt`.
- `node --test --test-isolation=none tests/conditions.test.mjs`: **46 passed**, zero failures. `/tmp/cyclo-pr3-recheck-golden.txt`.
- Python `test_condition_parity.py`: **1 wrapper test passed**, executing shared golden boundary cases. `/tmp/cyclo-pr3-recheck-parity.txt`. This is not an additional independent set of46 source facts.
- Python `test_generic_packet_items.py`: **9 passed**, zero failures, actual pinned SDK packet parsing against fake ports only. `/tmp/cyclo-pr3-recheck-packets.txt`.
- Extra standalone mocks verified the three prior fixes, the typed named-workflow status-error behavior, and the two new issues above.

## Limits

The broad representative-value test exercises all resolved descriptors on catalog-derived byte-memory fixtures. It does not independently establish every numeric/bit/mode/firmware interpretation or every alias effect. The golden cases and packet fixtures add meaningful boundaries but are not installed-host or physical-device tests. No further claim is made about final packaged bytes, the full regression run, remote CI or runtime hardware. Both remaining issues were promptly reported to the parent before push.
