from __future__ import annotations

import hashlib
import re
import unicodedata
from collections import Counter

_TOKEN_RE = re.compile(r"[\w+#.-]{2,}", re.UNICODE)
_MASK_64 = (1 << 64) - 1
_SIGN_BIT_64 = 1 << 63
_COMPANY_SUFFIX_RE = re.compile(
    r"\b(incorporated|inc|llc|ltd|limited|corp|corporation|gmbh|plc|company|co)\b"
)


def simhash64(text: str) -> int:
    """Return a deterministic signed 64-bit SimHash suitable for PostgreSQL BIGINT."""

    tokens = [token.casefold() for token in _TOKEN_RE.findall(text)]
    if not tokens:
        return 0

    weights = [0] * 64
    for token, frequency in Counter(tokens).items():
        digest = int.from_bytes(
            hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest(),
            byteorder="big",
        )
        for bit in range(64):
            weights[bit] += frequency if digest & (1 << bit) else -frequency

    unsigned = sum(1 << bit for bit, weight in enumerate(weights) if weight >= 0)
    return unsigned - (1 << 64) if unsigned & _SIGN_BIT_64 else unsigned


def hamming_distance(left: int, right: int) -> int:
    return ((left & _MASK_64) ^ (right & _MASK_64)).bit_count()


def company_blocking_key(company_name: str) -> str:
    normalized = unicodedata.normalize("NFKC", company_name).casefold()
    normalized = _COMPANY_SUFFIX_RE.sub(" ", normalized)
    normalized = re.sub(r"[^\w]+", " ", normalized, flags=re.UNICODE)
    return " ".join(normalized.split())
