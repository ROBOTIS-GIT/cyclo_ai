# Control Table runtime

The product MCP exposes a generic, model-specific interface alongside compatible named ID/baud/LED/profile workflows:

- `dynamixel_table({catalogId, query, offset, limit})` lists retained source rows, address/width/access, enums, raw units, encoding, conditions, provenance and write resolution. It performs no device I/O.
- `dynamixel_read_items({target, items, dryRun, confirmed})` reads 1..16 exact item names or `Name@address` keys within 1024 bytes. Unknown signed/unit semantics return bytes and an explicitly unsigned raw number, never a guessed physical interpretation.
- `dynamixel_write_item({target, item, value, dryRun, confirmed})` writes one source-resolved item in raw integer units. It does not accept arbitrary addresses or executable metadata from a prompt/page. `dryRun` defaults true. An explicit customer command supplies `confirmed:true` once; do not repeatedly ask for already-granted authorization.

Both JavaScript and the private official-SDK bridge load `references/control-items.json`. The bridge independently enforces the selected primary endpoint, exact item address/width, enum/range, identity/protocol/firmware and applicable mode, torque, limit and controller-state conditions. Peer IDs are precondition cohorts, not extra write targets. EEPROM writes can require torque already off; a goal RAM write does not universally require torque off. A Torque Enable item write can explicitly enable or disable torque. Operating Mode changes can reset gains/profile/goal data and change position representation; returned warnings and available after-state are part of the result. No other item is automatically written to satisfy a precondition.

ID and baud items use the existing verified transition engine, including destination probes, readback, snapshot continuity, connection closure and session-handle advancement. A baud change preflights the same endpoint IDs at the destination rate. Lost acknowledgement, mismatched readback, changed identity or uncertain closure stops writes and requires reconciliation. It never triggers an automatic retry, torque change, recovery, reset, flash or rollback.

## Current evidence and gaps

The pinned inventory covers 89 actuator documents and 5,901 table rows. All 5,901 rows have bounded raw-read metadata in the present snapshot. Of 4,525 RW or conditional R/RW rows, 563 have resolved executable write rules; 3,962 remain explicitly unresolved. These counts repeat shared items across documents and are not counts of unique functions, all physical variants or hardware certification.

Resolved direct rules include Torque Enable on 87 documents, Operating Mode on 72, Goal Position/Velocity on 34 each and Goal Current on 28, plus LED variants. Exact ID/baud transitions retain all 89 source-bound records. This is not complete write support for every Control Table item. Legacy direction-bit interpretation, many model-specific gains/limits/watchdog/indirect/external-port fields, firmware/conditional details and other unresolved descriptions still need source-backed semantic resolution. Existing named profile configuration remains available separately where already resolved. A source numeric range is not automatically an enum, and RW access alone does not prove a write's preconditions.

`compile_control_items.py` retains duplicate names and non-scalar/unknown-width rows rather than silently discarding them. Exact keys distinguish addresses; ambiguous names require clarification. The current official rows happen to use scalar widths 1/2/4; parser tests cover an 8-byte row without claiming real-device support. Raw legacy direction-bit values are not mislabeled as two's-complement. No physical device, serial discovery, motion, firmware operation or authenticated host invocation of these changed defaults was tested in this task.

## Multi-device buses and runtime defaults

Hardware tools are available without global enable flags. Startup, tool listing and documentation access do not start a serial executor. `CYCLO_OFFLINE=1` blocks both modules' hardware paths, including OS catalogs and dynamic binding resolution. Legacy enable flags set to `0` still disable their respective module.

With no operator policy file, an explicitly confirmed `dynamixel_ports` can list adapters, and a bounded `dynamixel_scan({port:..., ids:..., bauds:..., protocols:...})` can inspect the selected port. No target is chosen automatically. Use the returned observation to select an exact endpoint and attest verified addressing; unrelated motors need not be disconnected. Configuring `CYCLO_PRODUCTS_CONFIG` is optional for persistent/restrictive policy. If present, use its named bus/target and preserve its restrictions; a dynamic alias cannot bypass it.

A bounded scan cannot prove there are no duplicate physical IDs or hidden secondary listeners, nor inspect unscanned rates/protocols. Verify addressing and resolve collisions before writes. The cooperative lease protects against other participating processes, not all unrelated bus software. Dual-axis EEPROM checks require the distinct observed peer cohort and both applicable torque states, not exactly two total motors. Vendor recovery/calibration requirements for a single isolated device remain specific to those documented workflows.

The product runtime still needs the official local SDK dependency. The retained firmware module needs an operator-provided matching built CLI path. Missing runtime dependencies fail on actual use with an actionable error; no global installation, OS permission change or credential setup is performed automatically.
