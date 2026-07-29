from collections.abc import Callable

import pytest

from services.ingest.connectors.greenhouse import GreenhouseConnector
from services.ingest.models import RemoteType, Seniority


@pytest.mark.contract
def test_greenhouse_contract(load_connector_fixture: Callable[[str], object]) -> None:
    connector = GreenhouseConnector("example", "Example Cloud")
    request = connector.build_request(None)
    page = connector.parse_page(load_connector_fixture("greenhouse"))

    assert request.params == {"content": "true"}
    assert page.total_hint == 1
    assert page.next_cursor is None
    job = page.jobs[0]
    assert job.source == "greenhouse"
    assert job.attribution == "Example Cloud via Greenhouse"
    assert job.source_url == job.apply_url
    assert job.remote_type is RemoteType.REMOTE
    assert job.seniority is Seniority.SENIOR
    assert job.tags == ["Engineering", "Worldwide", "en"]
