# Standalone product-runtime verification

The package declares one product MCP server and thirteen first-party skills. Device execution uses the pinned public official DynamixelSDK and a plugin-owned port adapter/lease; it needs no private source tree, external device CLI, npm workspace or generated TypeScript SDK build. Both host manifests initialize the same server from unrelated working directories, including paths containing spaces.

## Function coverage

| Workflow | Evidence |
| --- | --- |
| Catalog discovery, named item reads/writes, torque/mode/goals, ID/baud/LED/profiles | Existing all-catalog engine, item-condition, transition, SDK-packet and stdio regressions retained |
| Unindexed controller/sensor Ping and bounded raw reads | Explicit bus/target grants, fixed ID/rate/protocol scopes, raw bytes only, offline/confirmation/error/closure tests |
| Native Protocol 2 Sync Read | Public SDK instruction and parsers, multi-ID signed byte results, per-device error handling, source-resolved common layout checks |
| Custom tables | Offline source-hashed JSON normalization, XML aliases/sequence expansion, explicit firmware/encoding/write rules, rejection of unknown or contradictory contracts |
| Independent custom write enforcement | Node MCP/engine to Python bridge over fake public-SDK packet ports; a changed contract digest blocks writes until reload |
| Actual ID swaps | Both sources preflighted before the first write, free temporary ID, three verified transitions, final continuity, lost-ACK reconciliation, occupied/torque-on/partial-failure cases |
| High baud | Plugin adapter accepts documented 4.5/6/10.5 Mbps and propagates simulated OS rejection before packets; public SDK source hashes remain unchanged |
| TCP/UDP packet bridges | Actual loopback sockets with public SDK parsing; no attached robot endpoint is contacted |
| Bus ownership | Canonical serial alias/device reservations, changed-binding rejection, shared bridge-host leases and closure/release handling |
| Packaging | Manifest/frontmatter/local-link validation, retained public-source hashes, ZIP CRC and extracted byte comparisons |

The source suite passed with 300 Node tests and 113 Python tests. The Node custom-contract wrapper additionally executes its own ten named cases in a separate process; the outer count includes that wrapper once. No attached serial hardware is opened by these tests. Validation dependencies are installed in an isolated environment, not globally.

The customer-supplied QC060-200-R020-RE and QC080-240-R020-RE XML files were also imported locally: each expands to 407 exact items. Those private files and generated operator profiles are not included in the repository or release archive. This validates importer compatibility with the supplied files, not every firmware/write condition in them.

A fresh serial inventory during this refactor showed only the OpenRB; the K1 HAT's earlier control/routed ports were absent. Therefore no new physical K1 6 Mbps read or motor-write acceptance is claimed. Native device-write behavior is verified with synthetic devices and independent public-SDK packet fixtures. Actual driver/adapter high-baud acceptance and physical behavior still require the selected hardware.

## Repeat the release checks

```sh
npm ci --ignore-scripts --no-audit --no-fund
python3 -m pip install -r validation/requirements.txt
npm test
npm run package
python3 validation/verify_archive.py artifacts/cyclo-plugin-0.10.0.zip
```

Run Python installation/tests inside the chosen validation environment. Archive verification reuses local Node dependencies and runs the same suite from the extracted package. It neither installs a host plugin nor publishes anything.

## Scope limits

All bundled source-resolved item contracts remain subject to their existing conditions. Unknown/manufacturer-unresolved writes do not become arbitrary writes. The initial custom actuator schema supports single-axis scalar contracts and reviewed live conditions; custom indirect/protocol/dual-axis operations outside that schema remain explicit gaps. Controller/sensor raw reads need no fabricated actuator torque/baud table. Reset/reboot/flashing are separate protocol operations, not register writes, and are not exposed by this MCP.

The release archive excludes removed source and obsolete integration reports. This branch does not rewrite existing Git history; publishing a repository's prior commits would still expose content retained in those earlier commits. First-party licensing/publication permission is unchanged.
