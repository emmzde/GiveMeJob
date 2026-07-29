from __future__ import annotations

import re

from services.ingest.models import Seniority

_MIN_YEARS_RE = re.compile(
    r"\b(?:minimum\s+of\s+|at\s+least\s+)?(\d{1,2})(?:\+|\s*-\s*\d{1,2})?"
    r"\s+(?:years?|yrs?)(?:\s+of)?\s+(?:professional\s+)?experience\b",
    re.IGNORECASE,
)


def infer_seniority(title: str, description: str = "") -> Seniority:
    normalized = f" {title.casefold()} "
    checks = (
        (r"\b(intern|internship|trainee)\b", Seniority.INTERN),
        (r"\b(junior|jr\.?|entry[- ]level|graduate|new grad)\b", Seniority.JUNIOR),
        (r"\b(principal)\b", Seniority.PRINCIPAL),
        (r"\b(staff)\b", Seniority.STAFF),
        (r"\b(chief|c[a-z]o|vice president|vp)\b", Seniority.EXECUTIVE),
        (r"\b(director|head of)\b", Seniority.DIRECTOR),
        (r"\b(manager|engineering manager)\b", Seniority.MANAGER),
        (r"\b(lead)\b", Seniority.LEAD),
        (r"\b(senior|sr\.?)\b", Seniority.SENIOR),
        (r"\b(mid[- ]level|middle)\b", Seniority.MIDDLE),
    )
    for pattern, seniority in checks:
        if re.search(pattern, normalized):
            return seniority

    years = extract_min_years(description)
    if years is None:
        return Seniority.UNKNOWN
    if years <= 1:
        return Seniority.JUNIOR
    if years <= 4:
        return Seniority.MIDDLE
    if years <= 7:
        return Seniority.SENIOR
    return Seniority.LEAD


def extract_min_years(description: str) -> int | None:
    matches = [int(match.group(1)) for match in _MIN_YEARS_RE.finditer(description)]
    return min(matches) if matches else None
