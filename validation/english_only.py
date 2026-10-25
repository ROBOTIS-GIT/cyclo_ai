"""English-only package guard. Detect text and JSON/HTML-encoded Hangul.

Never rewrite third-party notices: a conflict must be reported, not translated.
"""
import html,json,re,unicodedata
from pathlib import Path
import yaml
HANGUL=re.compile(r'[\u1100-\u11ff\u302e-\u302f\u3130-\u318f\ua960-\ua97f\uac00-\ud7af\ud7b0-\ud7ff\uffa0-\uffdc]')
TEXT_EXT={'.md','.json','.yaml','.yml','.mjs','.js','.ts','.tsx','.py','.txt','.xml','.toml','.c','.h','.cpp'}
ESCAPE=re.compile(r'\\u(?:\{([0-9a-fA-F]{1,6})\}|([0-9a-fA-F]{4}))')
def decode_escapes(value):
    return ESCAPE.sub(lambda m:chr(int(m[1] or m[2],16)) if int(m[1] or m[2],16)<=0x10ffff else m[0],value)
def assert_english_text(name,data):
    if HANGUL.search(str(name)):raise ValueError('Hangul in packaged path: '+str(name))
    try:text=data.decode('utf-8')
    except UnicodeDecodeError:
        if Path(str(name)).suffix.lower() in TEXT_EXT or Path(str(name)).name.upper().startswith(('README','LICENSE','NOTICE')):raise ValueError('Packaged text must be UTF-8: '+str(name))
        return
    def check(value):
        if isinstance(value,str):
            if HANGUL.search(value) or HANGUL.search(unicodedata.normalize('NFKC',html.unescape(value))):raise ValueError('Hangul in packaged text: '+str(name))
        elif isinstance(value,dict):
            for k,v in value.items():check(k);check(v)
        elif isinstance(value,list):
            for v in value:check(v)
    check(text)
    suffix=Path(str(name)).suffix.lower()
    if suffix=='.md':check(decode_escapes(text))
    if suffix in {'.js','.mjs','.ts','.tsx'}:
        # Check escaped string prose, not legitimate Unicode regex ranges.
        for m in re.finditer(r'''"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`''',text,re.S):check(decode_escapes(m[0]))
    if str(name).endswith('.json'):
        try:parsed=json.loads(text)
        except json.JSONDecodeError:return
        check(parsed)
    if suffix in {'.yaml','.yml'}:
        try:parsed=yaml.safe_load(text)
        except yaml.YAMLError:return
        check(parsed)
