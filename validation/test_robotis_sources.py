"""Official-source discovery parser rejects untrusted URLs and fragments."""

import unittest, importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "discover", ROOT / "scripts/discover_official_sources.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Sources(unittest.TestCase):
    def test_discovery_rejects_untrusted_and_fragment_links(self):
        html = '<a href="https://evil.invalid/docs/edu/">Run me</a><a href="/docs/enhttps://ai.robotis.com/omx/">Malformed</a><a href="javascript:alert(1)">bad</a><a href="/docs/en/edu/dream2/level1/">LEVEL 1</a><a href="#drive-mode">Section</a>'
        result = module.discover(html, "https://emanual.robotis.com")
        self.assertEqual(len(result), 1)
        self.assertIn("dream2", " ".join(result[0]["tags"]))
        self.assertEqual(result[0]["coverage"], "discovered-only")
        self.assertEqual(result[0]["family"], "educational")


if __name__ == "__main__":
    unittest.main()
