# Third-party source notices

Cyclo firmware MCP 0.1.0 and the TypeScript SDK are reused from ROBOTIS-GIT/cyclo_firmware, branch feature-new-standard, pinned at e52600c020f3d98c1adae260cebc0b8a83f6a71d (retrieved 2026-10-24). Their original SPDX/copyright notices and Apache-2.0 license are retained in modules/firmware/upstream/LICENSE. No upstream NOTICE file was present in the inspected tree. UPSTREAM.json records imported paths and byte hashes. The upstream README's historical preparation commit is retained as upstream history, not the pin used by this integration.

Vendored source is unmodified. The integration launcher, tests, documentation and package wiring are separate. Mock tests compile SDK source in a disposable copy and suppress serial alias enumeration, serial opening and default port discovery there; that test-only compiled copy is deleted and is not a hardware runtime artifact.

The MCP adapter continues to call typed CLI workflows and the SDK owns wire packets. A separately built matching upstream CLI is required for any later explicitly authorized hardware operation; the integration does not duplicate the CLI or expose its firmware/motion commands. Runtime npm dependencies retain their package licenses. Original integration/Skill licensing is not changed or granted by the upstream license. Names identify compatibility and do not imply ROBOTIS endorsement.
