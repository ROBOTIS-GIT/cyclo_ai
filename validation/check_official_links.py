"""Explicit public-source link and anchor check; not run by default/offline CI.

python3 validation/check_official_links.py --live
Records retrieval evidence only, never promotes content to reviewed status.
"""

import argparse, json, hashlib, concurrent.futures, urllib.request, urllib.parse
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALLOWED = {"docs.robotis.com", "github.com", "zenoh.io", "control.ros.org"}
MAX_BYTES = 2 * 1024 * 1024


def official_url(url):
    try:
        p = urllib.parse.urlparse(url)
        return (
            p.scheme == "https"
            and p.hostname in ALLOWED
            and not p.username
            and p.port in (None, 443)
            and (p.hostname != "github.com" or p.path.startswith("/ROBOTIS-GIT/"))
        )
    except ValueError:
        return False


class OfficialRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not official_url(newurl):
            raise ValueError("Redirect leaves verified public source routes")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class Anchors(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.add(attrs["id"])
        if tag == "a" and "name" in attrs:
            self.ids.add(attrs["name"])


def check(url):
    try:
        if not official_url(url):
            raise ValueError("URL is outside verified public source routes")
        request = urllib.request.Request(
            url, headers={"User-Agent": "CycloPluginSourceCheck/0.4.0"}
        )
        with urllib.request.build_opener(OfficialRedirect()).open(request, timeout=12) as r:
            data = r.read(MAX_BYTES + 1)
            if len(data) > MAX_BYTES:
                raise ValueError("Response exceeds bounded complete-page retrieval")
            fragment = urllib.parse.unquote(urllib.parse.urlparse(url).fragment)
            if fragment:
                anchors = Anchors()
                anchors.feed(data.decode("utf-8"))
                if fragment not in anchors.ids:
                    raise ValueError(f"Missing page anchor: {fragment}")
            return {
                "url": url,
                "status": r.status,
                "finalUrl": r.url,
                "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
                "anchorVerified": fragment or None,
            }
    except Exception as e:
        return {"url": url, "error": str(e)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true")
    args = parser.parse_args()
    if not args.live:
        parser.error("--live is required for public-network retrieval")
    index = json.loads((ROOT / "references/robotis-sources.json").read_text())
    migration = json.loads((ROOT / "validation/official-docs-migration.json").read_text())
    urls = sorted(
        {s["url"] for s in index["sources"]} | {s["url"] for s in migration["verifiedAnchors"]}
    )
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(check, urls))
    result = {
        "checkedOn": datetime.now(timezone.utc).date().isoformat(),
        "kind": "public page/anchor retrieval; not semantic or runtime verification",
        "total": len(results),
        "retrieved": sum("error" not in r for r in results),
        "results": results,
    }
    output = ROOT / "validation/current/source-links.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({k: v for k, v in result.items() if k != "results"}))
    if result["retrieved"] != result["total"]:
        raise SystemExit(1)
