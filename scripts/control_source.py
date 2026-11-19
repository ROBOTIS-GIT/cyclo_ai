"""Read pinned MDX as data and resolve its small documented props/Show subset.

No source evaluation, imports or JavaScript execution. Unknown expressions remain
explicit, preventing them from silently becoming executable register semantics.
"""

import ast, hashlib, re
from pathlib import Path
from compile_control_tables import plain
from index_dynamixel_docs import clean_comments

UNDEFINED = object()
UNKNOWN = object()


def expression(expr, props):
    expr = expr.strip()
    if expr.startswith("(") and expr.endswith(")"):
        return expression(expr[1:-1], props)
    ternary = re.fullmatch(
        r"""(.+?)\?\s*("[^"\\]*"|'[^'\\]*'|-?\d+|true|false)\s*:\s*("[^"\\]*"|'[^'\\]*'|-?\d+|true|false)""",
        expr,
    )
    if ternary:
        condition = expression(ternary[1], props)
        if condition is UNKNOWN:
            return UNKNOWN
        return expression(
            ternary[2] if condition is not UNDEFINED and bool(condition) else ternary[3], props
        )
    for op in ["??", "!==", "===", "!=", "==", ">=", "<=", ">", "<", "&&", "||"]:
        if op not in expr:
            continue
        left, right = expr.split(op, 1)
        a = expression(left, props)
        b = expression(right, props)
        if UNKNOWN in [a, b]:
            return UNKNOWN
        if op == "??":
            return b if a is UNDEFINED or a is None else a
        if op == "&&":
            return b if a is not UNDEFINED and bool(a) else False
        if op == "||":
            return a if a is not UNDEFINED and bool(a) else b
        if op in ["!==", "!="]:
            return a != b
        if op in ["===", "=="]:
            return a == b
        if a is UNDEFINED or b is UNDEFINED:
            return False
        return {">=": lambda: a >= b, "<=": lambda: a <= b, ">": lambda: a > b, "<": lambda: a < b}[
            op
        ]()
    if expr.startswith("!"):
        value = expression(expr[1:], props)
        return UNKNOWN if value is UNKNOWN else not (value is not UNDEFINED and bool(value))
    if re.fullmatch(r"props\.\w+", expr):
        return props.get(expr[6:], UNDEFINED)
    if expr in ["true", "false", "null", "undefined"]:
        return {"true": True, "false": False, "null": None, "undefined": UNDEFINED}[expr]
    try:
        value = ast.literal_eval(expr)
        return value if isinstance(value, (str, int, float, bool, type(None))) else UNKNOWN
    except (ValueError, SyntaxError):
        return UNKNOWN


def props_from(tag, parent=None):
    props = {}
    parent = parent or {}
    for m in re.finditer(r'(\w+)\s*=\s*(?:\{([^{}]*)\}|"([^"]*)"|\'([^\']*)\')', tag):
        props[m[1]] = (
            expression(m[2], parent) if m[2] is not None else m[3] if m[3] is not None else m[4]
        )
    return props


def render(text, props):
    text = clean_comments(text)
    unresolved = []

    def show(content):
        token = re.compile(r"<Show\s+when=\{([^{}]*)\}\s*>|</Show>")
        out = []
        pos = 0
        while True:
            match = token.search(content, pos)
            if not match:
                out.append(content[pos:])
                break
            out.append(content[pos : match.start()])
            if match[0] == "</Show>":
                unresolved.append("Unmatched Show")
                pos = match.end()
                continue
            depth = 1
            end = match.end()
            for close in token.finditer(content, match.end()):
                depth += -1 if close[0] == "</Show>" else 1
                if depth == 0:
                    end = close.end()
                    body = content[match.end() : close.start()]
                    break
            else:
                unresolved.append("Unclosed Show")
                out.append(content[match.start() :])
                break
            value = expression(match[1], props)
            if value is UNKNOWN:
                unresolved.append(match[1])
            elif value is not UNDEFINED and bool(value):
                out.append(show(body))
            pos = end
        return "".join(out)

    text = show(text)

    def fragment(m):
        value = expression(m[1], props)
        if value is UNKNOWN:
            unresolved.append(m[1])
            return ""
        return m[2] if value is not UNDEFINED and bool(value) else ""

    text = re.sub(r"\{(props\.[^{}]+?)\s*&&\s*<>(.*?)</>\}", fragment, text, flags=re.S)

    def choose(m):
        value = expression(m[1], props)
        if value is UNKNOWN:
            unresolved.append(m[1])
            return ""
        return m[2] if value is not UNDEFINED and bool(value) else m[3]

    text = re.sub(
        r"\{(props\.[^{}?]+?)\s*\?\s*<>(.*?)</>\s*:\s*<>(.*?)</>\}", choose, text, flags=re.S
    )
    text = re.sub(
        r"\{(props\.[^{}?]+?)\s*\?\s*(<a\s[^{}]+?</a>)\s*:\s*(<a\s[^{}]+?</a>)\s*\}",
        choose,
        text,
        flags=re.S,
    )

    def replace(m):
        value = expression(m[1], props)
        if value is UNKNOWN:
            unresolved.append(m[1])
            return m[0]
        return (
            ""
            if value is UNDEFINED or value is None
            else str(value).lower()
            if isinstance(value, bool)
            else str(value)
        )

    text = re.sub(r"\{(props\.[^{}]+)\}", replace, text)
    return text, unresolved


def normalized(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


class Sources:
    def __init__(self, cache, index):
        self.cache = Path(cache)
        self.index = index
        self.loaded = {}

    def read(self, path):
        if path not in self.loaded:
            b = (self.cache / path).read_bytes()
            expected = self.index["files"][path]["blobSha"]
            if hashlib.sha1(f"blob {len(b)}\0".encode() + b).hexdigest() != expected:
                raise ValueError("Source blob mismatch: " + path)
            self.loaded[path] = b.decode()
        return self.loaded[path]

    def section(self, path, item):
        text = clean_comments(self.read(path))
        lines = text.splitlines()
        heads = list(re.finditer(r"^(#{3,6})\s+(.+)$", text, re.M))
        best = None
        for h in heads:
            title = plain(h[2])
            nums = [int(x) for x in re.findall(r"\d+", title)]
            n = normalized(re.sub(r"\([^)]*\)", "", title))
            iname = normalized(item["name"])
            prefix = re.sub(r"\d+$", "", iname)
            score = (
                10 * (item["address"] in nums)
                + 5 * (iname == n)
                + 3 * (prefix == re.sub(r"\d+$", "", n))
                + int(iname in n or n in iname)
            )
            if score < 3:
                continue
            if best is None or score > best[0]:
                best = (score, h)
        if not best:
            return "", [], ["No matching item description section"]
        h = best[1]
        level = len(h[1])
        end = next(
            (x.start() for x in heads if x.start() > h.start() and len(x[1]) <= level), len(text)
        )
        part = text[h.start() : end]
        first = text[: h.start()].count("\n") + 1
        last = text[:end].count("\n") + 1
        calls = [
            c
            for c in self.index["files"][path]["calls"]
            if first <= c["sourceLine"] < last and c["path"] in self.index["files"]
        ]
        evidence = [{"path": path, "line": first, "blobSha": self.index["files"][path]["blobSha"]}]
        unresolved = []
        for call in calls:
            target = call["path"]
            props = props_from(call["propsSource"])
            body, unknown = render(self.read(target), props)
            part = part.replace(call["propsSource"], body)
            unresolved.extend(unknown)
            evidence.append(
                {
                    "path": target,
                    "line": 1,
                    "blobSha": self.index["files"][target]["blobSha"],
                    "props": {k: v for k, v in props.items() if v not in [UNDEFINED, UNKNOWN]},
                }
            )
        return part, evidence, unresolved


def numeric_range(value):
    text = plain(value).replace(",", "").replace("−", "-").replace("–", "~")
    m = re.fullmatch(r"\s*(-?\d+)\s*(?:~|to)\s*(-?\d+)\s*", text)
    return [int(m[1]), int(m[2])] if m else None


def bound_expression(value):
    value = plain(value).strip().replace(",", "").replace("−", "-")
    if re.fullmatch(r"-?\d+", value):
        return {"constant": int(value)}
    m = re.fullmatch(r"(-?)\s*\[?(.+?)\s*\(\s*(\d+)\s*\)\]?\s*", value)
    if m:
        return {"item": m[2].strip(), "address": int(m[3]), "sign": -1 if m[1] else 1}
    return None


def dynamic_range(value):
    parts = plain(value).split("~")
    if len(parts) != 2:
        return None
    lo, hi = map(bound_expression, parts)
    return {"lower": lo, "upper": hi} if lo and hi else None
