# Migration from AI Sapiens Development 0.2.0

The unified product display name is Cyclo Plugin and this release is 0.3.0. The portable identity remains ai-sapiens-dev, and all nine ai-sapiens-* skill names remain valid. The source repository is named cyclo-plugin. ZIP packaging uses the ai-sapiens-dev enclosing directory to preserve portable identity. The prior project and ZIP remain unchanged alongside this source directory.

New entrypoints are $cyclo and $cyclo-firmware. The former routes learning/manual requests to retained Skills; the latter explains the separately gated firmware MCP. Existing training/deployment skills remain instructions plus offline helpers, not an executor. Those workflows cannot use the firmware MCP as a GPU, robot registry or Sim2Real deployment service.

A new local stdio server declaration uses modules/firmware/launch.mjs. Dependency preparation is explicit and local; there are no hooks, global install changes or credentials. Default launch blocks hardware execution AND OS serial discovery. Upstream's default local mode would execute permitted reads/writes, so the integration deliberately starts more restrictively. An existing hardware-enabled upstream MCP installation is not silently migrated or reconfigured.

Installation/automatic skill activation in the user's Codex host remains untested. Import/update through the host's supported flow only when authorized, verify all retained/new skills and the harmless capabilities tool, and leave hardware disabled for this task. The OpenRB attached to ProArt must not be enumerated, opened or used.

## 0.4.0 ROBOTIS expert expansion

Portable identity `ai-sapiens-dev` and all existing Skill names remain. Three new task Skills and the separate `cyclo-products` stdio MCP are added; the original firmware module and its source hashes are retained. Refresh the local package and prepare local npm dependencies through your host-supported private/local flow. No global config migration, credentials, hardware grant or persistent connection is performed. Both hardware flags default to zero. Exact old/new MCP descriptions identify their different capabilities; do not fall back to legacy tooling to evade a new-model or firmware refusal. The new device module requires its own explicit operator config and separately built pinned SDK runtime for any later authorized live session.

## 0.5.0 customer workflow

Plugin identity and all fourteen Skill names remain. The existing Cyclo Skill is the declared onboarding entrypoint. Starter prompts now cover model selection, first-device setup and robot-arm software preparation; learning Skills remain unchanged.

Existing operator `targets` remain accepted. New `buses` entries permit bounded discovery from a confirmed port without predeclaring model/firmware/ID. The two new product tools select a completed observation and inspect session state. Configuration continues only after explicit selection/isolation and existing operator grants. Verified ID/baud changes update session handles; failed/uncertain operations block writes. Operator files are never silently changed and session state does not persist across restart. The product registry retains its `targets` name list and adds targetDetails/buses.

Reuse the source/ZIP preparation flow and local dependencies. Validation adds pinned Xacro 2.1.1 in an isolated Python environment; no new robotics runtime is installed or provisioned. Product instruction cleanup does not authorize hardware in any current task.

## 0.6.0 Claude Code adapter

Keep the existing Codex installation flow and root identity. Claude Code reads the added .claude-plugin/plugin.json and shares the actual root skills/ and Node entrypoints. Its MCP entries use CLAUDE_PLUGIN_ROOT; portable Codex entries retain PLUGIN_ROOT. Do not copy Skills into .claude/skills or manually register a second copy of the servers. Use the session-only --plugin-dir flow in references/hosts.md. Source-owner metadata is synchronized to the verified repository/commit author Woojin-Crive; upstream source attribution and notices are unchanged. No global/auth/hardware setup is performed by the adapter.

The 0.6.0 update also replaces the earlier small set of DYNAMIXEL concept examples with a common feature/evidence workflow for the complete pinned model-document set. Two read-only documentation tools join the product server; its hardware configuration permissions are unchanged. Package text and prompts are English, including translated historical response records. No full official document corpus or new license is bundled.

The source repository is now `https://github.com/ROBOTIS-GIT/cyclo_plugin`. Portable plugin identity and Skill names remain unchanged; use the organization repository for future source updates.

## 0.7.0 generic configuration

Product hardware runtime now uses the pinned official Python SDK with optional local pyserial, not the firmware TypeScript runtime. Existing named targets remain compatible where identity is unambiguous; specify protocol explicitly, exact catalog identity for numeric collisions and observed peerIds for dual-axis units. Both axes must be observed and verified. Scan defaults include Protocol1/2 and budget three identity packets. No hidden Drive Mode profile switch remains: use the already selected profile type. RGB/mask LED color must be explicit. Firmware/CLI consumers are unchanged.
