"""Offline inventory, parser and canonical bridge-rule acceptance."""

import importlib.util, json, sys, unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "modules/dynamixel"))
from catalog_json import load_json

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from compile_control_items import rows
from test_sdk_packets import bridge, api, FakePort

ITEMS = load_json((ROOT / "references/control-items.json"))


class Items(unittest.TestCase):
    def test_non_scalar_widths_and_duplicate_rows_are_retained(self):
        text = "### RAM\n| Address | Size | Name | Access |\n|---|---|---|---|\n| 10 | 8 | Serial | R |\n| 20 | 2 | Alias | RW |\n| 22 | 2 | Alias | RW |\n"
        result = list(rows(text))
        self.assertEqual([r["width"] for r in result], [8, 2, 2])
        self.assertEqual(len(result), 3)

    def test_every_rule_has_pinned_source_and_discrete_modes(self):
        self.assertEqual(len(ITEMS["models"]), 89)
        for m in ITEMS["models"]:
            for i in m["items"]:
                if i["write"]["status"] == "resolved":
                    self.assertTrue(i["write"]["sources"])
        xm = next(m for m in ITEMS["models"] if m["catalogId"] == "x_series/xm_series/xm430-w350")
        op = next(i for i in xm["items"] if i["name"] == "Operating Mode")
        self.assertEqual(op["write"]["values"], [0, 1, 3, 4, 5, 16])

    def motor(self):
        b = bridge.Bridge(api)
        p = FakePort()
        p.model = 1020
        p.firmware = 42
        p.values.update(
            {
                0: [252, 3],
                6: [42],
                7: [1],
                8: [1],
                11: [0],
                13: [2],
                38: [100, 0],
                64: [1],
                102: [0, 0],
            }
        )
        b.port = p
        b.handler = api.PacketHandler(2)
        b.protocol = 2
        return b, p

    def test_bridge_uses_canonical_signed_rules_with_torque_on(self):
        b, p = self.motor()
        b.command(
            {
                "op": "bind",
                "catalogId": "x_series/xm_series/xm430-w350",
                "model": 1020,
                "firmware": 42,
                "id": 1,
                "tableItem": "Goal Current@102",
            }
        )
        b.command({"op": "write", "id": 1, "address": 102, "data": [246, 255]})
        self.assertEqual(p.values[102], [246, 255])
        with self.assertRaisesRegex(ValueError, "bounds|limit"):
            b.command({"op": "write", "id": 1, "address": 102, "data": [155, 255]})
        p.values[11] = [3]
        b.command({"op": "write", "id": 1, "address": 102, "data": [1, 0]})
        self.assertEqual(p.values[102], [1, 0])
        with self.assertRaisesRegex(ValueError, "mismatch"):
            b.command({"op": "write", "id": 1, "address": 64, "data": [1]})

    def test_bridge_torque_and_mode_conditions_are_item_specific(self):
        b, p = self.motor()
        b.command(
            {
                "op": "bind",
                "catalogId": "x_series/xm_series/xm430-w350",
                "model": 1020,
                "firmware": 42,
                "id": 1,
                "tableItem": "Torque Enable@64",
            }
        )
        b.command({"op": "write", "id": 1, "address": 64, "data": [0]})
        b.command(
            {
                "op": "bind",
                "catalogId": "x_series/xm_series/xm430-w350",
                "model": 1020,
                "firmware": 42,
                "id": 1,
                "tableItem": "Operating Mode@11",
            }
        )
        with self.assertRaisesRegex(ValueError, "enum"):
            b.command({"op": "write", "id": 1, "address": 11, "data": [2]})
        p.values[64] = [1]
        with self.assertRaisesRegex(ValueError, "torque"):
            b.command({"op": "write", "id": 1, "address": 11, "data": [1]})

    def test_generic_bridge_does_not_write_to_peer_using_primary_conditions(self):
        b, p = self.motor()
        m = json.loads((ROOT / "references/control-tables.json").read_text())
        model = next(
            m for m in m["models"] if m.get("catalogId") == "x_series/xm_series/xm430-w350"
        )
        b.bound = (
            model,
            {
                "id": 1,
                "peerIds": [2],
                "model": 1020,
                "firmware": 42,
                "tableItem": "Goal Current@102",
            },
        )
        with self.assertRaisesRegex(ValueError, "primary"):
            b.validate_write({"id": 2, "address": 102, "data": [0, 0]})

    def test_bridge_rejects_self_peer_before_identity_io(self):
        b, p = self.motor()
        with self.assertRaisesRegex(ValueError, "Distinct"):
            b.command(
                {
                    "op": "bind",
                    "catalogId": "x_series/xl_series/2xl430-w250",
                    "model": 1090,
                    "firmware": 42,
                    "id": 1,
                    "peerIds": [1],
                    "tableItem": "Torque Enable@64",
                }
            )
