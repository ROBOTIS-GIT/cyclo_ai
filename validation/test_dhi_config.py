"""Offline user-artifact analysis, not ROS/plugin or motor execution."""

import unittest, sys, json, yaml
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from inspect_ros2_control import inspect, load_yaml

BASE = '<robot><ros2_control name="arm" type="system"><hardware><plugin>dynamixel_hardware_interface/DynamixelHardware</plugin><param name="port_name">/MOCK</param><param name="baud_rate">1000000</param><param name="number_of_joints">1</param><param name="number_of_transmissions">1</param><param name="dynamixel_model_folder">/param/dxl_model</param>{hardware}</hardware><joint name="j"><command_interface name="{command}"/><state_interface name="position"/></joint>{gpios}</ros2_control></robot>'


def xml(command="position", hardware="", gpios=""):
    return BASE.format(command=command, hardware=hardware, gpios=gpios)


def gpio(name="motor", kind="dxl", id=1, extra=""):
    return f'<gpio name="{name}"><param name="type">{kind}</param><param name="ID">{id}</param>{extra}</gpio>'


def analyze(text=None, yaml="", profile="jazzy", distro="jazzy"):
    return inspect(text or xml(), yaml, profile=profile, distro=distro)


def codes(r):
    return {d["code"] for d in r["diagnostics"]}


class DhiConfig(unittest.TestCase):
    def test_all_reviewed_source_profiles_resolve_without_assuming_installed_binary(self):
        for name in ["main", "humble", "jazzy"]:
            r = analyze(profile=name, distro=name if name != "main" else None)
            self.assertEqual(r["sourceProfile"]["resolved"], name)
            self.assertFalse(r["sourceProfile"]["installedBinaryVerified"])

    def test_unknown_and_conflicting_sources_keep_observations_without_fabricated_behavior(self):
        unknown = analyze(profile="custom-local-patch")
        self.assertIn("unknown-source", codes(unknown))
        self.assertEqual(unknown["components"][0]["derived"], {})
        self.assertIn("version-evidence-conflict", codes(analyze(profile="humble")))
        self.assertIn(
            "rolling-branch-unavailable", codes(analyze(profile="rolling", distro="rolling"))
        )

    def test_torque_selection_follows_gpio_roles_and_explicit_values(self):
        g = (
            gpio()
            + gpio("sensor", "sensor", 2)
            + gpio("disabled", "dxl", 3, '<param name="Torque Enable">0</param>')
            + gpio(
                "virtual",
                "virtual_dxl",
                4,
                '<param name="model_num">231</param><param name="comm_id">210</param>',
            )
        )
        r = analyze(xml(gpios=g, hardware='<param name="disable_torque_at_init">true</param>'))
        d = r["components"][0]["derived"]
        self.assertEqual([x["id"] for x in d["activationTorqueSelection"]], [1, 4])
        self.assertTrue(d["initialTorquePolicy"]["sourceRequestsDisableIfAlreadyOn"])
        self.assertTrue(d["initialTorquePolicy"]["notObservedTorqueState"])

    def test_initialization_write_groups_preserve_model_parameters_without_sending_them(self):
        r = analyze(
            xml(
                gpios=gpio(
                    extra='<param name="Operating Mode">0</param><param name="Current Limit">20</param><param name="Position P Gain">100</param>'
                )
            )
        )
        g = r["components"][0]["gpios"][0]["sourceReview"]["initWriteGroups"]
        self.assertEqual(g["operatingMode"], {"Operating Mode": "0"})
        self.assertEqual(g["limits"], {"Current Limit": "20"})
        self.assertEqual(g["remaining"], {"Position P Gain": "100"})

    def test_acceleration_acceptance_is_not_conversion_support_and_effort_is_not_assumed_torque(
        self,
    ):
        self.assertIn("unmapped-interface", codes(analyze(xml(command="acceleration"))))
        self.assertIn("effort-unit-unverified", codes(analyze(xml(command="effort"))))
        self.assertEqual(
            analyze(xml(command="effort"))["components"][0]["joints"][0]["mappedCommandItems"][
                "effort"
            ],
            ["Goal Current"],
        )

    def test_matrices_scientific_notation_shape_and_invalid_values(self):
        r = analyze(xml(hardware='<param name="joint_to_transmission_matrix">-1e-3</param>'))
        self.assertNotIn("matrix-shape-or-value", codes(r))
        self.assertEqual(
            r["components"][0]["derived"]["joint_to_transmission_matrix"]["values"], [-0.001]
        )
        self.assertIn(
            "matrix-shape-or-value",
            codes(analyze(xml(hardware='<param name="joint_to_transmission_matrix">1,2</param>'))),
        )
        self.assertIn(
            "matrix-shape-or-value",
            codes(analyze(xml(hardware='<param name="joint_to_transmission_matrix">nan</param>'))),
        )

    def test_controller_yaml_namespaces_require_joint_interface_matching_not_assumed_activity(self):
        y = "/robot/controller:\n  ros__parameters:\n    joints: [j]\n    command_interfaces: [velocity]\n"
        r = analyze(yaml=y)
        self.assertIn("controller-interface-mismatch", codes(r))
        self.assertEqual(r["controllers"][0]["selector"], "/robot/controller")
        self.assertIn("unknown", r["controllers"][0]["activeState"])

    def test_multiple_components_with_same_joint_are_ambiguous_not_last_wins(self):
        a = xml().replace("</robot>", "") + xml(command="velocity").replace("<robot>", "").replace(
            'name="arm"', 'name="second"'
        )
        r = analyze(
            a,
            "controller:\n  ros__parameters:\n    joints: [j]\n    command_interfaces: [position]\n",
        )
        self.assertIn("controller-component-ambiguous", codes(r))
        self.assertNotIn("controller-interface-mismatch", codes(r))

    def test_unexpanded_xacro_preserves_evidence_without_evaluating_includes(self):
        x = xml().replace(
            "<robot>",
            '<robot xmlns:xacro="http://www.ros.org/wiki/xacro"><xacro:include filename="/DO-NOT-READ"/>',
        )
        self.assertIn("unexpanded-xacro", codes(analyze(x)))
        self.assertNotIn(
            "unexpanded-xacro",
            codes(
                analyze(
                    xml().replace("<robot>", '<robot xmlns:xacro="http://www.ros.org/wiki/xacro">')
                )
            ),
        )

    def test_mock_and_mujoco_plugins_do_not_inherit_dhi_torque_behavior(self):
        for plugin in [
            "mock_components/GenericSystem",
            "mujoco_hardware_interface/MujocoSystem",
            "custom/PatchedSystem",
        ]:
            r = analyze(xml().replace("dynamixel_hardware_interface/DynamixelHardware", plugin))
            self.assertIn("different-hardware-plugin", codes(r))
            self.assertEqual(r["components"][0]["derived"], {})

    def test_unknown_parameters_and_virtual_routing_are_explicit(self):
        r = analyze(
            xml(
                hardware='<param name="optimized_sync_read_timeout">1</param>',
                gpios=gpio(extra='<param name="comm_id">110</param>'),
            )
        )
        self.assertIn("unrecognized-hardware-parameter", codes(r))
        self.assertIn("physical-comm-id-routing", codes(r))

    def test_hostile_and_duplicate_inputs_cannot_execute_or_silently_override(self):
        for x in [
            '<!DOCTYPE robot [<!ENTITY x SYSTEM "file:///secret">]><robot>&x;</robot>',
            xml(hardware='<param name="baud_rate">2</param>'),
        ]:
            with self.assertRaises(ValueError):
                analyze(x)
        for y in [
            "x: 1\nx: 2",
            "x: !!python/object/apply:os.system [echo unsafe]",
            "x: &a [*a]",
            "x: " + "[" * 100 + "0" + "]" * 100,
        ]:
            with self.assertRaises((ValueError, yaml.YAMLError)):
                load_yaml(y)

    def test_controller_malformed_types_return_precise_diagnostics(self):
        for value in ["position", "[{name: position}]"]:
            r = analyze(
                yaml="controller:\n  ros__parameters:\n    joints: [j]\n    command_interfaces: "
                + value
                + "\n"
            )
            self.assertTrue(
                codes(r) & {"controller-schema-unresolved", "controller-interface-type"}
            )

    def test_shared_nonrecursive_yaml_anchors_are_bounded_and_supported(self):
        self.assertEqual(load_yaml("a: &j [j]\nb: *j")["b"], ["j"])

    def test_namespace_alias_cannot_hide_unexpanded_macro_or_infer_activation(self):
        raw = (
            xml(gpios=gpio())
            .replace(
                "<robot>",
                '<robot xmlns:x-a="http://www.ros.org/wiki/xacro"><x-a:macro name="unused">',
            )
            .replace("</robot>", "</x-a:macro></robot>")
        )
        r = analyze(raw)
        self.assertIn("unexpanded-xacro", codes(r))
        self.assertEqual(r["components"][0]["derived"], {"incompleteExpansion": True})

    def test_repeated_namespace_blocks_and_documents_preserve_all_controller_evidence(self):
        text = "/**:\n  controller_manager:\n    ros__parameters:\n      update_rate: 100\n/**:\n  control:\n    ros__parameters:\n      joints: [j]\n      command_interfaces: [position]\n---\n/ns/control:\n  ros__parameters:\n    joints: [j]\n"
        r = analyze(yaml=text)
        self.assertEqual(len(r["controllers"]), 3)
        self.assertEqual(r["controllers"][0]["parameters"]["update_rate"], 100)
        self.assertEqual(r["controllers"][2]["document"], 1)

    def test_nonzero_matrix_paths_trace_arbitrary_joint_interfaces_to_gpio_commands(self):
        g = gpio(extra="")[:-7] + '<command_interface name="Goal Current"/></gpio>'
        r = analyze(
            xml(
                command="effort",
                gpios=g,
                hardware='<param name="joint_to_transmission_matrix">-2.0</param>',
            )
        )
        route = r["components"][0]["derived"]["cyclicCommandRoutes"][0]
        self.assertEqual(route["field"], "Goal Current")
        self.assertEqual(
            route["contributors"], [{"joint": "j", "interfaces": ["effort"], "coefficient": -2.0}]
        )
        self.assertNotIn("unrouted-joint-command", codes(r))

    def test_declared_controller_and_joint_do_not_create_a_missing_gpio_route(self):
        self.assertIn("unrouted-joint-command", codes(analyze(xml(command="effort", gpios=gpio()))))
        r = analyze(yaml="gripper:\n  ros__parameters:\n    joint: absent\n")
        self.assertIn("controller-joint-missing", codes(r))
        self.assertIn("controller-interface-requirements-unresolved", codes(r))

    def test_parameter_blocks_require_real_mapping_nodes(self):
        for scalar in ["false", "[]", "null"]:
            with self.assertRaisesRegex(ValueError, "mapping"):
                analyze(yaml="control: {ros__parameters: " + scalar + "}")

    def test_invalid_numeric_evidence_never_produces_nonstandard_json_numbers(self):
        report = analyze(xml(hardware='<param name="joint_to_transmission_matrix">nan</param>'))
        self.assertIn("matrix-shape-or-value", codes(report))
        json.dumps(report, allow_nan=False)
        with self.assertRaisesRegex(ValueError, "Non-finite"):
            analyze(yaml="controller: {ros__parameters: {update_rate: .nan}}")
