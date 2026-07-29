from __future__ import annotations

import json
from pathlib import Path

from pydantic import TypeAdapter

from services.ingest.connectors._utils import object_list, optional_str, require_object
from services.ingest.http import PoliteHttpClient
from services.ingest.models import RequestSpec
from services.ingest.normalize.skills import SkillDefinition

_QUERY_ADAPTER = TypeAdapter(dict[str, list[str]])


class ESCOResolutionError(ValueError):
    pass


class ESCOClient:
    endpoint = "https://ec.europa.eu/esco/api/search"
    requests_per_second = 1.0

    def __init__(self, http: PoliteHttpClient) -> None:
        self._http = http

    async def resolve(
        self,
        query: str,
        aliases: list[str],
        *,
        expected_title: str | None = None,
        selected_version: str = "v1.2.0",
    ) -> SkillDefinition:
        payload = await self._http.request_json(
            RequestSpec(
                url=self.endpoint,
                params={
                    "text": query,
                    "type": "skill",
                    "language": "en",
                    "full": "true",
                    "limit": 10,
                    "selectedVersion": selected_version,
                },
            ),
            requests_per_second=self.requests_per_second,
        )
        return self.parse_search(
            payload,
            query,
            aliases,
            expected_title=expected_title,
        )

    @staticmethod
    def parse_search(
        payload: object,
        query: str,
        aliases: list[str],
        *,
        expected_title: str | None = None,
    ) -> SkillDefinition:
        data = require_object(payload, context="ESCO response")
        embedded = require_object(data.get("_embedded") or {}, context="_embedded")
        results = object_list(embedded.get("results") or [], context="results")
        if not results:
            raise ESCOResolutionError(f"ESCO returned no skill for {query!r}")

        desired_title = expected_title or query
        desired_normalized = desired_title.casefold()

        def rank(item: dict[str, object]) -> tuple[int, int]:
            title = optional_str(item.get("title")) or ""
            title_normalized = title.casefold()
            exact = title_normalized == desired_normalized
            qualified = title_normalized.startswith(f"{desired_normalized} (")
            return (0 if exact else 1 if qualified else 2, len(title))

        match = min(results, key=rank)
        if rank(match)[0] == 2:
            raise ESCOResolutionError(
                f"ESCO returned no exact English canonical skill for {query!r}"
            )
        uri = optional_str(match.get("uri"))
        name = optional_str(match.get("title"))
        if uri is None or name is None:
            raise ESCOResolutionError(f"ESCO returned an incomplete skill for {query!r}")
        return SkillDefinition(
            esco_uri=uri,
            name=name,
            aliases=[query, *aliases],
        )


def load_skill_queries(path: Path) -> dict[str, list[str]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return _QUERY_ADAPTER.validate_python(payload)


def load_canonical_overrides(path: Path) -> dict[str, str]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return TypeAdapter(dict[str, str]).validate_python(payload)
