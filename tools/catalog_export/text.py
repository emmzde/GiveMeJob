from __future__ import annotations

import html
import re
import unicodedata
from html.parser import HTMLParser

_BLOCK_TAGS = frozenset(
    {
        "address",
        "article",
        "aside",
        "blockquote",
        "br",
        "div",
        "footer",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "header",
        "hr",
        "li",
        "main",
        "nav",
        "ol",
        "p",
        "pre",
        "section",
        "table",
        "td",
        "th",
        "tr",
        "ul",
    }
)
_HIDDEN_TAGS = frozenset({"script", "style"})
_AUTOLINK_RE = re.compile(r"<((?:https?://|mailto:)[^<>\s]+)>", re.IGNORECASE)
_IMAGE_RE = re.compile(r"!\[([^\]]*)\]\([^)]*\)")
_LINK_RE = re.compile(r"\[([^\]]+)\]\([^)]*\)")
_REFERENCE_LINK_RE = re.compile(r"\[([^\]]+)\]\[[^\]]*\]")
_REFERENCE_DEFINITION_RE = re.compile(r"^\s{0,3}\[[^\]]+\]:\s+\S+.*$", re.MULTILINE)
_FENCE_RE = re.compile(r"^\s{0,3}(?:`{3,}|~{3,}).*$", re.MULTILINE)
_HEADING_RE = re.compile(r"^\s{0,3}#{1,6}\s+", re.MULTILINE)
_QUOTE_RE = re.compile(r"^\s{0,3}>\s?", re.MULTILINE)
_LIST_RE = re.compile(r"^\s*(?:[-+*]|\d+[.)])\s+", re.MULTILINE)
_HORIZONTAL_RULE_RE = re.compile(r"^\s{0,3}(?:([-*_])\s*){3,}$", re.MULTILINE)
_WHITESPACE_RE = re.compile(r"[^\S\n]+")
_BLANK_LINES_RE = re.compile(r"\n{3,}")


class _PlainTextHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._chunks: list[str] = []
        self._hidden_depth = 0

    def handle_starttag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        del attrs
        normalized = tag.casefold()
        if normalized in _HIDDEN_TAGS:
            self._hidden_depth += 1
        elif not self._hidden_depth and normalized in _BLOCK_TAGS:
            self._chunks.append("\n")

    def handle_startendtag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        normalized = tag.casefold()
        if normalized in _HIDDEN_TAGS:
            if self._hidden_depth:
                self._hidden_depth -= 1
        elif not self._hidden_depth and normalized in _BLOCK_TAGS:
            self._chunks.append("\n")

    def handle_data(self, data: str) -> None:
        if not self._hidden_depth:
            self._chunks.append(data)

    def text(self) -> str:
        return "".join(self._chunks)


def description_to_plain_text(value: str) -> str:
    """Convert mixed Markdown/HTML descriptions to deterministic Unicode plain text."""
    normalized = unicodedata.normalize("NFKC", value).replace("\r\n", "\n").replace("\r", "\n")
    normalized = _REFERENCE_DEFINITION_RE.sub("", normalized)
    normalized = _FENCE_RE.sub("", normalized)
    normalized = _IMAGE_RE.sub(r"\1", normalized)
    normalized = _LINK_RE.sub(r"\1", normalized)
    normalized = _REFERENCE_LINK_RE.sub(r"\1", normalized)
    normalized = _AUTOLINK_RE.sub(r"\1", normalized)

    parser = _PlainTextHTMLParser()
    parser.feed(normalized)
    parser.close()
    plain = html.unescape(parser.text())
    plain = _HORIZONTAL_RULE_RE.sub("", plain)
    plain = _HEADING_RE.sub("", plain)
    plain = _QUOTE_RE.sub("", plain)
    plain = _LIST_RE.sub("", plain)
    plain = plain.replace("**", "").replace("__", "").replace("~~", "").replace("`", "")

    lines = [_WHITESPACE_RE.sub(" ", line).strip() for line in plain.split("\n")]
    collapsed = "\n".join(lines).strip()
    return _BLANK_LINES_RE.sub("\n\n", collapsed)
