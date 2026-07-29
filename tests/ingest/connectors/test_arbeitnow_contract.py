from collections.abc import Callable

import pytest

from services.ingest.connectors.arbeitnow import ArbeitnowConnector
from services.ingest.models import EmploymentType, RemoteType


@pytest.mark.contract
def test_arbeitnow_contract(load_connector_fixture: Callable[[str], object]) -> None:
    connector = ArbeitnowConnector()
    request = connector.build_request("2")
    page = connector.parse_page(load_connector_fixture("arbeitnow"), cursor="1")

    assert request.params == {"page": 2}
    assert page.total_hint == 175
    assert page.next_cursor == "2"
    assert len(page.jobs) == 1

    job = page.jobs[0]
    assert job.source == "arbeitnow"
    assert job.attribution == "Arbeitnow"
    assert job.source_url.startswith("https://www.arbeitnow.com/jobs/")
    assert job.remote_type is RemoteType.REMOTE
    assert job.employment_type is EmploymentType.FULL_TIME
    assert job.tags == ["Python", "PostgreSQL", "full_time"]
    assert job.posted_at is not None and job.posted_at.tzinfo is not None
