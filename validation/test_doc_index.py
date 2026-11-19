import importlib.util, json, tempfile, unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("doc_index", ROOT / "scripts/index_dynamixel_docs.py")
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class DocIndex(unittest.TestCase):
    def test_tree_from_another_revision_cannot_claim_pinned_links(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "tree.json"
            p.write_text(json.dumps({"sha": "f" * 40, "truncated": False, "tree": []}))
            with patch.object(
                helper.subprocess,
                "run",
                return_value=SimpleNamespace(stdout=helper.REVISION + "\n" + "b" * 40 + "\n"),
            ):
                with self.assertRaisesRegex(ValueError, "tree is not tied"):
                    helper.build(d, p)

    def test_checkout_head_must_match_claimed_revision(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "tree.json"
            p.write_text(json.dumps({"sha": helper.REVISION, "truncated": False, "tree": []}))
            with patch.object(
                helper.subprocess,
                "run",
                return_value=SimpleNamespace(stdout="f" * 40 + "\n" + "b" * 40 + "\n"),
            ):
                with self.assertRaisesRegex(ValueError, "Checkout HEAD"):
                    helper.build(d, p)

    def test_conditional_props_with_greater_than_are_not_truncated(self):
        call = "<Feature since={firmware > 38 ? {value:42} : {value:0}} enabled={false} />"
        data = helper.metadata(
            "docusaurus/docs/dxl/model_reference/fixture.mdx",
            "import Feature from './component.mdx';\n" + call,
        )
        self.assertEqual(data["calls"][0]["propsSource"], call)
