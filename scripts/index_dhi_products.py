"""Extend source inventory with explicitly reviewed official product snapshots.

Reads local Git objects only. Artifact links and conditional plugin declarations
are discovery evidence, not an evaluated launch or proof of installed versions.
"""

import argparse, ast, json, re
from pathlib import Path
from xml.etree import ElementTree as ET
import yaml
from index_dhi_sources import git, metadata, ROOT
from inspect_ros2_control import controller_blocks

PRODUCTS = {
    "dynamixel_hardware_interface_demos": ("main", "adc228ba5bab6c6f03719343fdbebed207fe3c93"),
    "open_manipulator": ("main", "ee9a720bcc45acda9c0df8fe689b1182844307db"),
    "robotis_hand": ("main", "6f9e22a5fc86fe2f0947a44405e52e776c8c08c8"),
    "ai_sapiens": ("main", "937c67d66db1015a73a359f2c742943810a74e3a"),
    "ai_worker": ("main", "53d17f22c919c723b58f84971826145f699077a0"),
    "RH-P12-RN-A": ("main", "10fd7a69604c6f811367963715f5e0fc024fad6d"),
    "turtlebot3_autorace": ("feature-alley-update", "255111eb40b5235f5b2ea73891516a8d1b483d29"),
}


def artifacts(text, path):
    out = {
        "path": path,
        "references": sorted(
            set(re.findall(r"[A-Za-z0-9_./${}+-]+\.(?:xacro|urdf|yaml|yml|launch\.py)", text))
        ),
        "conditionsEvaluated": False,
    }
    if path.endswith((".xacro", ".urdf")):
        try:
            root = ET.fromstring(text)
            out["plugins"] = [(x.text or "").strip() for x in root.iter("plugin")]
            out["xacroConditions"] = [
                {"kind": x.tag.split("}")[-1], "value": x.get("value")}
                for x in root.iter()
                if x.tag.endswith(("}if", "}unless"))
            ]
            out["includes"] = [x.get("filename") for x in root.iter() if x.tag.endswith("}include")]
            out["gpioInitSequence"] = [
                {
                    "name": x.get("name"),
                    "params": [
                        {"name": p.get("name"), "value": (p.text or "").strip()}
                        for p in x.findall("param")
                    ],
                }
                for x in root.iter("gpio")
            ]
            out["joints"] = [
                {
                    "name": j.get("name"),
                    "commands": [x.get("name") for x in j.findall("command_interface")],
                    "states": [x.get("name") for x in j.findall("state_interface")],
                }
                for j in root.iter("joint")
                if j.findall("command_interface") or j.findall("state_interface")
            ]
        except ET.ParseError as e:
            out["parseIssue"] = str(e)
    if path.endswith(".launch.py"):
        try:
            tree = ast.parse(text)
            out["launchArguments"] = []
            for call in ast.walk(tree):
                if (
                    isinstance(call, ast.Call)
                    and getattr(call.func, "id", None) == "DeclareLaunchArgument"
                ):
                    out["launchArguments"].append(
                        {
                            "nameExpression": ast.unparse(call.args[0]) if call.args else None,
                            "defaultExpression": next(
                                (
                                    ast.unparse(k.value)
                                    for k in call.keywords
                                    if k.arg == "default_value"
                                ),
                                None,
                            ),
                        }
                    )
        except SyntaxError as e:
            out["parseIssue"] = str(e)
    if path.endswith((".yaml", ".yml")):
        try:
            rows = controller_blocks(text)
            out["controllerParameters"] = [
                {
                    "selector": r["selector"],
                    "document": r["document"],
                    "parameters": {
                        k: v
                        for k, v in r["parameters"].items()
                        if k
                        in [
                            "update_rate",
                            "type",
                            "joints",
                            "command_interfaces",
                            "state_interfaces",
                            "interface_name",
                        ]
                    },
                    "controllerTypes": {
                        str(k): v["type"]
                        for k, v in r["parameters"].items()
                        if isinstance(v, dict) and "type" in v
                    },
                }
                for r in rows
            ]
        except (yaml.YAMLError, TypeError, ValueError):
            out["parseIssue"] = "Controller YAML could not be mapped"
    if path.endswith(".repos"):
        try:
            out["dependencies"] = [
                {
                    "name": k,
                    "url": v.get("url"),
                    "ref": v.get("version"),
                    "immutableRef": bool(re.fullmatch("[a-f0-9]{40}", str(v.get("version", "")))),
                }
                for k, v in (yaml.safe_load(text) or {}).get("repositories", {}).items()
            ]
        except (yaml.YAMLError, AttributeError):
            out["parseIssue"] = "Dependency manifest could not be mapped"
    return out


def build(prefix, index):
    products = []
    for name, (branch, rev) in PRODUCTS.items():
        checkout = Path(str(prefix) + name)
        files = {}
        records = []
        for path in git(checkout, "ls-tree", "-r", "--name-only", rev).decode().splitlines():
            if (
                not path.endswith(
                    (
                        ".cpp",
                        ".hpp",
                        ".h",
                        ".xacro",
                        ".urdf",
                        ".yaml",
                        ".yml",
                        ".xml",
                        ".repos",
                        ".py",
                        ".md",
                        ".rst",
                    )
                )
                and path != "CMakeLists.txt"
            ):
                continue
            if any(x in path.split("/") for x in ["meshes", "images", ".git", "assets"]):
                continue
            b = git(checkout, "show", rev + ":" + path)
            files[path] = metadata(b, path)
            if path.endswith((".xacro", ".urdf", ".launch.py", ".repos")) or (
                "controller" in path and path.endswith((".yaml", ".yml"))
            ):
                records.append(artifacts(b.decode(), path))
        p = {
            "repository": "ROBOTIS-GIT/" + name,
            "license": "Check exact indexed LICENSE before redistributing upstream content",
            "profiles": {
                branch: {
                    "revision": rev,
                    "files": files,
                    "branchAtCheck": branch,
                    "runtimeTested": False,
                }
            },
        }
        index["packages"][name] = p
        products.append(
            {
                "package": name,
                "repository": p["repository"],
                "profile": branch,
                "revision": rev,
                "artifacts": records,
                "dhiDeclaredIn": [
                    r["path"]
                    for r in records
                    if "dynamixel_hardware_interface/DynamixelHardware" in r.get("plugins", [])
                ],
                "otherPluginDeclarations": sorted(
                    set(
                        x
                        for r in records
                        for x in r.get("plugins", [])
                        if x != "dynamixel_hardware_interface/DynamixelHardware"
                    )
                ),
                "installedDependencyVersion": "unknown; .repos/branch declarations are not installed binary locks",
            }
        )
    return {
        "checkedOn": "2026-10-26",
        "coverage": "Seven confirmed official consumer/demo repositories; inspected default-branch snapshots and listed configuration artifacts, not all releases, private repositories or every official consumer",
        "products": products,
        "searchScope": {
            "method": "Official organization repository listing, targeted package-manifest code search and dependency/product references; physical plugin declarations verified in selected source snapshots",
            "additionalCandidates": [
                "dynamixel_hardware_interface_demos",
                "turtlebot3_manipulation",
                "open_manipulator_p",
                "open_manipulator_controls",
            ],
            "candidateStatus": "Not promoted to verified product integration without inspecting exact plugin/config/branch; legacy workbench dependencies do not imply DHI",
            "privateSources": "No private source content accessed; only public-repository matches retained",
            "manifestSearch": json.loads((ROOT / "references/dhi-discovery.json").read_text()),
        },
        "manuals": [
            {
                "product": "robotis_hand",
                "url": "https://ai.robotis.com/hands/control_table_hands.html",
                "role": "Device/controller TableSync semantics and limitations; compare exact model/firmware and conflicting examples",
            },
            {
                "product": "open_manipulator",
                "url": "https://ai.robotis.com/omy/control_table_omy_unit",
                "role": "OMY BASE/END distinct layouts and EEPROM power prerequisite",
            },
        ],
    }


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--checkout-prefix", required=True)
    a = ap.parse_args()
    index = json.loads((ROOT / "references/dhi-sources.json").read_text())
    out = build(a.checkout_prefix, index)
    (ROOT / "references/dhi-sources.json").write_text(
        json.dumps(index, separators=(",", ":")) + "\n"
    )
    (ROOT / "references/dhi-products.json").write_text(json.dumps(out, indent=2) + "\n")
    print(
        json.dumps(
            {
                p["package"]: {
                    "artifacts": len(p["artifacts"]),
                    "dhiDeclarations": len(p["dhiDeclaredIn"]),
                }
                for p in out["products"]
            }
        )
    )
