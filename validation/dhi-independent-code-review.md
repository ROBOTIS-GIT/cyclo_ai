# Final independent DHI source/configuration review

Date: 2026-10-26. Candidate version0.10.0, `feature-dhi-source-analysis`. Read-only project review. Only pinned local Git/source reads, in-memory XML/YAML/source fixtures and isolated stdio startup tests were performed. No hardware, OS/serial discovery, ROS/Xacro/launch execution, network, installation, authentication or project edits.

## Confirmed corrections

All earlier substantive parser/interpretation findings are corrected:

- Parsed Xacro namespace URI detects arbitrary prefixes, including the previously missed hyphenated prefix. My uninstantiated macro fixture now reports `unexpanded-xacro`, sets only `incompleteExpansion`, and returns an empty sourceTrace rather than deriving DHI runtime behavior.
- Repeated joint names across components produce explicit controller/component ambiguity rather than last-wins selection. Invalid controller interface/list shapes return diagnostics instead of TypeError or silently skipped validation.
- Matrix entries accept finite scientific notation. Count/identity parsing remains separate. The intermediate unbound expected-entry variable was corrected.
- YAML compose-stage depth/node limits prevent the earlier small nested-input RecursionError. Nonrecursive shared anchors are bounded and retained; recursive structures remain rejected.
- Controller blocks preserve repeated selectors, documents and order rather than flattening ROS parameter precedence. The result does not claim selected/active controllers or a version-independent YAML merge interpretation.
- Lexical indexing locates type/template identifiers such as SetBool while explicitly remaining lexical evidence, not a semantic call graph.

## Remaining small reproducible schema issue

**P2: false/empty-sequence/null parameter roots silently become empty maps.** In `scripts/inspect_ros2_control.py:load_yaml`, `yaml.load(...) or {}` converts any falsy result to an empty dictionary before checking its type. Consequently `controller_blocks('ctrl: {ros__parameters: false}')`, and equivalent `[]`/`null` fixtures, return an apparently valid row with `parameters:{}`. These are not parameter mappings. Distinguish an intentionally absent/empty input from explicitly non-mapping `ros__parameters`, and reject or diagnose their schema. This is misleading static acceptance, not executable authority or a hardware issue.

## Evidence and tests actually obtained

- Compared **all1,854 indexed file/path blob bindings across12 packages** to local pinned Git trees, including separate upstream ros2_control/ros2_controllers Humble/Jazzy/master snapshots: **zero mismatches**. Source membership and hashes are verified; semantics are not exhaustively certified.
- Python `test_dhi_config.py` and `test_dhi_products.py`: **25 tests passed**, zero failures. Evidence `/tmp/cyclo-dhi-final-python.txt`.
- The5 source-evidence tests pass, including hash/bounds/no-fallback and offline in-memory MCP/provider isolation. In the combined source/dual-host run these5 passed along with2 manifest checks;4 stdio startup cases failed with `Connection closed` and no child stderr. Evidence `/tmp/cyclo-dhi-final-node.txt`.
- Retesting dual-host alone reproduced those4 closures (`/tmp/cyclo-dhi-final-host.txt`). Separate Client/StdioClientTransport probes against both the copied fixture and original checkout firmware also closed with no stderr, even with explicit offline mode. Raw spawn/import with closed stdin exited0. This execution context therefore did **not** produce independent stdio acceptance. This result is not isolated to the new source code and is not asserted as a production regression; retain the parent's separately observed exact-environment evidence rather than claiming this review passed host invocation.
- Manual negative fixtures rejected XML entity/DOCTYPE declarations, YAML object constructors, duplicate parameter keys and recursive aliases; no Xacro include or Python launch content was evaluated.

## Source safety and substantive coverage limits

The read path is confined to indexed packages/revisions/paths, a fixed official raw origin, redirect rejection, a byte bound and Git-blob verification, with no nearby-version fallback. Lexical queries and immutable citations support tracing. Unknown/custom versions remain explainable from supplied evidence but are not silently mapped to main. Source content cannot mutate execution control tables or authorize runtime operations.

The upstream inventories deliberately select hardware_interface/controller_interface/controller_manager and a subset of controller families. They are not all ros2_control plugins, every controller, every release or user overlays. Master is not an alias for Rolling or a distribution ABI. No binary/ABI/runtime compatibility follows solely from the source snapshots.

Product artifact discovery preserves conditional hardware plugins and mutable dependency declarations. It does not evaluate launch arguments, select included configurations, bind multiple controller managers to components, prove every official consumer was discovered, or certify TableSync model/firmware/layout compatibility. Custom model files, unit overrides, virtual routes, physical feedback, timing, calibration and actual torque must still be established from the selected source/configuration/runtime evidence. Matrix shape checks do not prove invertibility or calibration, and effort-to-current mapping is not calibrated torque.

The new workbench/product references correctly distinguish raw static evidence from runtime behavior and include lower-level initialization, torque, error, service, model-version and TableSync tracing obligations. They improve practical coverage without claiming a dashboard, universal runtime integration or exhaustive semantic review. Full regression/final package/CI checks remain the parent's release work.

## Final follow-up

The non-mapping parameter-root issue is corrected at `controller_blocks`: `ros__parameters` must be a MappingNode, so explicit false/empty-list/null roots no longer become empty parameter maps. The latest combined DHI configuration/product suite passes **28 tests**, zero failures (`/tmp/cyclo-dhi-final-python.txt`). Added single-joint/schema diagnostics and static nonzero matrix-to-GPIO route reporting were inspected against pinned `SetMatrix`, `InitDxlWriteItems` and `MapInterfaces`; matrix orientation and source-selected physical/virtual DXL ordering match those source paths. Routes remain explicitly static and qualified; they do not establish mode, calibrated units or successful output. No additional reproducible source/config defect remains in this bounded review.

The parent identified the stdio closures as the known restricted-subprocess sandbox behavior and reports its authorized escalated six-case dual-host run passing. I did not rerun those tests under escalation in this review, so my independent execution evidence remains the source checks and28 Python cases; the parent's escalated stdio evidence should be reported separately. Earlier connection-closed observations are not attributed to the implementation.
