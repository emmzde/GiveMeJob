from collections.abc import Callable

import pytest

from services.ingest.connectors.remotive import RemotiveConnector
from services.ingest.models import EmploymentType, RemoteType


@pytest.mark.contract
def test_remotive_contract(load_connector_fixture: Callable[[str], object]) -> None:
    connector = RemotiveConnector()
    page = connector.parse_page(load_connector_fixture("remotive"))

    assert page.total_hint == 1
    assert page.next_cursor is None
    assert len(page.jobs) == 1

    job = page.jobs[0]
    assert job.source_job_id == "2090903"
    assert job.attribution == "Remotive"
    assert job.source_url.startswith("https://remotive.com/remote-jobs/")
    assert job.remote_type is RemoteType.REMOTE
    assert job.employment_type is EmploymentType.FULL_TIME
    assert job.salary_text == "$120k - $160k/year"
    assert job.tags == ["Python", "Kubernetes", "Software Development"]
