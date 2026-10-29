"""Offline inventory/provenance/parser checks, not document semantic proof."""

import unittest, json, importlib.util
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "discover", ROOT / "scripts/discover_official_sources.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Sources(unittest.TestCase):
    def test_inventory_distinguishes_discovery_and_review(self):
        index = json.loads((ROOT / "references/robotis-sources.json").read_text())
        self.assertFalse(index["completePortfolio"])
        self.assertEqual(len({s["id"] for s in index["sources"]}), len(index["sources"]))
        families = {s["family"] for s in index["sources"]}
        self.assertTrue(
            {
                "actuator",
                "robot-platform",
                "educational",
                "software-tooling",
                "controller-accessory",
            }
            <= families
        )
        for s in index["sources"]:
            self.assertEqual(urlparse(s["url"]).scheme, "https")
            self.assertIn(
                urlparse(s["url"]).hostname,
                {
                    "docs.robotis.com",
                    "emanual.robotis.com",
                    "github.com",
                    "zenoh.io",
                    "control.ros.org",
                },
            )
            if s["coverage"] == "discovered-only":
                self.assertIsNone(s["reviewedOn"])
                self.assertEqual(s["execution"], "none")
            else:
                self.assertTrue((ROOT / s["reference"]).is_file())

    def test_repositories_are_metadata_only(self):
        x = json.loads((ROOT / "references/robotis-repositories.json").read_text())
        self.assertEqual(x["owner"], "ROBOTIS-GIT")
        for r in x["repositories"]:
            self.assertTrue(r["html_url"].startswith("https://github.com/ROBOTIS-GIT/"))
            self.assertIsInstance(r["archived"], bool)
            self.assertNotIn("validated", r)

    def test_discovery_rejects_untrusted_and_fragment_links(self):
        html = '<a href="https://evil.invalid/docs/edu/">Run me</a><a href="/docs/enhttps://ai.robotis.com/omx/">Malformed</a><a href="javascript:alert(1)">bad</a><a href="/docs/en/edu/dream2/level1/">LEVEL 1</a><a href="#drive-mode">Section</a>'
        result = module.discover(html, "https://emanual.robotis.com")
        self.assertEqual(len(result), 1)
        self.assertIn("dream2", " ".join(result[0]["tags"]))
        self.assertEqual(result[0]["coverage"], "discovered-only")
        self.assertEqual(result[0]["family"], "educational")

    def test_source_hashes_are_only_byte_evidence(self):
        x = json.loads((ROOT / "modules/dynamixel/sources.json").read_text())
        self.assertEqual({s["id"] for s in x["sources"]} & {"xl330", "xm430"}, {"xl330", "xm430"})
        for s in x["sources"]:
            self.assertEqual(len(s["sha256"]), 64)
            self.assertIn("not independent semantic", s["proofLimit"])
            self.assertGreater(s["bytes"], 0)

    def test_compatibility_is_not_runtime_certification(self):
        x = json.loads((ROOT / "references/compatibility.json").read_text())
        self.assertFalse(x["runtimeTested"])
        for r in x["records"]:
            if "revision" in r:
                self.assertRegex(r["revision"], r"^[0-9a-f]{40}$")


if __name__ == "__main__":
    unittest.main()
