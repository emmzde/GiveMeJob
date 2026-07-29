from collections.abc import Callable

import pytest

from services.ingest.connectors.workable import WorkableConnector
from services.ingest.models import EmploymentType, RemoteType, Seniority


@pytest.mark.contract
def test_workable_contract(load_connector_fixture: Callable[[str], object]) -> None:
    connector = WorkableConnector("example")
    request = connector.build_request(None)
    page = connector.parse_page(load_connector_fixture("workable"))

    assert request.params == {"details": "true"}
    assert page.total_hint == 1
    job = page.jobs[0]
    assert job.company_name == "Example Systems"
    assert job.attribution == "Example Systems via Workable"
    assert job.remote_type is RemoteType.UNKNOWN
    assert job.employment_type is EmploymentType.FULL_TIME
    assert job.seniority is Seniority.MIDDLE
    assert job.location == "Baku, Azerbaijan"
    assert job.source_url.startswith("https://apply.workable.com/")
