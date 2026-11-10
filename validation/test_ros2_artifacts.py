"""Offline customer scaffold acceptance: real Xacro expansion, no ROS startup."""

import ast, copy, importlib.util, json, os, sys, tempfile, unittest
from pathlib import Path
from xml.etree import ElementTree as ET
import yaml

ROOT = Path(__file__).resolve().parents[1]
if os.environ.get("CYCLO_XACRO_TEST_PATH"):
    sys.path.insert(0, os.environ["CYCLO_XACRO_TEST_PATH"])
import xacro

spec = importlib.util.spec_from_file_location("prepare_mock", ROOT / "scripts/prepare_ros2_mock.py")
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
FIXTURE = json.loads((ROOT / "tests/fixtures/arm-mock-spec.json").read_text())


class RosArtifacts(unittest.TestCase):
    def test_customer_generated_xacro_and_controller_mapping(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "customer"
            helper.generate(FIXTURE, out)
            expanded = xacro.process_file(str(out / "mock_arm.urdf.xacro")).toxml()
            robot = ET.fromstring(expanded)
            control = robot.find("ros2_control")
            self.assertEqual(control.findtext("hardware/plugin"), "mock_components/GenericSystem")
            names = [j["name"] for j in FIXTURE["joints"]]
            self.assertEqual([j.attrib["name"] for j in control.findall("joint")], names)
            self.assertEqual([j.attrib["name"] for j in robot.findall("joint")], names)
            controllers = yaml.safe_load((out / "controllers.yaml").read_text())
            self.assertEqual(
                controllers["forward_position_controller"]["ros__parameters"]["joints"], names
            )
            for j in control.findall("joint"):
                self.assertEqual(j.find("command_interface").attrib["name"], "position")
            launch = ast.parse((out / "mock_bringup.launch.py").read_text())
            nodes = [
                n
                for n in ast.walk(launch)
                if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == "Node"
            ]
            packages = [
                ast.literal_eval(next(k.value for k in n.keywords if k.arg == "package"))
                for n in nodes
            ]
            self.assertEqual(
                packages,
                [
                    "robot_state_publisher",
                    "controller_manager",
                    "controller_manager",
                    "controller_manager",
                ],
            )
            for node in nodes[2:]:
                arguments = next(k.value for k in node.keywords if k.arg == "arguments")
                index = next(
                    i
                    for i, v in enumerate(arguments.elts)
                    if isinstance(v, ast.Constant) and v.value == "--param-file"
                )
                self.assertEqual(
                    ast.unparse(arguments.elts[index + 1]), "str(root / 'controllers.yaml')"
                )
            self.assertIn("--inactive", (out / "mock_bringup.launch.py").read_text())
            self.assertNotIn("DynamixelHardware", expanded)
            plan = json.loads((out / "dhi-review.json").read_text())
            self.assertFalse(plan["runtimeTested"])
            self.assertEqual(plan["joints"], FIXTURE["joints"])
            self.assertEqual(plan["dhiPlugin"], "dynamixel_hardware_interface/DynamixelHardware")

    def test_invalid_spec_never_creates_output(self):
        for mutate in [
            lambda s: s.update(rosDistro="rolling"),
            lambda s: s["joints"][1].update(id=1),
            lambda s: s["joints"][0].update(upper=-2),
            lambda s: s["joints"][0].update(name="bad;command"),
        ]:
            bad = copy.deepcopy(FIXTURE)
            mutate(bad)
            with tempfile.TemporaryDirectory() as d:
                out = Path(d) / "bad"
                with self.assertRaises(ValueError):
                    helper.generate(bad, out)
                self.assertFalse(out.exists())

    def test_existing_customer_file_preserved(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "keep.txt"
            p.write_text("user content")
            with self.assertRaises(ValueError):
                helper.generate(FIXTURE, d)
            self.assertEqual(p.read_text(), "user content")
            self.assertEqual(len(list(Path(d).iterdir())), 1)


if __name__ == "__main__":
    unittest.main()
