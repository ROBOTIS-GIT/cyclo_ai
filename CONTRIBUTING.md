# Contributing to Cyclo AI

Contributions to documentation, device contracts, transports, tests, and usability are welcome. First-party code is Apache-2.0. Contributions are accepted under the same license. Preserve dependency licenses and source notices. Use the language that best explains your issue; original source text and multilingual examples are welcome.

## Development setup

Use Node.js >=22 and Python >=3.9:

```sh
npm ci --ignore-scripts
npm run setup -- --dev
npm run doctor -- --hardware-deps
npm test
```

Setup creates a local `.venv`; the runtime and test runner discover it automatically. `CYCLO_PRODUCTS_PYTHON` overrides that interpreter. On Linux/macOS, activate `.venv` before invoking Python commands directly. On Windows use `.venv/Scripts/python.exe`. Tests use synthetic devices, packet fixtures and loopback sockets, and never open attached robot ports.

## Find the right layer

Read [architecture](references/architecture.md). Keep device semantics in contracts, packet I/O in the provider, session state in selection, and host instructions in skills. Do not add a model-specific shortcut to the MCP server when a reusable contract can describe it.

- **New custom device:** start with [custom tables](references/custom-control-tables.md), a manufacturer source, and a synthetic fixture. Add only the conditions the source requires. Controllers and sensors do not need actuator registers.
- **Bundled model or condition:** update the source index/compiler and fixtures, then regenerate using [catalog development](references/catalog-development.md). Test the supported case and a real boundary such as a firmware change, wrong encoding or failed prerequisite.
- **Transport:** implement the connection interface in the architecture guide. Test packet parsing, timeout, cancellation, close failure and alias ownership without a real robot.
- **MCP workflow:** test the complete user journey through `Client` and an injected provider. Check that errors are actionable and permissions survive selection.
- **Documentation/skills:** include a concrete successful example. Reuse established task authorization; ask users only for missing information.

## Before submitting

```sh
npm run format
npm run format:python
npm run format:check
npm run format:python:check
npm test
```

Stage intentional new/deleted files, then refresh the explicit release inventory:

```sh
git add <changed-source-files>
npm run package:manifest
# Inspect release-files.json. It must contain only distributable source.
npm run package
node scripts/python.mjs validation/verify_archive.py artifacts/cyclo-ai-0.2.2.zip
npm run package:runtime
npm run verify:runtime -- artifacts/cyclo-ai-0.2.2-install.zip
```

Generated test output is ignored. Customer profiles, virtual environments, credentials and local source tables do not belong in the release manifest. Do not edit the vendored SDK; update its pinned revision and source hashes as a separate reviewed dependency change.

Keep PRs focused. Describe the user-visible problem, the behavior after the change, and what was tested. Distinguish mocked coverage from physical hardware results. Bug reports should include versions, OS, adapter, model/firmware and a minimal reproduction, without credentials or private customer tables.

Be respectful in review, explain technical disagreements, and help newcomers reproduce failures. Maintainers can request changes or remove abusive content.
