# Independent metadata review for a generic DYNAMIXEL engine

Review scope: read-only analysis of the official English docs checkout at `c88527af0888baea6f7ef3305bbbbb911b960759`, the existing Cyclo module, and the public SDK 3.8.4 checkout at `0b29760ffa81d813bc749cb611a0019938c1e856`. No project source was edited. The SDK Python directory was added to the existing temporary sparse checkout only to read its source. No SDK/device operation, port enumeration, login, credential copy, global install, MDX execution, GPU job or publication occurred. This is metadata/design review, not approval of an implementation that has not yet been reviewed.

## Main conclusion

A model whitelist is not required to discover/document all 89 actuator documents. A trusted, versioned **per-operation capability record** can be built for every document from the model's actual main control table plus its referenced descriptions and caller conditions. Runtime writes must consume that frozen reviewed catalog, never freshly retrieved page text. Unsupported or unresolved prerequisites should disable the affected operation with a precise reason, not label an entire model unsupported.

Header-aware static inspection found main-table identity and relevant operation rows in all **89 actuator documents**. The three DYD documents correctly have no actuator table. This inspection establishes source locations and candidate data, not that every operation/firmware combination is safe or semantically resolved. An intermediate inspection file with the selected raw table rows is at `/tmp/cyclo-v070-reviewed-rows.json`.

## Table layouts must be parsed by headers

The source has several real layouts: legacy six-column tables include Description but no Range; X commonly has seven columns; P has a Modbus-address column; Y has Modbus address plus an explicit Area column; XL-320 supplies separate Min/Max columns. A positional seven-column parser silently misses legacy/MX/P or mistakes access for initial value. Parse explicit header names and preserve original row text, line, section/Area, width/access, and unresolved expressions.

Do not infer a field from an unrelated table in a detail partial. An exact named main-row and its parent section/anchor should identify address and width. Description/default components provide units/behavior/conditions. Conflicts must be retained in evidence and resolved by an explicit reviewed precedence rule or block that field; do not silently let a copied partial label override the model table.

## Identity and protocol gates

- Every actuator main table inspected uses Model Number at address 0, width 2. The observed protocol, model number and firmware must be separate identity fields; model names or defaults are not observations.
- Legacy AX/DX/EX/RX/original MX use Firmware Version at 2, ID at 3, baud at 4 and Torque Enable at 24. Modern MX firmware, most X, P and PRO use firmware at 6 and ID at 7; Y moves baud to 12 and protocol to 11. XL-320 is Protocol 2 with legacy-style ID3/baud4/firmware2/torque24. Protocol version does not uniquely select an address layout.
- SDK Python Protocol-1 `ping()` already sends a ping and then reads Model Number(0:2). Its Protocol-2 `ping()` returns model number but drops the firmware byte from the ping payload. Read firmware from the resolved metadata address; do not assume it was returned by this SDK function. Protocol-1 broadcast ping returns COMM_NOT_AVAILABLE.
- `PacketHandler()` silently defaults to Protocol 2 for unrecognized inputs. The wrapper must explicitly validate protocol 1 or 2 before constructing it; unknown protocol must never become an implicit Protocol-2 attempt.
- Only read firmware/identity fields after resolving a safe common bootstrap layout for the observed candidates. An unknown model number is not permission to read arbitrary guessed registers. Identity/status/transport errors must stop mutation.
- No hardcoded firmware-number whitelist is needed for unconditional documented fields. Preserve the observed byte and evaluate each explicit firmware gate. An unreadable/unknown firmware cannot satisfy a conditional feature bound; do not turn an arbitrary byte into blanket permission for all future features.

### Ambiguous model numbers

The source itself contains these collisions:

| Number | Candidate documents |
| --- | --- |
| 1070 | XC430-W150 and XC430-T150BB |
| 1080 | XC430-W240 and XC430-T240BB |
| 1270 | XW430-T200 and XW430-T333 |

Do not implement number-to-first-document lookup. Keep the candidate set. A physical label/user confirmation can select a documented candidate, but it is not an electronic unique-identity proof. Alternatively, a narrowly scoped operation may use only a reviewed common projection when **all** remaining candidates have identical required addresses, widths, semantics and bounds, with the ambiguity disclosed. If not proven equivalent for the requested action, block it pending disambiguation. In particular, do not borrow a profile's mechanical/application limits across the XW variants simply because the model number collides.

MX generations are numerically distinguishable when observed correctly: MX-28 original=29 / Protocol-2 firmware=30; MX-64=310/311; MX-106=320/321. PRO R versus R(A) similarly have different model numbers (for example H54-200-S500 54024/54025) and different layouts. A bare family name is not enough; retain the exact document/generation and observed numeric identity.

## Operation-specific boundaries

| Source layout | Candidate ID/baud fields | LED semantics | Profile boundary |
| --- | --- | --- | --- |
| AX/DX/EX/RX/original MX (15 docs) | ID3, baud4, torque24; Protocol-1 rules | LED25, usually binary | No modern Profile Acceleration/Velocity pair; do not repurpose Moving Speed or Goal Acceleration as this operation |
| MX Protocol-2 firmware (3 docs) | ID7, baud8, torque64, protocol13/secondary12 | LED65 binary | Profile108/112, exact mode and firmware gates required |
| X (36 docs) | Most ID7/baud8/torque64; XL-320 is ID3/baud4/torque24 | Most LED65; XL-320 LED25 is color mask0..7; five XW docs have no writable LED row | Table/description/generation must establish the profile fields and mode; no universal X rule |
| P (6 docs) | ID7/baud8/torque512, protocol13/secondary12 | Three RGB bytes513/514/515, each0..255 | Profile556/560; time/velocity interpretation and firmware gates differ from X |
| Original PRO R (11 docs) | ID7/baud8/torque562 | RGB563/564/565 | No modern Profile556/560 pair; do not substitute goal fields |
| PRO R(A) (6 docs) | ID7/baud8/torque512, secondary12 | RGB513/514/515 | Profile556/560, relevant gate/limits required |
| Y (12 docs) | ID7/baud12/protocol11/secondary10/torque512 | LED513 binary | Velocity240/244, separate time248/252; Hybrid persistence and source conflicts matter |
| DYD (3 docs) | No serial actuator identity/control table | None | Mechanical reducers, no register operations |

These are source-layout summaries for review, not executable family whitelists. Runtime eligibility must come from each document's verified record. Missing rows, unresolved semantics, transport limits or current-state prerequisites produce operation-specific reasons.

### ID and baud

Use the actual model's ID range. Some Protocol-1 descriptions allow 0..253, while Protocol-2 and XL-320 use 0..252. A conservative executor may expose a narrower clearly labeled policy, but it must not report that restriction as a manufacturer/model limitation. Broadcast/reserved IDs are never configuration targets. Probe the requested destination, retain physical isolation, and verify model/firmware and unchanged snapshot fields after a one-shot change, not just a response at the new ID.

Baud encodings are not uniform: legacy values use published nominal-rate mappings (and a documented divisor formula in some models); XL-320 uses its own0..3 table; most X/MX2 use enum0..7; X330/XM335 stop at enum6 with different defaults; original PRO's enum8 is10.5M; P/PRO(A)/Y use enum8=6M and9=10.5M. Parse the exact referenced baud table. Do not use one global ordered list as a register encoder.

The selected Python SDK 3.8.4 executor has a separate, critical rate limit: `port_handler.py:getCFlagBaud` accepts only 9600, 19200, 38400, 57600, 115200, 230400, 460800, 500000, 576000, 921600, 1000000, 1152000, 2000000, 2500000, 3000000, 3500000, 4000000. Other values return -1 and `setBaudRate()` returns False; custom baud is TODO. Thus model-documented4.5M/6M/10.5M and some legacy200k/250k/400k rates cannot be claimed as usable by that Python provider. Check destination **backend** rate capability before writing the baud register, otherwise a successful device write could strand the executor. Backend limitations are not model limitations.

### LEDs

Treat binary, RGB-mask and three-channel RGB as distinct operation schemas. For XL-320 a value1 means red, not a generic Boolean representing every color. For P/PRO RGB, ask the intended color/intensity and preserve/report individual channel snapshots; do not write a Boolean to an arbitrary first channel. XW's absent LED row means this configuration action is unavailable from the source even if a physical status indicator exists. Shutdown/alarm status can take precedence over LED settings; register readback does not prove visible illumination.

### Profiles and prohibited mode changes

The current request excludes mode changes. Read Drive Mode/Operating Mode/Protocol Type only. If a requested time/velocity interpretation does not match the already selected profile mode, explain the boundary rather than writing a profile-selection bit as a hidden mode change. Never write a goal or torque field to test a profile.

For X/MX2, source units generally are0.229rpm and214.577rev/min2 or1ms, but exact caller props matter. Time profiles commonly require firmware42; X330 callers suppress that shared note rather than inheriting a fabricated minimum42. X430 callers can gate Drive Mode itself since38. Current-based position applicability is passed through props and is not universal. Reject zero/infinite values under a bounded-configuration policy and check user/application limits and applicable device limits. Velocity mode may use acceleration only; do not promise the velocity field has an effect there.

P/PRO(A) use profile556/560 and time support notes at firmware12. Their acceleration description has malformed unit/range text and a copied112 reference, while the main model table provides units/limits. Resolve those fields explicitly or block the affected profile action; do not import X's acceleration unit. Y uses10rev/min2,0.01rpm and0.2ms on distinct registers with different ranges and Hybrid persistence. The Y velocity-profile detail partial incorrectly labels240/244 as248/252, and its profile-description formula copies X108/112. The main model table and parent heading agree on240/244, but the source inconsistency must be recorded and reviewed rather than silently erased.

## Special prerequisites

### Dual-axis devices

The 2XC430/2XL430 source explicitly states that each axis has its own table, while baud8 and protocol13 are shared and EEPROM updates require **both axes' Torque Enable64 to be0**. Checking only the selected ID is insufficient. Do not infer the second ID as ID+1 or pair arbitrary same-model responders; IDs can change. Require a physically isolated single module and an explicitly identified axis cohort with both identities/torque states verified, plus shared-communication readback. If that cohort prerequisite is not implemented, fail the affected operation as `multi-axis prerequisite unresolved`, not as an arbitrary model blacklist. A generic single-response discovery workflow cannot pretend it verified this device-level condition.

### Y and Modbus

Y main rows include even DYNAMIXEL-Protocol-2 model numbers and corresponding odd Modbus firmware numbers. The Model Number description says protocol variants are changed through firmware recovery. The Protocol Type partial still labels Modbus10 as TBD/future. Preserve that conflict. A DYNAMIXEL SDK1/2 executor is not a Modbus executor; odd/Modbus identity or unmatched protocol cannot fall back to Protocol2 or be fixed by a Protocol Type write. Reject transport mismatch with a precise reason and keep documentation support available. Do not convert Modbus4xxxx addressing directly into DYNAMIXEL byte addresses.

### RC fallback and EEPROM/Hybrid

X330 RC protocol modes can fall back to Protocol2 at boot from firmware52 while retaining a different configured protocol context; valid Protocol2 packets alone do not justify ignoring Protocol Type or auto-torque behavior. Do not change protocol, enable torque, or broaden to RC operation. EEPROM write prerequisites use the metadata's actual torque register, never a global64 constant. Y Hybrid fields have different persistence behavior depending on torque and save state; no save instruction is authorized in this scope. Return verified runtime readback separately from persistence claims.

## Suggested frozen capability evidence

Each operation should carry: canonical document ID; candidate numeric identity and protocol variants; source revision/path/blob/line for the main row; address/width/access/memory; value representation and scale; bounds or referenced limit fields; relevant description/caller/default evidence; firmware/mode/torque/axis requirements; persistence behavior; conflicts/unresolved fields; and an explicit eligibility reason. The runtime should validate this schema and integrity, require exact identity/current-state observations, then generate only the fixed named operation's writes. No caller can submit an address, raw table, arbitrary command or source URL to expand writes.

Independent code review and meaningful mock failure tests remain necessary after implementation. Include duplicate numeric identities, both protocol generations, dual-axis incomplete cohorts, Y transport mismatch, backend-unsupported destination baud, RGB/mask semantics, unknown firmware gates, stale observations, lost ACK, readback/closure failure and continuation after verified changes. This metadata review does not replace either required implementation review or real-device validation.

## Supporting source locations

- Official root model tables and their per-model import/caller graph under `docusaurus/docs/dxl/model_reference/` at the pin above.
- `dxl/_partials/x/control_table_2x_warning.mdx`, `control_table_baudrate_2*.mdx`, `control_table_profile_*.mdx`, `control_table_drivemode*.mdx`, `protocol_type_rc.mdx`.
- `dxl/_partials/mx/control_table_mx_baudrate.mdx`, `dxl/_partials/mx2/control_table_baudrate_2.mdx` and profile partials.
- `dxl/_partials/p/` and `dxl/_partials/pro/` baud, LED, torque and profile partials. Several torque description bodies incorrectly say64 while the model table and local links identify512 or562; do not reuse the copied literal.
- `dxl/_partials/y/y_control_table_0_model_number.mdx`, `_11_protocol_type.mdx`, `_12_baud_rate.mdx`, `_240_profile_acceleration.mdx`, `_248_profile_acceleration_time.mdx`, `_513_led.mdx`, `y_y_control_table.mdx` and `y_y_profile_description.mdx`.
- SDK `python/src/dynamixel_sdk/packet_handler.py`, `protocol1_packet_handler.py`, `protocol2_packet_handler.py`, `port_handler.py`, `robotis_def.py` at the SDK checkout pin above.
