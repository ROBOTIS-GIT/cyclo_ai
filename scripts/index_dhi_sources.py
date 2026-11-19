"""Index pinned local official Git objects without executing their code or fetching.

Paths, symbols and string-literal reference locations aid retrieval, not a C++ AST
or proof of dynamic call reachability. Run only on explicitly selected checkouts.
"""

import argparse, hashlib, json, re, subprocess
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "modules/dynamixel"))
from catalog_json import write_catalog

ROOT = Path(__file__).resolve().parents[1]
PINS = {
    "dynamixel_hardware_interface": {
        "main": "6bb5f93ecad1fe3c231e3ece580344e8f0a6efc3",
        "humble": "103f0616abf846127445ad7e456983effe66d005",
        "jazzy": "3375b3d0c99c5bcdab11b2dc15c89a2923e2bca2",
    },
    "dynamixel_interfaces": {
        "main": "5704b4be9149f34f0214ae99c31edf6a5a103b24",
        "humble": "9e2ea841be6396ce820e9c1545d9487c42879158",
        "jazzy": "3392e1214c62c7ee9e05ccc811e3e829c063bae8",
    },
    "DynamixelSDK": {
        "main": "a8d35d51c87e7d253ece1baa963f498a8d933fa0",
        "humble": "59abd67d1f16a199cf0c8608231aee6bb63a57f3",
        "jazzy": "516ae8632c593d7c84afd2bdee2a2fac965305cc",
    },
}


def git(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args])


def metadata(data, path):
    text = data.decode("utf8")
    lines = text.splitlines()
    refs = []
    for n, line in enumerate(lines, 1):
        # Strings and call identifiers are locators; comments remain evidence only in the source reader.
        code = line.split("//")[0]
        terms = sorted(
            set(
                re.findall(r"\b[A-Za-z_]\w*(?:::\w+)*\b", code)
                + re.findall(r"\b([A-Za-z_]\w*(?:::\w+)*)\s*\(", code)
                + re.findall(r'"([A-Za-z][A-Za-z0-9_ /.:+-]{1,100})"', code)
            )
        )
        if path.endswith(".model"):
            terms = sorted(
                set(
                    terms
                    + [v.strip() for v in code.split("\t") if v.strip() and v.strip().isascii()]
                )
            )
        if terms:
            refs.append({"line": n, "terms": terms})
    definitions = []
    masked = re.sub(
        r'//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"', lambda m: re.sub(r"[^\n]", " ", m[0]), text
    )
    for m in re.finditer(r"\b([A-Za-z_]\w*::[A-Za-z_]\w*)\s*\([^;{}]*\)\s*(?:const\s*)?\{", masked):
        start = m.start()
        pos = m.end()
        depth = 1
        while pos < len(masked) and depth:
            depth += int(masked[pos] == "{") - int(masked[pos] == "}")
            pos += 1
        definitions.append(
            {
                "symbol": m[1],
                "line": text.count("\n", 0, start) + 1,
                "endLine": text.count("\n", 0, pos) + 1,
            }
        )
    return {
        "blobSha": hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest(),
        "bytes": len(data),
        "lineCount": len(lines),
        "definitions": definitions,
        "references": refs,
    }


def selected(package, path):
    if package == "DynamixelSDK":
        return path in [
            "README.md",
            "LICENSE",
            "ros/package.xml",
            "ros/dynamixel_sdk/package.xml",
        ] or (path.startswith("c++/") and path.endswith((".cpp", ".h")))
    return path.endswith(
        (".cpp", ".hpp", ".h", ".model", ".srv", ".msg", ".xml", ".repos", ".md", ".rst", ".yml")
    ) or path in ["LICENSE", "CMakeLists.txt"]


def build(roots):
    out = {
        "schemaVersion": 1,
        "checkedOn": "2026-10-26",
        "execution": "Source evidence only; no ROS, serial or controller execution",
        "indexKind": "Git-blob inventory and lexical locators, not semantic verification of every file",
        "packages": {},
    }
    for package, profiles in PINS.items():
        entry = {"repository": "ROBOTIS-GIT/" + package, "license": "Apache-2.0", "profiles": {}}
        for profile, rev in profiles.items():
            files = {}
            for path in (
                git(roots[package], "ls-tree", "-r", "--name-only", rev).decode().splitlines()
            ):
                if selected(package, path):
                    files[path] = metadata(git(roots[package], "show", rev + ":" + path), path)
            p = {"revision": rev, "files": files, "branchAtCheck": profile, "runtimeTested": False}
            if package == "dynamixel_hardware_interface":
                cpp = git(
                    roots[package], "show", rev + ":src/dynamixel_hardware_interface.cpp"
                ).decode()
                hdr = git(
                    roots[package],
                    "show",
                    rev + ":include/dynamixel_hardware_interface/dynamixel_hardware_interface.hpp",
                ).decode()
                p["hardwareParameters"] = sorted(
                    set(re.findall(r'hardware_parameters(?:\[|\.at\(|\.find\()"([^"]+)"', cpp))
                )
                p["lifecycleOverrides"] = sorted(set(re.findall(r"\b(on_\w+)\s*\(", hdr)))
                p["initArgument"] = (
                    "HardwareInfo"
                    if "const hardware_interface::HardwareInfo & info)" in cpp
                    else "HardwareComponentInterfaceParams"
                )
                p["interfaceMaps"] = {}
                for key in ["ros2_to_dxl_cmd_map", "dxl_to_ros2_cmd_map", "ros2_to_dxl_state_map"]:
                    body = re.search(key + r"\s*=\s*\{([\s\S]*?)\n\};", hdr)[1]
                    pairs = []
                    for a, b in re.findall(
                        r'\{(hardware_interface::HW_IF_\w+|"[^"]+"),\s*\{([^}]+)\}\}', body
                    ):
                        names = re.findall(r'"([^"]+)"|HW_IF_(\w+)', b)
                        pairs.append(
                            {
                                "from": a.replace("hardware_interface::HW_IF_", "")
                                .strip('"')
                                .lower()
                                if a.startswith("hardware_interface")
                                else a.strip('"'),
                                "to": [x or y.lower() for x, y in names],
                            }
                        )
                    p["interfaceMaps"][key] = pairs
                lookup = git(
                    roots[package], "show", rev + ":param/dxl_model/dynamixel.model"
                ).decode()
                p["modelLookup"] = [
                    {"modelNumber": int(a), "file": b}
                    for a, b in re.findall(r"^(\d+)\s+(\S+\.model)\s*$", lookup, re.M)
                ]
            entry["profiles"][profile] = p
        out["packages"][package] = entry
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    for name in PINS:
        ap.add_argument("--" + name.replace("_", "-").lower(), required=True)
    ap.add_argument("--output", type=Path, default=ROOT / "references/dhi-sources.json")
    a = ap.parse_args()
    roots = {name: Path(getattr(a, name.lower())) for name in PINS}
    out = build(roots)
    write_catalog(a.output, out)
    print(
        json.dumps(
            {
                p: {n: len(v["files"]) for n, v in x["profiles"].items()}
                for p, x in out["packages"].items()
            }
        )
    )
