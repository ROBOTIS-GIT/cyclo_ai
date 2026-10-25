# DYNAMIXEL product module (0.5.0)

The `cyclo-products` stdio server adds local source routing and a curated model-aware configuration workflow. It complements the unchanged upstream firmware module. It does not turn official web pages into executable control tables.

## Implemented boundaries

| Capability | Scope | Evidence |
| --- | --- | --- |
| Official source routing | Local inventory of ROBOTIS Docs, e-Manual and selected upstream sources; host web tools fetch actual pages | Offline metadata and reference checks |
| Port catalog | Explicit operator-enabled OS serial catalog, no automatic target selection | Mock provider only |
| Scan | Bounded selected IDs/rates, Protocol 2, explicit completeness/errors | Mock provider only |
| ID, baud, LED | XL330-M288-T model1200 firmware52; XM430-W350 model1020 firmware42 | Curated tables and mock transactions |
| Profiles | Position-mode allowlist per model; time or velocity with explicit units/limits | Mock conversions, mismatch/failure cases |
| Y and other families | Official documentation routing/explanation | No configuration backend approved |

Exact firmware profiles are a narrow review policy, not hardware certification. Other firmware is unreviewed, not presumed incompatible. See [source provenance](sources.json) and [configuration procedure](../../skills/dynamixel-expert/references/configuration.md). This module never writes torque, goals, operating mode, reset/reboot or firmware. It accepts no raw address, arbitrary code or user-supplied register table.

## Default startup and future operator setup

The packaged MCP has `CYCLO_PRODUCTS_ENABLE_HARDWARE=0`. Install dependencies locally following the root README; run `node modules/dynamixel/server.mjs` for local stdio. Its source/registry tools work without hardware. No global installation or persistent MCP setting is needed for tests.

For a future separately authorized real executor, `npm run build:device-runtime` compiles the pinned SDK TypeScript into its ignored local `dist/` directory. It does not run generators, discover devices or access hardware. The real provider reuses that SDK's SerialPort transport and Protocol 2 client. This provider has not been tested on a device and is not a certified production executor.

An explicit `CYCLO_PRODUCTS_CONFIG` JSON contains `allowPortDiscovery` and named `targets`. A port-only `buses` entry needs only `port`, `allowScan` and `allowConfigure`; no model or ID is needed for a bounded scan. `dynamixel_select` creates an expiring-observation-confirmed session target after explicit isolation and selection. Multiple responders require isolation and a fresh scan. Each preconfigured target must specify `port`, exact `model`, `firmware`, current `id`, current `baud`, `isolatedBus`, `allowScan`, `allowConfigure`. Config is operator-owned and not rewritten by the module. A separate process must explicitly set `CYCLO_PRODUCTS_ENABLE_HARDWARE=1` to permit actual I/O. Enablement is not authorization: the current task must permit the chosen bus and operation. The old firmware module's enablement flag cannot enable this module.

Request schemas default scan/configure to dry run. They validate a request but cannot fabricate device state. The current lease implementation targets Linux serial character-device paths; other host platforms are unverified. Real execution owns a cooperative physical-bus lease, verifies observed identity/control table, requires torque already off, records snapshots, writes each named field once and verifies readback. Retain a lease on uncertain closure. Stop other bus owners independently: a cooperative lease cannot prevent an unrelated ROS process from using the device. ID and baud changes must be separate. After full supported-snapshot continuity, verified readback, closure and released reservation, the session handle advances to the new location for subsequent operations. Failures and uncertainty lock it until fresh identification/selection. Dry runs never advance it. Session state is inspectable through `dynamixel_targets` and is not persisted; restart requires re-identification or an explicitly reviewed target config.

Uncertain outcomes provide old/new location candidates for a later read-only reconciliation. They do not retry or roll back. Port-open delays are OS-dependent; scan budget is cooperative rather than a hard-kill deadline. No physical serial, installed-host, ROS/Zenoh or motor behavior validation is claimed.

Customer setup and exact selection steps are in [first use](../../references/first-run.md). Seven product tools are exposed; the three original discovery/configuration operations remain hardware-gated. No additional model/firmware profile is approved by 0.5.0.
