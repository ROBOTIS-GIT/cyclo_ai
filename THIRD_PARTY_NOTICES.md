# Third-party source notices

The product module vendors unmodified Python source from official ROBOTIS-GIT/DynamixelSDK tag3.8.4, commit0b29760ffa81d813bc749cb611a0019938c1e856. Its Apache-2.0 license and original notices are retained at modules/dynamixel/sdk-upstream/LICENSE; SDK-UPSTREAM.json binds all imported bytes. No upstream NOTICE file was present at that pinned root. The internal bridge and source-bound customer engine are separate from the SDK. The install ZIP bundles unmodified pyserial 3.5 (BSD-3-Clause) and pure-Python PyYAML 6.0.3 (MIT), each with its license under modules/dynamixel/python-vendor. No dependency is installed globally. First-party plugin content is licensed under Apache-2.0; see LICENSE.

The DHI/product/framework knowledge inventory records metadata and Git blob identities from the official repositories listed in references/dhi-sources.json. Source reads retain original legal notices; source is fetched on demand rather than bundled wholesale. DHI, dynamixel_interfaces, DynamixelSDK and ros-controls repository licenses/individual notices remain authoritative. Product source provenance and any differing repository license are linked explicitly; no endorsement or license grant for unrelated product assets is implied.

The install ZIP includes a dependency-only JavaScript bundle of
@modelcontextprotocol/server 2.3.1, @modelcontextprotocol/core 2.3.1 (Apache-2.0),
and zod 4.3.6 (MIT). Their full licenses are retained under licenses/; esbuild is
used only during packaging and its executable is not distributed. The generated
runtime-dependencies.json records dependency versions, npm lockfile integrity
values, Python source URLs and SHA256 hashes. runtime-files.json records every
other distributed file's SHA256; publish the archive SHA256 alongside the release
so users can verify the inventory's origin. Source archives retain dependency
requirements instead of bundled libraries.
