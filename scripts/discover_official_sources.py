"""Inventory official navigation links. Discovery never promotes review or execution.

Offline: python3 scripts/discover_official_sources.py saved.html --base https://docs.robotis.com
Live retrieval is done separately by the host web tool; this parser executes no content.
"""

from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
import argparse, json, hashlib

ALLOWED = {"docs.robotis.com", "emanual.robotis.com"}


class Navigation(HTMLParser):
    def __init__(self, base):
        super().__init__()
        self.base = base
        self.href = None
        self.text = []
        self.sources = {}

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.href = dict(attrs).get("href")
            self.text = []

    def handle_data(self, data):
        if self.href:
            self.text.append(data)

    def handle_endtag(self, tag):
        if tag != "a" or not self.href:
            return
        href = self.href
        self.href = None
        url = urljoin(self.base, href)
        p = urlparse(url)
        title = " ".join("".join(self.text).split())
        if (
            p.scheme != "https"
            or p.hostname not in ALLOWED
            or p.username
            or p.fragment
            or not p.path.startswith(("/docs/", "/docs/en/"))
            or not title
        ):
            return
        if p.hostname == "emanual.robotis.com" and not p.path.startswith("/docs/en/"):
            return
        if p.path.startswith("/docs/en/"):
            path = p.path[9:]
        else:
            path = p.path[6:]
        family = path.split("/")[0]
        if family == "edu" and title.upper().startswith("LEVEL"):
            title = title + " [" + path.strip("/") + "]"
        category = {
            "dxl": "actuator",
            "software": "software-tooling",
            "parts": "controller-accessory",
            "edu": "educational",
            "platform": "robot-platform",
            "systems": "robot-platform",
        }.get(family, "support-reference")
        canonical = p._replace(query="", fragment="").geturl()
        self.sources.setdefault(
            canonical,
            {
                "id": "nav-" + hashlib.sha256(canonical.encode()).hexdigest()[:12],
                "title": title,
                "url": canonical,
                "family": category,
                "tags": [family, title, path],
                "coverage": "discovered-only",
                "reviewedOn": None,
                "discoveredOn": "2026-10-24",
                "lifecycle": "unknown; catalog inclusion does not prove current availability",
                "execution": "none",
            },
        )


def discover(html, base):
    parser = Navigation(base)
    parser.feed(html)
    return list(parser.sources.values())


if __name__ == "__main__":
    a = argparse.ArgumentParser()
    a.add_argument("html")
    a.add_argument("--base", required=True)
    args = a.parse_args()
    print(json.dumps(discover(open(args.html).read(), args.base), indent=2, ensure_ascii=False))
