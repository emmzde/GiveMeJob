from pathlib import Path

from services.ingest.connectors.ashby import AshbyConnector
from services.ingest.http import PoliteHttpClient
from services.ingest.registry import ATSProvider, connector_for, load_ats_registry


def test_ats_registry_has_required_coverage() -> None:
    registry = load_ats_registry(Path("config/ats_companies.json"))
    entries = list(registry.entries())

    assert registry.company_count >= 300
    assert 6 <= registry.poll_hours <= 12
    assert {entry.provider for entry in entries} == set(ATSProvider)
    assert len({(entry.provider, entry.company_slug) for entry in entries}) == len(entries)


def test_registry_entry_builds_its_connector() -> None:
    registry = load_ats_registry(Path("config/ats_companies.json"))
    ashby_entry = next(entry for entry in registry.entries() if entry.provider is ATSProvider.ASHBY)
    http = PoliteHttpClient(user_agent="GiveMeJobBot/test")

    connector = connector_for(ashby_entry, http)

    assert isinstance(connector, AshbyConnector)
    assert connector.company_slug == ashby_entry.company_slug
