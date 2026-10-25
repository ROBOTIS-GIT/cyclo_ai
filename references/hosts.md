# Codex and Claude Code

The portable root `plugin.json` and `mcp.json` retain Codex support. Claude Code reads `.claude-plugin/plugin.json`. Both hosts use the actual root `skills/<name>/SKILL.md` directories and the same Node server entrypoints; there are no copied skills, command wrappers or symlinks. `agents/openai.yaml` is Codex UI metadata and is not needed by Claude Code.

## Invocation and tools

| Host | Setup / routing | Examples |
| --- | --- | --- |
| Codex | Use its supported local/private plugin flow and declared onboarding Skill | `$cyclo`, `$robotis-expert`, `$dynamixel-expert`, `$ai-sapiens-walking` |
| Claude Code | Load this directory for the current session; then invoke the shared Cyclo Skill | `/ai-sapiens-dev:cyclo`, `/ai-sapiens-dev:robotis-expert`, `/ai-sapiens-dev:dynamixel-expert`, `/ai-sapiens-dev:ai-sapiens-walking` |

References to a Skill by name or relative file link in shared instructions mean that packaged Skill, not a host-specific command to execute blindly. Use the active host's invocation syntax. Tool names such as `robotis_sources` are logical MCP names; use the tool identifiers actually discovered in that host. Do not invent a `mcp__...` prefix, a Codex URI or a cross-host install URL. When a host lacks web/source tools, use the reviewed local references and report the missing retrieval capability. No remote docs MCP or executor is created by this package.

## Local Claude Code session

Prepare local Node dependencies as in [first use](first-run.md). Inspect installed CLI version/help before relying on these documented commands; command availability varies by version:

```sh
claude --version
claude plugin validate --help
claude plugin validate /absolute/path/to/ai-sapiens-dev --strict
claude --plugin-dir /absolute/path/to/ai-sapiens-dev plugin list --json
claude --plugin-dir /absolute/path/to/ai-sapiens-dev plugin details ai-sapiens-dev
claude --plugin-dir /absolute/path/to/ai-sapiens-dev
```

In that session use `/ai-sapiens-dev:cyclo`. `--plugin-dir` is session-only; it is not a global plugin installation. No marketplace registration, new login or credential copying is required to validate package structure. Authenticated model invocation still needs the host's already-authorized account/API access. If unavailable, stop at validation/inventory and report invocation unverified. Never bypass a 401, billing denial or organization restriction.

Claude registers exactly two MCP servers from its manifest's inline `mcpServers` map, with `${CLAUDE_PLUGIN_ROOT}` in argument strings. There is deliberately no root `.mcp.json` or second Claude MCP declaration. Codex's portable `mcp.json` uses `${PLUGIN_ROOT}` and is not Claude's automatic `.mcp.json`. Do not additionally register these same servers with `claude mcp add`. The launchers resolve packaged resources relative to their files and work independently of the process working directory, including paths containing spaces.

Both hardware flags remain `0` in both host declarations. No new port, actuator, torque, motion, flashing, training or deployment permission follows from loading either host. Preserve the task's restrictions. Static validation, host inventory, standalone stdio, mocks and authenticated end-to-end invocation are separate evidence levels; none establishes physical robot safety.

Sources checked for this adapter: [manifest](https://code.claude.com/docs/en/plugins/manifest-reference), [plugin CLI](https://code.claude.com/docs/en/plugins/cli-reference), [Skills](https://code.claude.com/docs/en/skills), [MCP](https://code.claude.com/docs/en/mcp).
