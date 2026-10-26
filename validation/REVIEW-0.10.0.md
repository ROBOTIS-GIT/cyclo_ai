# DHI implementation and product-source expertise review

This candidate extends the existing integration Skill and adds one read-only source MCP tool plus offline XML/YAML inspection. Fourteen Skills, existing device operations, default availability and explicit offline opt-out remain. No new ROS executor, physical device operation or installation is included.

## Evidence coverage

- 12 packages and 22 separately pinned source profiles contain 1,854 path/blob bindings. Independent local Git comparison found no mismatches. These are indexed records, not independent semantic reviews of every line.
- Seven official consumer/demo repositories provide 284 artifact records and 54 conditional DHI declarations. OpenMANIPULATOR, ROBOTIS Hand, AI Sapiens, AI Worker, RH-P12-RN-A, the TurtleBot3 Autorace arm and DHI demos are represented. Alternative simulator/mock/receiver plugins, mutable dependencies, namespaces, controller configuration and ordered TableSync GPIO phases are preserved.
- DHI initialization/lifecycle/torque callers, interfaces, model/firmware/units, communication, errors, queues and recovery have source-tracing guidance. Upstream framework/controller behavior is separately indexed and version-qualified.
- Ten actual plugin-stdio public-source reads verified complete file blobs and returned bounded citations with hardware disabled in the child. This is actual source retrieval, not installed-host or robot runtime proof.

## Validation

470 tests passed: official-sdk-provider-stdio: 4, source-evidence: 5, complete-control-table: 67, dual-host-stdio: 6, official-manual-reader: 7, plugin-stdio: 3, dynamixel-products: 68, generic-catalog-execution: 138, upstream-mcp-mocks: 71, python-regressions: 101. SDK compilation, schema/frontmatter/version/local-link/English/source-provenance validation and changed-Skill validation also pass. Final ZIP extraction runs the same offline suite; archive/source parity is recorded with the deliverable.

The source reader rejects unknown profiles/paths, inherited object properties, hash mismatch, oversized data and retrieval failures without a nearby-version fallback. In-memory MCP testing proves provider isolation. Configuration tests cover source conflicts, literal GPIO roles/torque selection, matrix signs/scientific notation/routes, missing GPIO conversion paths, acceleration versus mapping, effort units, controller shape/namespace/component ambiguity, repeated YAML selectors/documents, unknown/custom plugins, unexpanded namespace-alias xacro, malformed/recursive/oversized structures and non-finite evidence. Product tests cover distinct hardware alternatives, revisions/sides, launch-default expressions, TableSync phases, rates as configuration rather than measured timing, mutable refs and legacy plugin spelling.

Independent code review found parser/mapping issues, which were corrected with regression cases. Independent forward evaluation answered realistic Hand mock/controller, custom effort/acceleration and cross-product TableSync questions with exact source citations and appropriate missing-evidence statements. Its restricted subprocess stdio failures are documented as unverified in that review environment; the producer's escalated offline suite and real source-stdio calls passed. No claim is made that all runtime combinations were tested.

## Limits and separate work

No DHI/framework compilation, ROS bringup, controller activation/switching, real serial/bus traffic, torque/motion, recovery, firmware, training, installed-host acceptance of the new tool or deployment was performed. User binaries, overlays/ABI, custom model files, calibration, lifecycle and physical feedback require actual user evidence. The selected upstream controller families and default-branch products do not exhaust every release or consumer. K1 HAT consumer parameters absent from the inspected DHI and undocumented/conflicting TableSync firmware/manual details remain unresolved rather than guessed. The two original-MX Current(68) execution gaps are unchanged.

The documentation-only host-default correction remains separate PR #4. This candidate does not merge or reinstall it, and the installed ProArt package is unchanged by this source-development task.
