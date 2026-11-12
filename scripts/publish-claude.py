"""Publish a prepared Claude branch with the configured identity and signing key.

Only invoked by the manual distribution workflow after package verification.
Never exports keys, rewrites main, force-pushes or falls back to unsigned commits.
"""

import argparse
import json
import os
import subprocess
import time
from pathlib import Path


def run(args, cwd, *, capture=False):
    result = subprocess.run(args, cwd=cwd, check=True, text=True, capture_output=capture)
    return result.stdout.strip() if capture else None


def publish(root):
    root = Path(root).resolve()
    metadata = json.loads((root / "distribution.json").read_bytes())
    required = [
        "GITHUB_REPOSITORY",
        "RELEASE_GIT_NAME",
        "RELEASE_GIT_EMAIL",
        "RELEASE_GITHUB_LOGIN",
        "RELEASE_GPG_FINGERPRINT",
        "RELEASE_GPG_PROGRAM",
    ]
    values = {name: os.environ.get(name, "").strip() for name in required}
    if any(not value for value in values.values()):
        raise ValueError(
            "Configure release identity, registered GPG key and signing program before publishing"
        )
    repo = values["GITHUB_REPOSITORY"]
    if metadata["sourceRepository"] != repo or metadata["generator"] != "cyclo-ai-runtime":
        raise ValueError("Distribution provenance does not match this repository")
    if (root / ".git").exists():
        raise ValueError("Publish only a freshly prepared distribution directory")
    git = lambda *args, capture=False: run(["git", *args], root, capture=capture)
    git("init", "--initial-branch=claude-dist")
    git("config", "user.name", values["RELEASE_GIT_NAME"])
    git("config", "user.email", values["RELEASE_GIT_EMAIL"])
    git("config", "user.signingkey", values["RELEASE_GPG_FINGERPRINT"])
    git("config", "gpg.program", values["RELEASE_GPG_PROGRAM"])
    git("remote", "add", "origin", f"https://github.com/{repo}.git")
    remote = git("ls-remote", "origin", "refs/heads/claude-dist", capture=True)
    if remote:
        git("fetch", "--depth=1", "origin", "refs/heads/claude-dist")
        previous = json.loads(git("show", "FETCH_HEAD:distribution.json", capture=True))
        if (
            previous.get("generator") != metadata["generator"]
            or previous.get("sourceRepository") != repo
        ):
            raise ValueError("Refusing to replace an unrelated claude-dist branch")
        if (
            tuple(map(int, metadata["version"].split(".")))
            <= tuple(map(int, previous["version"].split(".")))
            and previous["sourceCommit"] != metadata["sourceCommit"]
        ):
            raise ValueError("Bump the plugin version before publishing changed source")
        git("reset", "--mixed", "FETCH_HEAD")
    git("add", "--all")
    staged = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=root)
    if staged.returncode == 0:
        print("Claude distribution already matches these source bytes")
        return
    if staged.returncode != 1:
        raise RuntimeError("Could not inspect staged distribution")
    git(
        "commit",
        "-s",
        "-S",
        "-m",
        f"release: Cyclo AI {metadata['version']} from {metadata['sourceCommit']}",
    )
    git("verify-commit", "HEAD")
    trailer = f"Signed-off-by: {values['RELEASE_GIT_NAME']} <{values['RELEASE_GIT_EMAIL']}>"
    if trailer not in git("show", "-s", "--format=%B", capture=True).splitlines():
        raise ValueError("Release commit is missing its configured DCO trailer")
    key_id = git("show", "-s", "--format=%GK", capture=True)
    pages = json.loads(
        run(
            [
                "gh",
                "api",
                "--paginate",
                "--slurp",
                f"users/{values['RELEASE_GITHUB_LOGIN']}/gpg_keys",
            ],
            root,
            capture=True,
        )
    )
    keys = [key for page in pages for key in page]
    registered = any(
        (key["key_id"] == key_id or any(s["key_id"] == key_id for s in key.get("subkeys", [])))
        and any(
            email["email"].casefold() == values["RELEASE_GIT_EMAIL"].casefold()
            and email["verified"]
            for email in key.get("emails", [])
        )
        for key in keys
    )
    if not registered:
        raise ValueError(
            "Signing key and verified email are not registered with the configured GitHub account; not pushing"
        )
    commit = git("rev-parse", "HEAD", capture=True)
    git("push", "origin", "HEAD:refs/heads/claude-dist")
    for attempt in range(6):
        verification = json.loads(
            run(["gh", "api", f"repos/{repo}/commits/{commit}"], root, capture=True)
        )["commit"]["verification"]
        if verification["verified"]:
            print(f"Published claude-dist at {commit}; DCO and GitHub signature verified")
            return
        if attempt < 5:
            time.sleep(2)
    raise RuntimeError(
        f"Branch was pushed but GitHub did not verify {commit}: {verification['reason']}"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    publish(args.directory)
