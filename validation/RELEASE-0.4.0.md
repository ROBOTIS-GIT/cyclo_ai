# Cyclo Plugin 0.4.0 validation

Date: 2026-10-24. Source repository remains private, with portable plugin identity `ai-sapiens-dev`. This release expands knowledge routing without claiming complete ROBOTIS product knowledge.

## Delivered behavior

Fourteen discoverable Skills preserve all eleven 0.3.0 entries and add ROBOTIS expert, integration and DYNAMIXEL expert workflows. The source inventory contains 355 canonical navigation/curated entries and 156 public ROBOTIS-GIT repository metadata records; the local source MCP searches both. Entries distinguish discovery, reviewed guidance and the retained K1 procedure/unsupported levels. Current/legacy namespace and repository status do not establish product availability or discontinuation.

The new five-tool product MCP implements local source/registry queries and separately gated port catalog, bounded Protocol 2 scans and named configuration. The exact curated configuration matrix is XL330-M288-T model1200 firmware52 and XM430-W350-T/R model1020 firmware42. These are software-review/fixture profiles, not manufacturer firmware certification or real-device verification. Unknown firmware/models fail closed. ID and baud changes are separate verified transactions. LED and time/velocity profiles require observed identity, protocol, torque already off, no secondary ID and an isolated exclusive bus. No arbitrary address, torque/motion, reset/reboot or flashing operation is exposed.

Y cascade and X current-based position explanations use distinct official model sources. ROS 2/ros2_control/SDK/hardware-interface and Zenoh guidance distinguishes upstream technology, ROBOTIS integration and selected releases. Other product families route through official catalogs and model/platform-specific retrieval; their full manuals and runtime behavior have not all been reviewed.

## Observed checks

- 71 retained upstream firmware MCP mock tests passed, including existing packet/recovery/lease coverage. The disposable SDK test copy has real port enumeration/open guards and suppresses host serial alias enumeration.
- 26 new configuration/scan tests plus two product stdio integration tests passed. Cases include ID collisions, model/control-table mismatch, unknown firmware, mixed baud, unavailable port, failed write, lost ACK with verified readback, mismatched readback, aborted ID/baud changes and unconfirmed transport closure. Tests assert no repeated write or motion/torque write.
- Three retained packaged firmware stdio tests passed. Product default startup serves source/registry requests and blocks all hardware paths; injected mock startup exercises actual MCP initialize/list/call serialization.
- 30 Python tests passed: 25 retained asset/provenance regressions plus five inventory/discovery/provenance checks. File hashes establish bytes; they do not prove ONNX semantics, authentic training provenance or policy safety.
- All fourteen Skills passed Skill Creator frontmatter validation. Portable plugin/MCP schemas, version consistency, local references and unchanged upstream file hashes are validated by `validate_package.py`.
- The documented SDK-only build command compiled the pinned TypeScript locally without lifecycle generators, firmware builds, hardware discovery or device I/O. Compiled dist files are ignored and excluded from the source ZIP.
- Public source retrieval initially checked 359 observed URLs: 353 retrieved, six returned 404. Four malformed e-Manual navigation links were removed and the parser gained a rejection fixture. The final 355-entry inventory retains two genuine unavailable legacy routes explicitly marked unavailable (OLLO-4 and ai_manipulator_main); canonical ROBOTIS Docs portfolio routes remain available. Retrieval is not semantic review. Initial and filtered evidence are in `current/source-links*.json`.
- An independent fresh agent produced six Korean forward responses using actual Skills, without expected answers. It preserved explanation-only/no-I/O, ID versus baud, interactive profiles, layer distinctions, unknown lifecycle and backend selection. Its three concrete findings were corrected: repository metadata search, education breadcrumbs and experimental branch source URL. See `forward-review-0.4.0.md`. This is a model response evaluation, not host-installed invocation.

## Failures and corrections

The first product stdio run failed the DREAM query because e-Manual titles used LEVEL labels; source-path tags and education namespace titles corrected it and the affected integration test passed. Independent review found repository-only software routes missing from search; the query now merges discovered-only metadata and tests cyclo_control/physical_ai_tools. A final manifest pass initially encountered the not-yet-created release-report link; the report is now present. None of these checks accessed real hardware.

## Unverified boundaries

No installed Codex host invocation, real serial discovery, OpenRB/device access, ROS/Zenoh robot connection, actuator motion, hardware acceptance, GPU training or real policy deployment was performed. The future real SDK provider is implemented but unverified against hardware; its current cooperative bus lease assumes Linux serial character-device paths. Scan budgets are cooperative and do not impose an OS port-open hard deadline. Duplicate physical IDs or secondary listeners cannot be excluded by a timeout alone; physical isolation is required. A cooperative lease cannot block unrelated external applications.

The private Git commit, exact-commit CI result and delivered archive hash are reported alongside the release, not guessed into this source report. The Library ZIP is updated through its existing identity after final package checks. Package installation does not create a GPU executor, production connection, credentials or new hardware permission.
