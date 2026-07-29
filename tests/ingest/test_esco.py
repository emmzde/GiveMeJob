import json
from pathlib import Path

from services.ingest.skills.esco import (
    ESCOClient,
    load_canonical_overrides,
    load_skill_queries,
)


def test_esco_search_resolves_english_canonical_skill() -> None:
    payload = json.loads(
        Path("tests/fixtures/connectors/esco_python.json").read_text(encoding="utf-8")
    )
    skill = ESCOClient.parse_search(
        payload,
        "Python",
        ["python"],
    )

    assert skill.name == "Python (computer programming)"
    assert skill.esco_uri.endswith("ccd0a1d9-afda-43d9-b901-96344886e14d")
    assert skill.aliases == ["Python", "python"]


def test_skill_query_catalog_is_broad_enough_for_it_vertical() -> None:
    queries = load_skill_queries(Path("config/esco_skill_queries.json"))
    overrides = load_canonical_overrides(Path("config/esco_canonical_overrides.json"))

    assert len(queries) >= 80
    assert {"Python", "React", "PostgreSQL", "machine learning"} <= set(queries)
    assert overrides["Docker"] == "manage ICT virtualisation environments"
