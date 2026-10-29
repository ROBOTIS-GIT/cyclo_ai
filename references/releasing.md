# Preparing a public release

First-party source is Apache-2.0. Vendored SDK licensing and pinned hashes are recorded in THIRD_PARTY_NOTICES.md. Local customer control tables are excluded from the distribution.

Before publishing this repository's full Git history, resolve the historical private firmware content: earlier commits still contain files removed from the current tree. This refactor does not rewrite shared history. Maintainers must either authorize a coordinated history cleanup or publish an approved clean source repository. The source ZIP contains only the current reviewed release manifest.

From a clean checkout, install dependencies, run the CI commands, review `release-files.json`, build the ZIP and test its extracted contents. Record the commit, archive SHA256 and validation results. Publish supported OS/runtime versions and the physical hardware combinations actually exercised. A passing packet fixture is not a physical-device test.

Bump `plugin.json`, `.claude-plugin/plugin.json`, `package.json`, `package-lock.json`, the MCP server version and generated catalog version fields together. Update the changelog and rerun manifest/version checks. Release publication and shared-history changes are separate maintainer actions from pushing a feature branch.
