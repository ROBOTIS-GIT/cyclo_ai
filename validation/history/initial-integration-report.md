# Cyclo Plugin 0.3.0 validation

Date: 2026-10-24. This is private source/package integration, not marketplace publication or global installation. The original proart-ai-sapiens-development/ai-sapiens-dev 0.2.0 source and archives are unchanged. New source is in the sibling cyclo-plugin directory. Portable identity remains ai-sapiens-dev; display name is Cyclo Plugin.

## Implemented integration

All nine AI Sapiens Skills and the offline asset audit remain; $cyclo and $cyclo-firmware add module routing and exact firmware capability boundaries. Source retrieval and the 34-page guidance/procedure/runtime matrix remain dated baselines, not a claim of robotics execution.

Upstream Cyclo firmware MCP 0.1.0 and SDK are imported without source changes from ROBOTIS-GIT/cyclo_firmware feature-new-standard commit e52600c020f3d98c1adae260cebc0b8a83f6a71d. Apache-2.0 license/SPDX notices and file hashes are retained. No upstream AGENTS.md/SKILL.md or NOTICE was present in the inspected tree. No private submodule was fetched. The broader typed CLI is deliberately not duplicated or exposed; future hardware use needs an explicitly selected matching external upstream CLI build.

The real packaged local stdio entrypoint is modules/firmware/launch.mjs, wired through schema-valid root mcp.json. Default startup forces hardware off even if a supplied config grants reads. Runner, serial catalog and serial resolve callbacks reject before device/OS enumeration. Capabilities is available and configured synthetic-target dryRun returns upstream argv without execution. There are no hooks or global registration changes. The upstream tools remain limited: XL330 model 1200 named RDT/baud/LED changes, strict identity/grants, torque-off EEPROM prerequisite, readback and partial/unknown evidence. No motion/torque/flash/ID/reset/reboot/arbitrary-write tool was added. SDK source containing other capabilities does not expose them through this MCP.

## Actual tests

Environment: Node 24.22.1, npm 11.19.1, PyYAML 6.0.3, jsonschema 4.19.2. Node minimum is upstream >=22; only the recorded local version has been exercised. Dependencies were installed locally with lifecycle scripts disabled; no global authentication/install settings were changed.

- TypeScript compilation of the pinned generated SDK source passed in a disposable test copy. Firmware/XML generators and device builds were not run.
- All 71 upstream MCP tests passed: adapter policy/schema rejection, leases, process limits/cancellation, mock packet configuration/readback, identity/firmware/torque refusal, partial/unknown/cleanup evidence, scans and modern/legacy stdio.
- All 3 integration stdio tests passed: actual packaged launcher initialize/list/capabilities for legacy and modern negotiation, hardware/catalog/resolve refusal, unsupported tool rejection, and configured synthetic dryRun with execution blocked.
- All 25 retained Python tests passed, including unsigned export-record consistency limits and failure cases. Test bodies were retained; only the source-root path in the harness was adapted.
- All 11 Skill frontmatters/UI metadata passed the skill-creator validator. Portable plugin and MCP manifests pass current official schema validation; 107 first-party local references resolve. Imported upstream Markdown is preserved unchanged and may reference omitted parts of its source repository; it is not treated as first-party instruction routing.
- Every imported upstream source hash matches UPSTREAM.json. No upstream source edit is hidden.

Mock isolation: the test runner copies source under a temporary workspace, compiles it, then suppresses the compiled SDK serial-alias directory enumeration and replaces serial open/default OS catalog methods with rejecting guards. The copy is deleted afterward. Mock packet transports never use the real serial transport. Known pseudo-device fixture paths may be stat'ed for alias/lease tests; no attached serial hardware is enumerated or opened. The ProArt OpenRB is not used. No TCP/UDP robot endpoint is contacted.

The first restricted-shell run hit child-process EPERM and was not counted as successful. The reviewed mock-only stdio process run subsequently completed all suites; no automatic approval review rejection occurred. Logs in validation/current show the actual successful outputs and test counts.

## Runtime and publication limits

Mock stdio invocation is not installed Codex host activation. No actual hardware open/read/write/scan, firmware flash, robot motion, GPU training, Docker image build, licensed-model download or robot deployment occurred. Hardware-enabled launcher path/external CLI build and physical acceptance remain untested. Learning/deployment Skills continue to provide instructions/preparation, not a new GPU or policy executor. Default disabled tools do not prove that no devices are attached.

GitHub owner and repository existence were checked before publication. Authenticated login is Woojin-Crive; cyclo-plugin returned authenticated 404 before creation. Only a PRIVATE repository is authorized; no collaborators or public visibility changes are requested. Remote commit/private visibility and exact-commit CI must be checked after push; final remote verification is recorded separately rather than predicted here.
