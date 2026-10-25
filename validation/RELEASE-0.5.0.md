# Cyclo Plugin 0.5.0 validation

Date: 2026-10-25. Customer-usability update on a private feature branch. Plugin identity `ai-sapiens-dev` and all fourteen Skill names are preserved. The existing Cyclo Skill is the declared onboarding entrypoint.

## Implemented changes

- Development-session restrictions are recorded in DEVELOPMENT-SCOPE.md rather than loaded reusable product behavior. Permanent authorization, default-disabled hardware and bounded execution safeguards remain.
- Port-only bus grants support unknown-identity bounded discovery. Explicit, short-lived completed-scan selection creates session targets; zero/multiple/unsupported responses never silently become writable targets.
- Fully verified ID/baud transitions with supported-snapshot continuity, confirmed closure and released reservation update the session location. Dry runs do not update it. Failed/uncertain operations and binding/context changes block subsequent writes until explicit re-identification. No model/firmware profile or hardware permission is added.
- First-run guidance, product/configuration/integration starter prompts, and a mock-only ROS 2 arm scaffold support practical customer preparation. The separate DHI plan records unresolved hardware mapping/version checks; it is not an executable real-device configuration.

## Evidence and limits

Final local, extracted-package, independent-review, host smoke and exact-commit CI evidence is recorded alongside this report. Mock/unit/stdio evidence is distinct from installed-host discovery/invocation. No real device, serial discovery, OpenRB, ROS/Zenoh robot connection, GPU training or physical deployment is performed. ROS 2 is not installed on the development host; Xacro and generated-artifact checks cannot establish ROS bringup or robot acceptance.

The final local suite has 149 tests: 71 retained upstream firmware mock tests, 42 product workflow/selection/stdio tests, three retained firmware-launcher stdio tests and 33 Python tests (including three real Xacro expansion/artifact checks). Fourteen Skills pass Skill Creator validation. Manifest/MCP schemas, onboarding path, versions, references and unchanged upstream source hashes are checked. `verify_archive.py` repeats the full suite from extracted final ZIP bytes with existing local dependencies; its exact archive hash/result is recorded in the delivery evidence.

Independent review supplied five Korean customer responses and exercised mock target/continuity and generated-artifact cases. It found a remaining walking-Skill session restriction and missing spawner YAML forwarding. Both were corrected and affected checks passed again. A later permission review confirmed that target-specific grants cannot be used to select another model/ID/rate, while verified current-location continuation still works. See `forward-review-0.5.0.md`.

The actual bundled Codex CLI successfully added a local marketplace, installed 0.5.0 and listed it as installed/enabled in a temporary isolated profile. An explanation-only installed-Skill invocation could not complete: the initial sandbox blocked network transmission; one bounded permitted-network attempt returned HTTP 401 due to missing authentication in that isolated profile. No existing credentials were copied, no login/configuration outside that profile was changed, and no further invocation was attempted. Thus installation/listing is observed; installed-Skill execution and setup behavior in fresh/existing UI conversations remain unverified. See `current/host-smoke-0.5.0.json`.

Learning preflight found Python 3.14.4, no MJLab/MuJoCo/Warp modules and no ROS 2 installation. Docker CLI exists, but no container or GPU query was run. No compatible simulator workspace was available for an honest environment-list/training smoke check. This is a prerequisite finding, not a passing learning-runtime test.

Remaining limits: model/firmware allowlist unchanged; single-device isolation required; duplicate identical physical devices cannot be uniquely identified from model/firmware alone; OS binding checks and supported-snapshot continuity are not a device serial registry. Handles/observations are session-local and operator files are not auto-persisted. Cooperative leases cannot exclude unrelated software. ROS launch/DHI lifecycle, simulator/training, real hardware and authenticated installed-host invocation require separate future acceptance work.
