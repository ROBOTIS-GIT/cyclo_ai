# Product configuration and TableSync traces

Use the [machine-readable product map](../../../references/dhi-products.json) to locate exact artifact paths and source revisions. `robotis_code` supports those package names and profiles. Its index/read path is the same for products, DHI, message definitions and SDK sources. All records describe inspected source snapshots, not the user's loaded configuration. Do not infer a dependency commit from a consumer's mutable `main`/distribution `.repos` reference.

## Consumer coverage

The curated snapshots include OpenMANIPULATOR (OM-X, OMY/OMX variants), ROBOTIS Hand (HX5-D20 revisions and left/right), AI Sapiens K1, AI Worker FFW configurations, RH-P12-RN-A, the TurtleBot3 Autorace **arm configuration**, and DHI demos. Their artifact inventories contain launch argument expressions, xacro conditions/includes, plugin alternatives, ordered GPIO parameter sequences and interface declarations. These are source-backed discovery records; the analyzer does not claim that all alternatives execute simultaneously or that every possible argument combination has been tested. Additional candidates and public-manifest search coverage are recorded separately; repository names and package dependencies alone do not establish a working physical integration. The TurtleBot3 arm record does not imply its mobile base uses DHI.

For a product question:

1. Resolve exact robot variant/revision, physical versus simulator/mock mode, launch entrypoint, arguments and namespaces. Search product paths first, then read the launch and xacro include chain. Do not execute the launch to find its arguments.
2. Trace selected controller YAML and spawner arguments, including inactive/delayed/conditional controllers and controller-manager namespace. A configured update rate is not measured loop frequency or actuator bandwidth.
3. Identify the selected hardware plugin. K1 MuJoCo and radio receiver configurations use different plugins; do not import DHI torque behavior into them. Older sources may use `fake_components/GenericSystem`, newer ones `mock_components/GenericSystem`; resolve the actual ROS version rather than silently renaming it.
4. Compare every hardware parameter, GPIO role, `comm_id`, virtual `model_num`, interface, matrix and unit override with the actual DHI source. If a consumer declares parameters absent from the indexed driver (for example optimized-read settings in K1 HAT), report source drift and locate its intended dependency branch or installed patches. Do not assert the parameter works because xacro accepts it.
5. Use the offline inspector on the **expanded** user description and actual selected YAML. Preserve original artifact hashes and separate source defaults from observed runtime evidence. Explain missing model firmware, controller claims or calibration instead of guessing.

## TableSync is controller-side mirroring

The [Hand control-table manual](https://ai.robotis.com/hands/control_table_hands.html) and [OMY Unit control-table manual](https://ai.robotis.com/omy/control_table_omy_unit) describe device/controller tables. This is distinct from host SDK GroupSyncRead/GroupSyncWrite and from ROS controller synchronization. There is no generic `use_table_sync` switch in the indexed DHI implementation. Product GPIO parameters initialize controller registers; virtual devices route mirrored data through controller IDs and model tables.

Trace all of these together:

- **Manual:** exact controller model, bus protocol, firmware, slot/channel meaning, enable/watchdog behavior, memory class and power/torque prerequisites. Hand documentation describes five channels with six slots and ID255 as disabled; compare the exact firmware and actual configured slots. Do not invent a universal minimum firmware when source/manual evidence does not specify one. A manual example can conflict with its table; retain that conflict rather than copying one address blindly.
- **Product xacro:** ordered controller disable → slot/ID/address/size configuration → later enable where declared. DHI iterates declared GPIOs and `InitItem` groups writes within each GPIO; source parameter-map iteration is not a promise of arbitrary XML parameter ordering. Preserve separate dummy GPIO phases rather than flattening them into one dictionary.
- **Virtual mapping:** `virtual_dxl`/`virtual_sensor` roles, virtual IDs, `comm_id`, `model_num`, mirrored field addresses/widths and unit rows. A virtual model number is a configured decoder identity, not a separately pinged actuator or proof of a physical model's register layout.
- **DHI/SDK:** handler grouping and direct/indirect layouts, conversions and write/read buffers. Identify which address space is being discussed: a physical servo, a controller, a mirror region or a host process interface.
- **Evidence limit:** static enable declarations are not observed enable state. Watchdog/power/errors and failed initialization can change the result. Do not run recovery or toggle power/TableSync simply to answer a question.

## Reviewed product-specific distinctions

At the pinned Hand rev2 right configuration, a controller at ID110 is configured with Table Sync Enable0 and SyncTable mappings, then a later dummy GPIO enables it. Virtual IDs111+ route through `comm_id=110` and configured mirror model numbers. Read both the Hand xacro and the corresponding DHI `.model` files: mirror widths/addresses differ from the physical actuator table.

At the pinned OMY end-unit configuration, a virtual device uses model231 with controller routing through210; controller read/write mirror addresses and sizes belong to the END layout. OMY BASE, END and Hand have different enable addresses and prerequisites: the manuals/source tables show BASE514, END46 and Hand70. BASE EEPROM writes additionally require DXL Power Enable512=0. Treat these as exact-layout evidence to verify, never a register template for all products or added Cyclo execution permissions.

Some consumer configurations select current controllers, others position/impedance, tactile/pressure, IMU or receiver broadcasters. Do not specialize the reasoning to one example: trace arbitrary declared interfaces and their actual mapping. The same process applies to custom product configurations and future official repositories outside this curated subset.

To extend/update coverage, regenerate source metadata from explicitly pinned local checkouts with `scripts/index_dhi_sources.py` and `scripts/index_dhi_products.py`, inspect diffs and run source/configuration evaluations. A refresh never automatically grants register execution or replaces a user's configured dependency.
