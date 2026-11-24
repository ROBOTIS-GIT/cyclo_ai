"""Official-source discovery, replacement provenance and bounded link validation."""

import unittest, importlib.util, json
from http.client import HTTPResponse
from io import BytesIO
from pathlib import Path
from unittest.mock import patch, MagicMock

ROOT = Path(__file__).resolve().parents[1]


def module_at(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


discovery = module_at("discover", "scripts/discover_official_sources.py")
links = module_at("links", "validation/check_official_links.py")


class Sources(unittest.TestCase):
    def test_discovery_rejects_untrusted_retired_and_fragment_links(self):
        html = '<a href="https://evil.invalid/docs/edu/">Run me</a><a href="https://emanual.robotis.com/docs/en/edu/dream/dream2-1/">Retired</a><a href="javascript:alert(1)">bad</a><a href="/docs/edu/engineer/kit1">ENGINEER Kit 1</a><a href="#drive-mode">Section</a>'
        result = discovery.discover(html, "https://docs.robotis.com")
        self.assertEqual(len(result), 1)
        self.assertIn("engineer", " ".join(result[0]["tags"]))
        self.assertEqual(result[0]["coverage"], "discovered-only")
        self.assertEqual(result[0]["family"], "educational")

    def test_replacement_inventory_preserves_fresh_retrieval_evidence(self):
        index = json.loads((ROOT / "references/robotis-sources.json").read_text())
        report = json.loads((ROOT / "validation/official-docs-migration.json").read_text())
        sources = {s["id"]: s for s in index["sources"]}
        for row in report["replaced"]:
            source = sources[row["id"]]
            self.assertEqual(source["url"], row["url"])
            self.assertTrue(source["url"].startswith("https://docs.robotis.com/docs/"))
            evidence = source["lastRetrieval"]
            self.assertEqual(evidence["checkedOn"], report["checkedOn"])
            self.assertEqual(len(evidence["sha256"]), 64)
            self.assertGreater(evidence["bytes"], 0)
        self.assertTrue(all(r["id"] not in sources for r in report["removed"]))
        for path in [
            "references/robotis-sources.json",
            "references/robotis-repositories.json",
            "references/control-source-supplements.json",
            "modules/dynamixel/sources.json",
        ]:
            self.assertNotIn("emanual", (ROOT / path).read_text().lower())
        snapshots = json.loads((ROOT / "modules/dynamixel/sources.json").read_text())
        for snapshot in snapshots["sources"][:3]:
            source_id = "dynamixel-y" if snapshot["id"] == "y" else snapshot["id"]
            source = sources[source_id]
            self.assertEqual(snapshot["url"], source["url"])
            self.assertEqual(snapshot["sha256"], source["lastRetrieval"]["sha256"])
            self.assertEqual(snapshot["bytes"], source["lastRetrieval"]["bytes"])

    def test_model_supplements_use_exact_current_docs_without_changing_masks(self):
        supplement = json.loads((ROOT / "references/control-source-supplements.json").read_text())
        proofs = {s["path"]: s for s in supplement["sources"]}
        for fix in supplement["resolutions"]:
            self.assertEqual(
                fix["allowedMask"], 3 if fix["item"] == "Startup Configuration" else 15
            )
            for path in fix["sourcePaths"]:
                self.assertEqual(proofs[path]["repository"], "ROBOTIS-GIT/docs")
                self.assertEqual(len(proofs[path]["blobSha"]), 40)
            if fix["item"] == "Startup Configuration":
                self.assertEqual(fix["minimumFirmware"], 45)

    def test_link_check_rejects_old_host_before_network(self):
        with patch.object(links.urllib.request, "build_opener") as network:
            self.assertIn(
                "error", links.check("https://emanual.robotis.com/docs/en/dxl/protocol2/")
            )
            network.assert_not_called()
        self.assertFalse(links.official_url("https://github.com/untrusted/manual"))
        self.assertFalse(links.official_url("https://docs.robotis.com:invalid/docs/"))

    def test_link_check_requires_actual_anchor_and_complete_bytes(self):
        response = MagicMock()
        response.__enter__.return_value = response
        response.status = 200
        response.headers = {}
        response.url = "https://docs.robotis.com/docs/dxl/protocol/protocol2"
        response.read.return_value = b'<h2 id="instruction-packet">Instructions</h2>'
        with patch.object(links.urllib.request, "build_opener") as network:
            network.return_value.open.return_value = response
            url = response.url + "#instruction-packet"
            self.assertEqual(links.check(url)["anchorVerified"], "instruction-packet")
            self.assertIn("Missing page anchor", links.check(response.url + "#invented")["error"])
            response.read.return_value = b"x" * (links.MAX_BYTES + 1)
            self.assertIn("bounded", links.check(url)["error"])

    def test_link_check_requires_advertised_length_even_after_valid_anchor(self):
        url = "https://docs.robotis.com/docs/dxl/protocol/protocol2#instruction-packet"
        body = b'<h2 id="instruction-packet">Instructions</h2>'
        for length in [len(body), len(body) + 1]:
            with (
                self.subTest(length=length),
                patch.object(links.urllib.request, "build_opener") as network,
            ):
                socket = MagicMock()
                socket.makefile.return_value = BytesIO(
                    f"HTTP/1.1 200 OK\r\nContent-Length: {length}\r\n\r\n".encode() + body
                )
                response = HTTPResponse(socket)
                response.begin()
                response.url = url
                network.return_value.open.return_value = response
                result = links.check(url)
                if length == len(body):
                    self.assertEqual(result["bytes"], length)
                    self.assertEqual(result["anchorVerified"], "instruction-packet")
                else:
                    self.assertIn("Content-Length", result["error"])
                    self.assertNotIn("sha256", result)


if __name__ == "__main__":
    unittest.main()
