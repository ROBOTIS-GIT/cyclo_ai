# Preparing a public release

First-party source is Apache-2.0. Vendored SDK licensing and pinned hashes are recorded in THIRD_PARTY_NOTICES.md. Local customer control tables are excluded from the distribution.

Before changing repository visibility, review the current source and reachable
history for private content. The install and source ZIPs use the reviewed release
inventory and exclude customer files, local environments and credentials.

From a clean checkout, install dependencies, run the CI commands, review `release-files.json`, build the ZIP and test its extracted contents. Record the commit, archive SHA256 and validation results. Publish supported OS/runtime versions and the physical hardware combinations actually exercised. A passing packet fixture is not a physical-device test.

Bump `plugin.json`, `.claude-plugin/plugin.json`, `package.json`, `package-lock.json`, the MCP server version and generated catalog version fields together. Update the changelog and rerun manifest/version checks. Release publication and shared-history changes are separate maintainer actions from pushing a feature branch.

## GitHub Release from main to release

The Release workflow calls
`ROBOTIS-GIT/github_workflows/.github/workflows/release.yml@main` for pull requests
targeting `release`. Same-repository `main` to `release` PRs must be titled exactly
`Bump X.Y.Z` and have release notes in their description. The version must exceed
the latest published release and have no existing tag or release. Other branch
pairs and fork PRs do not publish a release.

Opening or updating the PR validates these requirements. Merging it validates
again and creates the `X.Y.Z` tag and GitHub Release at the PR's merge commit,
using the PR description as release notes. Closing an unmerged PR does not
publish. The shared workflow uses the calling repository's GITHUB_TOKEN and needs
Contents write permission; no personal token is required. Ensure the shared
workflow is accessible to this repository and install the caller on the release
branch before relying on its PR checks. Keep package versions and CHANGELOG.md in
sync with the PR's version. An existing `0.2.0` tag cannot be published again by
this workflow.

## Discord release notification

After the shared release job publishes successfully, the `discord-notify` job
calls `ROBOTIS-GIT/github_workflows/.github/workflows/discord-notify.yml@main`
with the published version. Configure `DISCORD_WEBHOOK_URL` as a repository
secret, or an organization secret available to this repository, for the target
Discord channel. The URL is passed explicitly to the reusable workflow.

The notification includes the release name, notes and GitHub Release link.
PR validation, unmerged PR closure, skipped releases and failed publication do
not send a notification. This job is chained through the release workflow's
outputs because releases created with GITHUB_TOKEN do not trigger a separate
release-event workflow. An alert failure fails the notification job without
removing the published release. Re-running a notification can send another
message, so check the channel before retrying. No live notification is sent
while editing or validating this caller.

## GitHub Actions artifacts

The Offline plugin checks workflow runs tests and source validation on pushes,
pull requests and manual dispatch; it does not build or upload distribution ZIPs.
After the Release workflow successfully creates a GitHub Release, its packages
job checks out the exact merge commit and builds source and install ZIPs on Linux,
macOS and Windows. The package version must match the published release version.
It verifies the install ZIP everywhere, runs the full extracted-source suite on
Linux/macOS, and records SHA256SUMS and SOURCE_COMMIT. The archives and validation
evidence are uploaded as `cyclo-ai-packages-<version>-<runner>` artifacts with
30-day retention. PR validation and unmerged closure do not create packages.

Download the artifact from the successful Release workflow run's Artifacts section. No separate
server or deployment credentials are needed. Keep local artifacts/ ignored;
local package commands are for reproducing and debugging CI builds. OpenAI
submission uses the verified install ZIP downloaded from the successful run.
Claude repository submission uses the generated distribution branch described below.

## Install ZIP

From a clean checkout, run `npm ci --ignore-scripts` and `npm run setup -- --dev`.
Run the offline tests, then build and verify the install archive:

```sh
npm run package:runtime
npm run verify:runtime -- artifacts/cyclo-ai-0.2.1-install.zip
```

Packaging downloads only the pinned pyserial and PyYAML source archives from
PyPI, verifies their SHA256 hashes before reading them, and never executes their
setup scripts. It bundles the production JavaScript dependency facade with the
lockfile-pinned esbuild. The install ZIP requires Node >=22 and Python >=3.9 but
needs no npm/pip installation after extraction. No interpreter, virtual environment,
node_modules, native build executable or development-only library is bundled.

The verifier extracts to a temporary path containing spaces, checks every file
against runtime-files.json, imports Python libraries and the official SDK with
site packages disabled, runs dependency diagnostics and exercises both host MCP
configurations from an unrelated working directory. It does not access devices or
register a plugin in a user's host. The external test harness needs development
Node dependencies; the installed server does not.

Publish the ZIP with the SHA256 from artifacts/runtime-package-result.json and
retain artifacts/runtime-test-results.json as validation evidence. Repeat the
build with identical inputs to confirm reproducibility. CI runs the same checks
on Linux, macOS and Windows; only platforms with passing results are validated.

The install ZIP enforces fewer than 513 files, individual files below 5 MiB and
unpacked bytes below 256 MiB. Several source catalogs and the JavaScript bundle
exceed Claude's 256 KiB automatic-review threshold and can require reviewer
inspection; these checks do not establish marketplace approval.

## Catalog storage

control-items.json references one SHA256-verified JSON shard per model;
dhi-sources.json references one per package. The JavaScript and Python catalog
loaders reconstruct their logical values. Offline index generators use
write_catalog to keep that layout. Include each referenced shard in
release-files.json, and preserve hashes and original source provenance.

## Claude repository distribution

Claude's directory reads the selected GitHub branch, rather than downloading an
Actions artifact. Submit the generated `claude-dist` branch, not the source-only
`main` branch: the distribution includes the bundled MCP facade, Python libraries
and their licenses. In the directory portal use repository
`ROBOTIS-GIT/cyclo_ai`, branch `claude-dist`, and the repository root as the plugin
path. The branch also contains `.claude-plugin/marketplace.json` for repository
marketplace clients. Do not edit that branch by hand.

The manual **Publish Claude distribution** workflow creates or updates this
branch using an existing release package. Supply the published version and its
successful Release workflow run ID. The workflow downloads that run's Ubuntu
package artifact, checks the ZIP checksums and verifies SOURCE_COMMIT against
the published tag. It does not rebuild the package. It verifies the downloaded
install ZIP and prepared repository directory without npm/pip installs inside
the package, removes CI workflows from the generated branch, records the released
source commit in distribution.json, and updates the full file-integrity inventory.
An existing distribution branch must have matching provenance; changed source
requires a version bump.

Configure these repository variables using the maintainer's Git identity:

- `RELEASE_GIT_NAME` and `RELEASE_GIT_EMAIL`: the configured commit identity.
- `RELEASE_GITHUB_LOGIN`: the GitHub account with the registered signing key and
  verified commit email.
- `RELEASE_GPG_FINGERPRINT`: the registered key's full fingerprint.

Configure `RELEASE_GPG_PRIVATE_KEY` and, if needed,
`RELEASE_GPG_PASSPHRASE` as Actions secrets through the repository's authorized
secret-management process. Local development does not upload or export a key.
The workflow imports signing material only into its temporary runner GPG home
and removes it at completion. It cannot publish without a usable registered key.

Publishing uses `git commit -s -S`, validates the DCO trailer and local signature,
checks the signing key and verified email against the configured GitHub account,
then performs a normal push to `claude-dist` and checks GitHub's signature status.
It never force-pushes or modifies `main`. The repository's Actions token needs
Contents write permission for this manual job, and branch rules must permit the
signed distribution update. Missing access or signing configuration fails the
job; there is no unsigned fallback. Creating this workflow does not publish the
branch or submit the plugin to a directory.
