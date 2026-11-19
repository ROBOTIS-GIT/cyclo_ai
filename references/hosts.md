# Codex and Claude Code

The portable root `plugin.json` and `mcp.json` retain Codex support. Claude Code reads `.claude-plugin/plugin.json`. Both hosts use the actual root `skills/<name>/SKILL.md` directories and the same Node server entrypoint; there are no copied skills, command wrappers or symlinks. `agents/openai.yaml` is Codex UI metadata and is not needed by Claude Code.

## Invocation and tools

| Host | Setup / routing | Examples |
| --- | --- | --- |
| Codex | Use its supported local/private plugin flow and declared onboarding Skill | `$cyclo`, `$robotis-expert`, `$dynamixel-expert`, `$ai-sapiens-walking` |
| Claude Code | Load this directory for the current session; then invoke the shared Cyclo Skill | `/cyclo-ai:cyclo`, `/cyclo-ai:robotis-expert`, `/cyclo-ai:dynamixel-expert`, `/cyclo-ai:ai-sapiens-walking` |

References to a Skill by name or relative file link in shared instructions mean that packaged Skill, not a host-specific command to execute blindly. Use the active host's invocation syntax. Tool names such as `robotis_sources` are logical MCP names; use the tool identifiers actually discovered in that host. Do not invent a `mcp__...` prefix, a Codex URI or a cross-host install URL. When a host lacks web/source tools, use the reviewed local references and report the missing retrieval capability. No remote docs MCP or executor is created by this package.

## Local Claude Code session

Use the install ZIP with bundled libraries, or prepare source dependencies as in [first use](first-run.md). Inspect installed CLI version/help before relying on these documented commands; command availability varies by version:

```sh
claude --version
claude plugin validate --help
claude plugin validate /absolute/path/to/cyclo-ai --strict
claude --plugin-dir /absolute/path/to/cyclo-ai plugin list --json
claude --plugin-dir /absolute/path/to/cyclo-ai plugin details cyclo-ai
claude --plugin-dir /absolute/path/to/cyclo-ai
```

In that session use `/cyclo-ai:cyclo`. `--plugin-dir` is session-only; it is not a global plugin installation. No marketplace registration, new login or credential copying is required to validate package structure. Authenticated model invocation still needs the host's already-authorized account/API access. If unavailable, stop at validation/inventory and report invocation unverified. Never bypass a 401, billing denial or organization restriction.

Claude registers one MCP server from its manifest's inline `mcpServers` map, with `${CLAUDE_PLUGIN_ROOT}` in argument strings. There is deliberately no root `.mcp.json` or second Claude MCP declaration. Codex's portable `mcp.json` uses `${PLUGIN_ROOT}` and is not Claude's automatic `.mcp.json`. Do not additionally register these same servers with `claude mcp add`. The launchers resolve packaged resources relative to their files and work independently of the process working directory, including paths containing spaces.

Both host declarations make hardware tools available by default without startup device I/O. Set `CYCLO_OFFLINE=1` for an explicit no-device-I/O opt-out; legacy module enable flags set to `0` also disable the corresponding module. Preserve explicit operator policies and task restrictions. Tool availability alone does not authorize a port scan, register write, motion, flashing, training or deployment; live calls require the customer's concrete authorization, applicable target validation and documented preconditions. Static validation, host inventory, standalone stdio, mocks and authenticated end-to-end invocation are separate evidence levels; none establishes physical robot safety.

Sources checked for this adapter: [manifest](https://code.claude.com/docs/en/plugins/manifest-reference), [plugin CLI](https://code.claude.com/docs/en/plugins/cli-reference), [Skills](https://code.claude.com/docs/en/skills), [MCP](https://code.claude.com/docs/en/mcp).

## Normal Codex installation

This repository contains a local marketplace catalog exposing `cyclo-ai` from the repository root. Inspect the installed CLI help first, then use its supported flow:

```sh
codex plugin marketplace add /absolute/path/to/cyclo-ai
codex plugin add cyclo-ai@cyclo-local --json
codex plugin list --marketplace cyclo-local --json
```

Use the install ZIP, or prepare the local Node dependencies before source installation. Verify the installed server runtime resolves its libraries. The install ZIP resolves Python libraries relative to the packaged bridge, so copying it to a host cache does not require an external virtual environment. Back up affected Codex configuration before changing registration; preserve unrelated plugins, MCP servers, skills, authentication and security settings. Do not hand-edit the host cache. Do not delete unrelated settings or stop active sessions. Do not carry forward obsolete package-supplied disable flags when applying the default-enabled release; preserve separately configured operator restrictions and any user-selected offline opt-out.

Restart/reload the host only at a user-safe boundary; a fresh short verification process can read the normal user profile without replacing the active conversation. Report configuration, installed inventory, Skill discovery, MCP readiness and actual documentation-only invocation as separate evidence. An authentication failure is a boundary, not permission to create/copy credentials or change auth. No installation grants physical device access.

## Claude directory distribution

Maintainers publish the runnable package to `claude-dist` using the manual
Publish Claude distribution workflow. The official directory submission must
track that branch and the repository root, so repository installs receive the
bundled libraries. The default `main` checkout is source and still requires the
source setup steps above. See [release preparation](releasing.md#claude-repository-distribution)
for signing configuration and publication details.
