# Runtime architecture

The project has three layers: reusable device operations, an MCP interface, and task skills. Documentation retrieval uses a separate read-only knowledge path. Private firmware code is not a runtime dependency.

| Layer | Entry points | Responsibility |
| --- | --- | --- |
| Host interface | `modules/dynamixel/server.mjs` | Tool schemas, operator policy, cancellation, error envelopes and bus ownership |
| Session state | `selection.mjs`, `bus-session.mjs` | Scan observations, single/batch selection, inherited permissions, transport ownership and reconciliation |
| Device operations | `table.mjs`, `workflow.mjs`, `swap.mjs`, `group.mjs`, `raw-read.mjs` | Source-resolved operations, verified transitions and read batching |
| Contracts | `registry.mjs`, `item-metadata.mjs`, `custom_tables.py` | Identity, item layout, encoding, applicability and prerequisites |
| Connection | `provider.mjs`, `sdk_bridge.py`, `transports.py` | Owned Python subprocess, official SDK packets, serial/TCP/UDP and explicit closure |
| Knowledge | `manual.mjs`, `modules/knowledge/source.mjs` | Pinned source retrieval with original text, line numbers and hashes |
| Guidance | `skills/`, `references/` | User workflows, product knowledge and host setup |

A connection exposes `ping`, `probe`, `read`, `write`, `close`, and optionally `syncRead`, `bind`, `canBaud`. `read` returns exact bytes; `write` receives explicit bytes and acknowledgement policy. `close` resolves only when transport closure is established. A failed open must clean up its owned transport or throw `TransportClosureError`. This allows the host to release a lease after an ordinary failed open while retaining it when ownership is uncertain.

Operations accept an injected connection factory and an AbortSignal. They return an outcome, observed data, and closure evidence. Device status errors, missing acknowledgements, readback mismatches, and physical completion are different states. Never represent a successful register write as a completed physical motion.

Large read requests are split into SDK batches (at most 16 IDs and 4096 returned bytes per batch). Named item reads iterate over the requested table items. Integer reads up to 6 bytes use exact JSON numbers; 7/8-byte integers use `rawUnsignedDecimal` and, when resolved, `valueDecimal` strings to avoid precision loss. Wider blocks retain raw bytes. Cancellation is checked between operations. Batches are ordered observations, not a simultaneous snapshot across an entire robot.

Selection does not write or grant configuration permission. Read-only buses create read-only targets. Addressing verification is required by writes, not ordinary selection or inspection. A fresh scan can replace a blocked target under the original name. Multi-selection rolls back session additions if one candidate fails.

JavaScript validates plans before I/O; Python independently validates the final write against the same canonical contract. Changes to shared conditions need JavaScript/Python parity tests. Keep those checks aligned rather than bypassing either layer.

`release-files.json` is the reviewed distribution inventory. Packaging and source validation read it without crawling local environments. Fixed archive timestamps and permissions make repeated builds of identical source reproducible. CI validates both the checkout and extracted release bytes.
