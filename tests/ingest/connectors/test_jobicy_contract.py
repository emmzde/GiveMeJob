from collections.abc import Callable
from decimal import Decimal

import pytest

from services.ingest.connectors.jobicy import JobicyConnector
from services.ingest.models import EmploymentType, RemoteType, SalaryPeriod, Seniority


@pytest.mark.contract
def test_jobicy_contract(load_connector_fixture: Callable[[str], object]) -> None:
    connector = JobicyConnector()
    request = connector.build_request(None)
    page = connector.parse_page(load_connector_fixture("jobicy"))

    assert request.params == {"count": 50}
    assert page.total_hint == 1
    assert page.next_cursor is None
    assert len(page.jobs) == 1

    job = page.jobs[0]
    assert job.source_job_id == "149290"
    assert job.attribution == "Jobicy"
    assert job.source_url.startswith("https://jobicy.com/jobs/")
    assert job.remote_type is RemoteType.REMOTE
    assert job.employment_type is EmploymentType.FULL_TIME
    assert job.seniority is Seniority.SENIOR
    assert job.salary_min == Decimal(100000)
    assert job.salary_max == Decimal(140000)
    assert job.salary_period is SalaryPeriod.YEAR
