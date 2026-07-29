from __future__ import annotations

import html
import re
import unicodedata

from trafilatura import extract

_SPACE_RE = re.compile(r"\s+")
_TITLE_PUNCT_RE = re.compile(r"[^\w+#.]+", re.UNICODE)


def html_to_markdown(value: str) -> str:
    if not value.strip():
        return ""
    extracted = extract(
        value,
        output_format="markdown",
        include_links=True,
        include_formatting=True,
        favor_recall=True,
    )
    if extracted:
        return extracted.strip()
    return _SPACE_RE.sub(" ", html.unescape(re.sub(r"<[^>]+>", " ", value))).strip()


def normalize_title(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).casefold()
    normalized = _TITLE_PUNCT_RE.sub(" ", normalized)
    return _SPACE_RE.sub(" ", normalized).strip()
