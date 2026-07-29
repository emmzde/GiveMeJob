from __future__ import annotations

import re
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from urllib.parse import parse_qs, urlsplit

from services.ingest.models import EmploymentType, RemoteType, SalaryPeriod, Seniority

_SPACE_RE = re.compile(r"\s+")
_SLUG_RE = re.compile(r"[^a-z0-9]+")


def require_object(value: object, *, context: str) -> dict[str, object]:
    if not isinstance(value, dict) or not all(isinstance(key, str) for key in value):
        raise ValueError(f"{context} must be a JSON object")
    return value


def object_list(value: object, *, context: str) -> list[dict[str, object]]:
    if not isinstance(value, list):
        raise ValueError(f"{context} must be a JSON array")
    return [require_object(item, context=f"{context} item") for item in value]


def optional_str(value: object) -> str | None:
    if value is None:
        return None
    text = _SPACE_RE.sub(" ", str(value)).strip()
    return text or None


def required_str(value: object, *, field: str) -> str:
    text = optional_str(value)
    if text is None:
        raise ValueError(f"{field} is required")
    return text


def string_list(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [text for item in value if (text := optional_str(item)) is not None]
    text = optional_str(value)
    return [text] if text is not None else []


def slugify(value: str) -> str:
    return _SLUG_RE.sub("-", value.casefold()).strip("-")


def parse_datetime(value: object) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        timestamp = float(value)
        if timestamp > 10_000_000_000:
            timestamp /= 1000
        return datetime.fromtimestamp(timestamp, tz=UTC)
    text = required_str(value, field="datetime")
    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def parse_decimal(value: object) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"invalid decimal value: {value}") from exc


def parse_int(value: object, *, field: str) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise ValueError(f"{field} must be an integer")
    return int(value)


def parse_page_from_url(value: object) -> str | None:
    url = optional_str(value)
    if url is None:
        return None
    page = parse_qs(urlsplit(url).query).get("page")
    return page[0] if page else None


def map_employment_type(value: object) -> EmploymentType:
    normalized = slugify(optional_str(value) or "")
    mapping = {
        "full-time": EmploymentType.FULL_TIME,
        "fulltime": EmploymentType.FULL_TIME,
        "part-time": EmploymentType.PART_TIME,
        "parttime": EmploymentType.PART_TIME,
        "contract": EmploymentType.CONTRACT,
        "contractor": EmploymentType.CONTRACT,
        "freelance": EmploymentType.CONTRACT,
        "temporary": EmploymentType.TEMPORARY,
        "intern": EmploymentType.INTERNSHIP,
        "internship": EmploymentType.INTERNSHIP,
        "volunteer": EmploymentType.VOLUNTEER,
        "other": EmploymentType.OTHER,
    }
    return mapping.get(normalized, EmploymentType.UNKNOWN)


def map_seniority(value: object) -> Seniority:
    normalized = " ".join(string_list(value)).casefold()
    checks = (
        ("principal", Seniority.PRINCIPAL),
        ("staff", Seniority.STAFF),
        ("director", Seniority.DIRECTOR),
        ("executive", Seniority.EXECUTIVE),
        ("manager", Seniority.MANAGER),
        ("lead", Seniority.LEAD),
        ("senior", Seniority.SENIOR),
        ("mid", Seniority.MIDDLE),
        ("middle", Seniority.MIDDLE),
        ("junior", Seniority.JUNIOR),
        ("entry", Seniority.JUNIOR),
        ("intern", Seniority.INTERN),
    )
    return next(
        (seniority for token, seniority in checks if token in normalized), Seniority.UNKNOWN
    )


def map_salary_period(value: object) -> SalaryPeriod:
    normalized = slugify(optional_str(value) or "")
    mapping = {
        "hour": SalaryPeriod.HOUR,
        "hourly": SalaryPeriod.HOUR,
        "day": SalaryPeriod.DAY,
        "daily": SalaryPeriod.DAY,
        "week": SalaryPeriod.WEEK,
        "weekly": SalaryPeriod.WEEK,
        "fortnightly": SalaryPeriod.WEEK,
        "month": SalaryPeriod.MONTH,
        "monthly": SalaryPeriod.MONTH,
        "annual": SalaryPeriod.YEAR,
        "annually": SalaryPeriod.YEAR,
        "1-year": SalaryPeriod.YEAR,
        "year": SalaryPeriod.YEAR,
        "yearly": SalaryPeriod.YEAR,
    }
    return mapping.get(normalized, SalaryPeriod.UNKNOWN)


def map_remote_type(value: object) -> RemoteType:
    normalized = slugify(optional_str(value) or "")
    if normalized in {"remote", "telecommute", "telecommuting"}:
        return RemoteType.REMOTE
    if normalized in {"hybrid", "flexible"}:
        return RemoteType.HYBRID
    if normalized in {"on-site", "onsite", "office"}:
        return RemoteType.ONSITE
    return RemoteType.UNKNOWN
