"""Validate source text encoding without restricting contributors' languages."""

from pathlib import Path

TEXT_EXT = {
    ".md",
    ".json",
    ".yaml",
    ".yml",
    ".mjs",
    ".js",
    ".ts",
    ".tsx",
    ".py",
    ".txt",
    ".xml",
    ".toml",
    ".c",
    ".h",
    ".cpp",
    ".svg",
}


def assert_utf8_text(name, data):
    path = Path(name)
    if path.suffix.lower() in TEXT_EXT or path.name.upper().startswith(
        ("README", "LICENSE", "NOTICE")
    ):
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError as error:
            raise ValueError(f"Source text must be UTF-8: {name}") from error
        if "\x00" in text:
            raise ValueError(f"NUL byte in source text: {name}")
