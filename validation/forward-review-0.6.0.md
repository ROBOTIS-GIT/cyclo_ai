# Independent Cyclo Plugin 0.6.0 review

Date: 2026-10-25. Read-only review of the uncommitted 0.6.0 working tree. No project source was edited. Public manual bytes were read from the existing pinned local checkout; no MDX/JSX rendering or execution occurred. No hardware, serial catalog, device connection, ROS/Zenoh robot connection, GPU work, login, credential copying, global installation or hardware allowlist expansion occurred.

## Concrete findings

1. **Bare MX family names silently choose the original firmware document.** `listModels(index, 'MX-28')` returns both `mx_series/mx-28` and `mx_series/mx-28-2`, but `resolveModel(index, 'MX-28')` selects only the original document. The same occurs for MX-64 and MX-106. The physical family name alone does not establish original versus Protocol-2 firmware. Existing tests cover T/AR suffix ambiguity, but not these bare names. Add the bare family alias to both generation records, or explicitly reject it as ambiguous; preserve full catalog IDs for deliberate generation selection. This is a customer-answer accuracy issue, not an execution permission path.
2. **English-only guard accepts Hangul in non-UTF-8 text.** The UTF-8 decode failure path returns silently as if the bytes were a binary asset. Reproduction: `assert_english_text('README.md', ('English ' + chr(0xac00)).encode('utf-16'))` succeeds. Known text formats should decode supported BOM encodings or reject non-UTF-8 encodings rather than skip them. The same guard currently accepts YAML/JS escaped string prose (`"Unicode code point U+AC00"`); consider extending the encoded-prose check beyond JSON, or document its exact detection boundary. No currently shipped Hangul was established by this fixture; the issue is a bypass in the claimed guard.
3. **Index generation does not verify the declared source revision.** The builder hashes each input file against the supplied tree but does not verify `tree['sha']` or checkout HEAD against its hard-coded `REVISION`. A copy of the actual tree JSON with only `sha` changed to forty `f` characters was accepted and produced links labeled c88527af0888baea6f7ef3305bbbbb911b960759. In this actual checkout, HEAD and the real tree's sha both equal the intended pin, so a direct provenance assertion is available. Later reader blob verification fails closed if actual contents differ; the missing check concerns reproducible index provenance before emission.

## Checks executed

- `node --test tests/manual.test.mjs tests/dual-host.test.mjs`: **11 tests passed**. This includes all indexed family counts, orphan-source inclusion, mechanical reducer distinction, selected generation aliases, caller props/conditional source preservation, integrity/path/network failure fixtures, comment/legal-notice behavior, shared manifest identity, and both server declarations starting from an unrelated working directory with spaces.
- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s validation -p test_english_only.py -v`: **3 tests passed**. The extra encoding probes above expose cases not covered by those tests.
- Additional local-source probe: read the exact XM430-W350 model MDX via `readManual` with a dependency-injected file reader restricted to the pinned public-source prefix. Blob verification succeeded, 30 requested source lines were returned, 56 imports remained available, and conditional rendering was explicitly false. No source code was evaluated.
- Additional 1 MiB + 1 byte source fixture was rejected by the reader's bounded size check before evidence returned.
- Inspected the source index: 92 product documents comprise 89 actuator documents and three mechanical DYD reducer documents, plus 11 model-reference indexes and 463 shared partials. Records explicitly state that source graph indexing is not semantic feature certification or rendering. Count scope is documents, not every physical variant or present sales availability.
- Inspected direct aliases and dependency graphs across all 92 product records. The same reader pipeline is used independently of the two-model execution allowlist. Explicit original/Protocol-2 canonical IDs and PRO R/R(A) records remain distinct. No unresolved imports were reported in these model graph records. Shared component caller invocations are retained as source evidence rather than flattened into universal support.

## Host configuration assessment

The portable manifest and Claude manifest share identity/version/author and the same real server entrypoints and disabled hardware flags. Claude declares its two servers in one inline `mcpServers` map; there is no root `.mcp.json` adding a second registration. Shared Skills are not copied or scanned through an extra `skills` declaration. The tested path substitution and stdio startup are meaningful declaration checks, not authenticated installed-host invocation.

The existing Claude CLI evidence reports strict manifest validation success and component inventory, while its separate directory-readiness findings include `LICENSE_MISSING` and icon/advisory items. Preserve that distinction: this private package is not thereby public-directory submission-ready, and the review does not authorize inventing an open-source license. No authenticated model invocation was performed by this reviewer.

## Remaining limits

No real hardware or installed-host end-to-end invocation is established by this review. Full model feature semantics, every firmware condition and every nested MDX branch were not independently interpreted. The reader intentionally does not render MDX; exact applicability remains a source-backed task requiring caller/default/condition inspection. Network failure is correctly reported as missing evidence, not proof of an unsupported feature. No trusted write map is generated from retrieved text.

## Follow-up: affected corrections verified

All three reported findings were corrected in the subsequently inspected working tree:

- Modern MX-28/64/106 records now share their bare family aliases with the original-generation records. The reader's updated alias test rejects all three bare names as ambiguous while retaining exact canonical IDs for deliberate generation selection.
- The language guard rejects invalid UTF-8 for recognized textual files instead of treating them as binary. Updated tests reject the demonstrated UTF-16 Markdown and escaped YAML/JavaScript string prose. Markdown escape inspection is also present. Legal-notice conflicts remain errors rather than license rewriting.
- Index generation now checks checkout HEAD against the fixed revision and requires the supplied tree identifier to be either that verified commit ref or its actual root-tree identifier. The prior incorrect-sha fixture is rejected. Both supported representations produce the same 92-product denominator; a mocked non-pinned HEAD is also rejected before indexing.

Re-ran the affected reader suite: **7 passed**. Re-ran the language suite: **5 passed**. Additional offline provenance assertions accepted the actual pinned adapter tree, accepted its native root-tree form, rejected an unrelated tree sha, and rejected a mocked wrong checkout HEAD. No project source was edited by this reviewer and no hardware, login, MDX execution or global change occurred. These affected fixes introduced no new observed blocker; prior evidence limits remain unchanged.

Packaging note: the escaped-language fixture in this English report is described by its Unicode code point rather than reproduced as encoded prose. The original reviewer findings and follow-up results are unchanged.
