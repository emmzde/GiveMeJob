from collections.abc import Callable

import pytest

from services.ingest.connectors.jooble import JoobleConnector
from services.ingest.models import EmploymentType, RemoteType, Seniority


@pytest.mark.contract
def test_jooble_contract(load_connector_fixture: Callable[[str], object]) -> None:
    connector = JoobleConnector(api_key="fixture-key")
    request = connector.build_request(None)
    page = connector.parse_page(load_connector_fixture("jooble"))

    assert request.method == "POST"
    assert "fixture-key" in request.url
    assert request.redacted_url == "https://jooble.org/api/[REDACTED]"
    assert page.total_hint == 51
    assert page.next_cursor == "2"

    job = page.jobs[0]
    assert job.source_job_id == "1234567890"
    assert job.attribution == "Jooble"
    assert job.source_url.startswith("https://jooble.org/jdp/")
    assert job.remote_type is RemoteType.REMOTE
    assert job.employment_type is EmploymentType.FULL_TIME
    assert job.seniority is Seniority.MIDDLE
    assert job.salary_text == "4000 - 6000 USD"
