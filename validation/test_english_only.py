import unittest,json
from english_only import assert_english_text
class EnglishOnly(unittest.TestCase):
    def test_all_hangul_blocks_rejected(self):
        for point in [0x1100,0x302e,0x3131,0xa960,0xac00,0xd7b0,0xffa1]:
            with self.assertRaises(ValueError):assert_english_text('example.md',('before '+chr(point)).encode())
    def test_encoded_prose_is_not_a_loophole(self):
        for name,data in [('example.json',json.dumps({'prose':chr(0xac00)},ensure_ascii=True).encode()),('example.md',('&#x'+format(0xac00,'X')+';').encode())]:
            with self.assertRaises(ValueError):assert_english_text(name,data)
    def test_english_identifiers_and_source_urls_preserved(self):
        assert_english_text('README.md',b'XM430-W350, PRO R(A), ROBOTIS-GIT/docs, rev/min2, https://docs.robotis.com/')
    def test_non_utf8_text_does_not_hide_hangul(self):
        with self.assertRaises(ValueError):assert_english_text('README.md',('English '+chr(0xac00)).encode('utf-16'))
    def test_escaped_yaml_and_script_prose_rejected(self):
        for name,data in [('agent.yaml',b'prose: "\\uac00"'),('example.mjs',b'const prose="\\uac00";')]:
            with self.assertRaises(ValueError):assert_english_text(name,data)
