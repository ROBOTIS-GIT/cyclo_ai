"""Independent source-row witnesses and compiler syntax/provenance constraints."""

import importlib.util, json, unittest, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "compile_tables", ROOT / "scripts/compile_control_tables.py"
)
compiler = importlib.util.module_from_spec(spec)
spec.loader.exec_module(compiler)


class ControlTables(unittest.TestCase):
    def test_all_models_match_independent_row_witnesses(self):
        data = json.loads((ROOT / "references/control-tables.json").read_text())
        witness = json.loads(
            (ROOT / "validation/fixtures/control-table-witnesses.json").read_text()
        )
        index = json.loads((ROOT / "references/dynamixel-docs.json").read_text())
        self.assertEqual(data["revision"], witness["revision"])
        self.assertEqual(data["revision"], index["revision"])
        models = {m["catalogId"]: m for m in data["models"]}
        self.assertEqual(set(models), {m["id"] for m in index["models"]})
        for m in witness["models"]:
            actual = models[m["catalogId"]]
            for row in m["rows"]:
                name = "Baud Rate" if row["name"] == "Baud Rate (Bus)" else row["name"]
                r = actual["registers"][name]
                self.assertEqual(
                    [r["address"], r["width"], r["access"], r["source"]["line"]],
                    [row["address"], row["width"], row["access"], row["line"]],
                    m["catalogId"] + ":" + name,
                )

    def test_header_variants_and_malformed_rows_fail_closed(self):
        text = """### Control Table of RAM Area
| Address | Size(Byte) | Data Name | Access | Initial Value | Range | Unit |
| 513 | 1 | [LED](#led) | RW | 0 | 0 ~ 1 | - |
| 514 | 3 | invalid width | RW | 0 | 0 ~ 1 | - |
| 515 | 1 | read only | R | 0 | 0 ~ 1 | - |
"""
        rows = list(compiler.tables(text))
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["address"], 513)
        self.assertEqual(rows[0]["memory"], "RAM")
        self.assertEqual(rows[1]["access"], "R")

    def test_source_bindings_and_upstream_sdk_immutability(self):
        data = json.loads((ROOT / "references/control-tables.json").read_text())
        index = json.loads((ROOT / "references/dynamixel-docs.json").read_text())
        for m in data["models"]:
            if m["kind"] != "actuator":
                continue
            for r in m["registers"].values():
                self.assertEqual(
                    r["source"]["blobSha"], index["files"][r["source"]["path"]]["blobSha"]
                )
            for c in m["capabilities"].values():
                self.assertIn(c["status"], ["resolved", "unresolved", "unsupported"])
        upstream = json.loads((ROOT / "modules/dynamixel/SDK-UPSTREAM.json").read_text())
        for p, digest in upstream["files_sha256"].items():
            self.assertEqual(
                hashlib.sha256(
                    (ROOT / "modules/dynamixel/sdk-upstream" / p).read_bytes()
                ).hexdigest(),
                digest,
            )


if __name__ == "__main__":
    unittest.main()
