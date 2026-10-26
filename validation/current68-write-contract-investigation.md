# Original MX Current(68) write-contract investigation

Conclusion: no public official source examined defines a valid host-WRITE domain or the effect of writing Current(68) on original MX-64/MX-106. The current manuals explicitly mark the item RW, so it is also not justified to relabel it read-only or claim the RW label is proven erroneous. This is a manufacturer-contract ambiguity, not a unit-conversion or generic parser gap.

No project files were changed and no devices, serial catalogs, OS permissions, credentials, installations or physical tests were used. Only current public official documentation/library sources were read. Sources were pinned and cached under `/tmp/current68-sources`; complete hashes are in `/tmp/current68-source-manifest.json`.

## Current official model documentation

The current ROBOTIS-GIT/docs main commit was verified as `c88527af0888baea6f7ef3305bbbbb911b960759` during this investigation.

- [MX-64 table row, line146](https://github.com/ROBOTIS-GIT/docs/blob/c88527af0888baea6f7ef3305bbbbb911b960759/docusaurus/docs/dxl/model_reference/mx_series/mx-64.mdx#L146): Current at address68, width2, RW, initial0.
- [MX-64 description, lines283–311](https://github.com/ROBOTIS-GIT/docs/blob/c88527af0888baea6f7ef3305bbbbb911b960759/docusaurus/docs/dxl/model_reference/mx_series/mx-64.mdx#L283): sensed current is centered at raw2048, with4.5mA per raw difference; the separate Goal Torque item is address71. No Current68 write range, instruction, effect or prerequisite is specified.
- [MX-106 table row, line147](https://github.com/ROBOTIS-GIT/docs/blob/c88527af0888baea6f7ef3305bbbbb911b960759/docusaurus/docs/dxl/model_reference/mx_series/mx-106.mdx#L147) and [description, line287](https://github.com/ROBOTIS-GIT/docs/blob/c88527af0888baea6f7ef3305bbbbb911b960759/docusaurus/docs/dxl/model_reference/mx_series/mx-106.mdx#L287) have the same access/telemetry-only description.

The current legacy ROBOTIS-GIT/emanual master commit was verified as `0807b1b5f7472bbbbb2c9751f1d3406678e86d37`.

- [English MX-64 table79 and description207](https://github.com/ROBOTIS-GIT/emanual/blob/0807b1b5f7472bbbbb2c9751f1d3406678e86d37/docs/en/dxl/mx/mx-64.md#L79).
- [English MX-106 table98 and description230](https://github.com/ROBOTIS-GIT/emanual/blob/0807b1b5f7472bbbbb2c9751f1d3406678e86d37/docs/en/dxl/mx/mx-106.md#L98).
- [Korean MX-64 table80 and description208](https://github.com/ROBOTIS-GIT/emanual/blob/0807b1b5f7472bbbbb2c9751f1d3406678e86d37/docs/kr/dxl/mx/mx-64.md#L80).
- [Korean MX-106 table80 and description211](https://github.com/ROBOTIS-GIT/emanual/blob/0807b1b5f7472bbbbb2c9751f1d3406678e86d37/docs/kr/dxl/mx/mx-106.md#L80).

Both languages retain RW and the same current-consumption description. They do not provide a correction to R or a write contract. The live English e-Manual pages likewise retain this content: [MX-64](https://emanual.robotis.com/docs/en/dxl/mx/mx-64/#current-68), [MX-106](https://emanual.robotis.com/docs/en/dxl/mx/mx-106/#current-68).

## Official implementation evidence and its limits

Current Dynamixel2Arduino master was verified as `89f1387f6973a4acf4911785d741db2b99afa2bb`.

- [Dynamixel2Arduino.cpp1169–1174](https://github.com/ROBOTIS-GIT/Dynamixel2Arduino/blob/89f1387f6973a4acf4911785d741db2b99afa2bb/src/Dynamixel2Arduino.cpp#L1169) defines MX64/MX106 SET_CURRENT as Goal Torque, raw0..2047, and GET_CURRENT as Current, raw0..4095. These are deliberately different items. The GET domain does not establish a valid WRITE domain for Current68.
- [actuator.cpp112](https://github.com/ROBOTIS-GIT/Dynamixel2Arduino/blob/89f1387f6973a4acf4911785d741db2b99afa2bb/src/actuator.cpp#L112) and [line122](https://github.com/ROBOTIS-GIT/Dynamixel2Arduino/blob/89f1387f6973a4acf4911785d741db2b99afa2bb/src/actuator.cpp#L122) describe Current68 as a two-byte item. No access/range/effect contract is supplied by these address/width descriptors.
- [generic write implementation997–1010](https://github.com/ROBOTIS-GIT/Dynamixel2Arduino/blob/89f1387f6973a4acf4911785d741db2b99afa2bb/src/Dynamixel2Arduino.cpp#L997) can serialize the requested number of bytes to an item address. That transport capability is not evidence of a valid Current68 domain or semantic effect.

Current archived Dynamixel Workbench main was verified as `55b000a64fb94df53165be6a3ac1c6dcb6626f00`.

- [dynamixel_item.cpp416–419](https://github.com/ROBOTIS-GIT/dynamixel-workbench/blob/55b000a64fb94df53165be6a3ac1c6dcb6626f00/dynamixel_workbench_toolbox/src/dynamixel_workbench_toolbox/dynamixel_item.cpp#L416) separately identifies Current68, Torque Control Mode Enable70 and Goal Torque71. It establishes addresses/widths, not valid Current write values or effects.

The official SDK packet handlers similarly serialize bytes for arbitrary addresses rather than defining per-model write semantics. For the package's verified official SDK3.8.4 pin, [protocol1_packet_handler.py409–438](https://github.com/ROBOTIS-GIT/DynamixelSDK/blob/0b29760ffa81d813bc749cb611a0019938c1e856/python/src/dynamixel_sdk/protocol1_packet_handler.py#L409) constructs a WRITE packet and two-byte data without model-specific domain validation. Its ability to transmit a write is not permission or evidence for Current68 behavior.

## What can and cannot be concluded

Established: original model tables label Current68 RW; the item is two bytes; documented consumption telemetry is offset-coded around2048; official high-level SET_CURRENT uses Goal Torque71 instead; official GET_CURRENT uses Current68 with a0..4095 read/conversion domain.

Not established: whether a write to68 is accepted, ignored, temporarily overwrites sampled telemetry, changes calibration/offset, changes control behavior, or is an access-label error; whether any firmware revision supports a special writable use; a valid write interval or enum; required torque/mode conditions; persistence and readback timing.

Do not:

- Infer0..65535 from width or0..4095 from a GET conversion domain as the WRITE range.
- Treat Goal Torque71 semantics as Current68 semantics.
- Assert that RW is a known typo or that the item is read-only without manufacturer confirmation.
- Experiment on a real actuator under this implementation task.

## Minimal manufacturer clarification needed

For original MX-64 model310 and MX-106 model320, excluding MX(2.0):

1. Is Current68 intentionally host-writable, or should the access metadata be R? State applicable firmware revisions.
2. If writable, what does a write do, and what are the exact valid raw bit patterns/ranges, encodings and special values?
3. What mode/torque/runtime prerequisites apply, and can a write affect motor output, sensor calibration or protection behavior?
4. Is the written value retained, overwritten by current sampling, or read back differently; what acknowledgement/readback verification is valid?

A documented correction to R resolves both rows as non-writable. A documented write contract resolves both through the existing generic engine. Until one is available, keep the exact two rows explicitly unresolved while allowing documented reads; do not claim a blanket all-write implementation is manufacturer-verified.
