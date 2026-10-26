# PR3 independent closure check

Date: 2026-10-26. Read-only mocked recheck; no hardware, network, serial enumeration/resolution, authentication, installation or project source edits.

The previously reproduced canonical-alias secondary-listener bypass is **closed** in the latest source. I reran the exact injected MCP reproduction: configured A(id1, `/MOCK-ALIAS-A`) and B(id7, `/MOCK-ALIAS-B`), with both fake leases resolving `/MOCK-CANONICAL`. A's explicit Secondary ID7 write returned verified. B's subsequent LED1 operation was rejected for the known A secondary listener. B recorded **zero writes**, and the provider connection log contained only A's connection; B never opened a transport.

`node --test --test-isolation=none tests/hardware-defaults.test.mjs tests/table-transitions.test.mjs` passed **26 tests**, zero failures. Evidence: `/tmp/cyclo-pr3-closure-node.txt`. The prior conditional R/RW alias fix remains covered by the positive/negative external-port transition test. No remaining reproduced safety bypass from my reported PR3 findings remains.

One observed correctness limitation remains: the deterministic pre-connection listener rejection is wrapped as `bus reservation retained because closure could not be established`. It retains the reservation even though this B operation never connected. This does not permit an unsafe write, but creates unnecessary manual bus recovery and can block clearing the listener through A. A future cleanup can move the canonical-address preflight before `entered=true` or otherwise explicitly distinguish failures before any provider connection from uncertain closure; never release an actually uncertain transport reservation. This was reported to the parent as a resource/recovery issue, not a remaining P1 safety bypass.

This closes only the independently reproduced findings. It is not final ZIP, complete regression, remote CI, installed-host or physical-device acceptance.

## Recovery follow-up: closed

Reran the exact injected MCP alias reproduction after moving canonical-address preflight before `entered=true`. The blocked B RAM operation now returns only the known-listener reason, with **zero B writes, one total provider connection (A only), two leases and two releases**, and both A/B session targets remain ready. I then explicitly cleared A's Secondary ID to255 and retried B LED1: both calls returned verified, B recorded one write, and final counts were **three connections, four leases, four releases**. No reservation/manual-recovery dead end remains in this fixture.

The focused hardware-defaults/transition suite again passed **26 tests**, zero failures; evidence `/tmp/cyclo-pr3-recovery-closure-node.txt`. All reported PR3 defects and the recovery note are now closed within the reviewed mock scope. No project files were edited during this follow-up; only this temporary report was appended.
