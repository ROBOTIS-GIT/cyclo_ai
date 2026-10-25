# Cyclo Plugin 0.6.0 validation

This release adds a Claude Code host adapter to the existing Codex package. It expands official-source documentation coverage while leaving supported executable device profiles and execution permissions unchanged. Source base: merged main 0.5.0 at `64633a9f413501730d68c9e1626e60193331a46b`; the earlier merge is not repeated.

## Package changes

- Root `plugin.json` and `mcp.json` retain portable/Codex behavior. `.claude-plugin/plugin.json` declares the same identity/version, verified source-owner attribution and two local MCP entrypoints with Claude's documented root variable.
- All fourteen actual root Skills are shared. There are no copied Skills, symlink wrappers, extra command aliases or hooks. No `skills` manifest override scans the default directory twice, and no root `.mcp.json` duplicates the inline Claude server definitions.
- Shared instructions route invocation/tool identifiers through `references/hosts.md`; Codex uses `$skill-name`, Claude uses `/ai-sapiens-dev:skill-name`. Existing Codex `agents/openai.yaml` metadata is preserved.
- Hardware flags remain `0` for both hosts. Server resources resolve relative to their own files, including unrelated working directories and plugin paths containing spaces.

## Observed verification

The existing host had no `claude` executable on PATH. Official npm packages `@anthropic-ai/claude-code` and its Linux native optional dependency were prepared under a temporary directory with lifecycle scripts disabled. The wrapper could not run because its postinstall had intentionally not placed the binary; the provided official native executable reported Claude Code 2.1.310 and its help was checked before validation. No installer script, global installation, login or credential copy was performed.

Claude's actual `plugin validate --strict --json` passes with no manifest errors or warnings. `--plugin-dir ... plugin list --json` shows one session-only enabled plugin, version 0.6.0. `plugin details` discovers exactly fourteen Skills, two MCP servers and no hooks/agents/LSPs. Directory-submission advice separately reports missing first-party license/icon; local strict validation succeeds without the public-directory profile. This release does not change licensing or claim public-directory readiness.

Five new offline checks compare host manifests and initialize/call both server declarations from a temporary root/cwd containing spaces. Default registry/capabilities and official-source metadata work; hardware discovery remains blocked. Existing regression, workflow/selection, ROS artifact and package checks remain applicable. Final results, native CLI inventory and the extracted-ZIP suite are recorded with the release evidence.

Evidence levels remain separate: static schemas/manifest checks, actual Claude CLI validation/inventory, standalone MCP stdio calls, device mocks and authenticated host invocation. Authenticated Claude model/Skill execution has not been demonstrated in the isolated test profile; no new auth was provisioned and prior Codex 401/billing boundaries are not bypassed. Real serial/hardware, OpenRB, ROS/Zenoh robot access, GPU training and physical deployment remain untested and were not performed.

## Equal DYNAMIXEL source guidance and English-only content

The official full-tree denominator is 103 model-reference MDX files: 11 indexes, 89 actuator documents and three mechanical DYD reducer documents. Family counts are AX3, DX3, EX1, MX7, P6, PRO17, RX4, X36 and Y12. All follow one documentation pipeline with no privileged motor tier. Sidebar labels supplement model headings/file identities, while source-only XW540-H260 remains included. Original MX/Protocol-2 firmware and PRO R/R(A) are not alias-merged. Physical variants can share documents; counts are not every physical SKU.

The metadata indexes 463 shared partials, conditional caller invocations and source locations at official docs revision c88527af0888baea6f7ef3305bbbbb911b960759. Actual reader probes read all 92 product documents and blob-verified 553 reachable unique sources with no retrieval errors. Two public HTTPS retrieval cases also passed. MDX/JSX is not executed or flattened: exact applicability must be resolved from caller props, component defaults/branches and firmware/mode notes, or remain explicitly unresolved. One non-English typo line in the official Y table partial is reported/withheld with its source position; legal notices are unchanged. Full manual text is not redistributed.

All authored package prose, examples, prompts and historical response records are English. Historical Korean evaluations were translated with their original decisions/findings preserved and labeled as translations, not rerun evidence. A regression guard scans packaged UTF-8 text, JSON-decoded strings and HTML entities over Hangul Unicode ranges. It also reports third-party conflicts rather than changing notices. No such packaged upstream conflict was found.

The expanded offline suite includes all-family inventory/generation/alias checks, source integrity/unavailable-path failures, conditional evidence and comment/line policies, English guard cases and all existing hardware-safety regressions. Static/source coverage and successful reads are not exhaustive semantic verification, authenticated host acceptance or physical-device support. See dynamixel-coverage-audit-0.6.0.json and the current source probes.

Independent review found and prompted corrections to bare MX generation ambiguity, a non-UTF8 text/escaped-prose language-guard loophole, and missing source checkout/tree revision binding. Bare MX-28/64/106 now require generation selection; known packaged text must be UTF-8, encoded JSON/YAML/Markdown/script prose is checked, and the index compiler verifies its checkout and tree provenance before emitting pinned links. Regression fixtures cover each correction.

Final offline suite: 169 tests (71 pinned firmware mocks, 42 configuration/selection/stdio, 7 official-reader, 5 dual-host declaration/stdio, 3 retained launcher stdio, 41 Python checks). Fourteen Skill Creator validations and manifest/local-reference/source-hash checks also apply. The final extracted ZIP is tested separately with the same offline suite and language guard; its immutable hash/results are recorded with the delivery. Native Claude CLI validation/inventory is rechecked separately from mocked/device and authenticated invocation evidence.

## Repository destination

The authorized source repository is https://github.com/ROBOTIS-GIT/cyclo_plugin (verified private, initially empty). Existing project history is retained. The former personal remote is no longer a publishing destination. This changes source hosting only; no public release, license grant, global host installation or device authorization follows.

The organization repository initially created no push/PR Actions run despite an active enabled workflow. A manual `workflow_dispatch` entry uses the same read-only offline job to make exact-ref CI verification available; no workflow permissions or branch rules are expanded. Organization main requires two approving reviews and signed commits, which remain release gates.
