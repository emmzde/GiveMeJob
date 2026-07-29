from __future__ import annotations

from pydantic import BaseModel, ConfigDict

_COUNTRY_ALIASES = {
    "azerbaijan": "AZ",
    "canada": "CA",
    "france": "FR",
    "germany": "DE",
    "india": "IN",
    "poland": "PL",
    "russia": "RU",
    "spain": "ES",
    "turkey": "TR",
    "united arab emirates": "AE",
    "united kingdom": "GB",
    "uk": "GB",
    "united states": "US",
    "usa": "US",
}
_REMOTE_ONLY = {"remote", "worldwide", "anywhere", "global"}


class NormalizedLocation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    country: str | None = None
    city: str | None = None


def normalize_location(value: str | None) -> NormalizedLocation:
    if not value:
        return NormalizedLocation()
    parts = [part.strip() for part in value.split(",") if part.strip()]
    useful_parts = [part for part in parts if part.casefold() not in _REMOTE_ONLY]
    if not useful_parts:
        return NormalizedLocation()

    country: str | None = None
    country_index: int | None = None
    for index in range(len(useful_parts) - 1, -1, -1):
        candidate = useful_parts[index].casefold()
        if candidate in _COUNTRY_ALIASES:
            country = _COUNTRY_ALIASES[candidate]
            country_index = index
            break
    city = useful_parts[0] if useful_parts and country_index != 0 else None
    return NormalizedLocation(country=country, city=city)
