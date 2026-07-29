from collections.abc import Callable
from decimal import Decimal

import pytest

from services.ingest.connectors.adzuna import AdzunaConnector
from services.ingest.models import EmploymentType, RemoteType, SalaryPeriod, Seniority


@pytest.mark.contract
def test_adzuna_contract(load_connector_fixture: Callable[[str], object]) -> None:
    connector = AdzunaConnector(app_id="fixture-id", app_key="fixture-key", country="gb")
    request = connector.build_request(None)
    page = connector.parse_page(load_connector_fixture("adzuna"))

    assert request.params["app_id"] == "fixture-id"
    assert request.params["app_key"] == "fixture-key"
    assert request.redacted_url is not None and "fixture-key" not in request.redacted_url
    assert page.total_hint == 51
    assert page.next_cursor == "2"

    job = page.jobs[0]
    assert job.source_job_id == "123456789"
    assert job.attribution == "Adzuna"
    assert job.source_url.startswith("https://www.adzuna.co.uk/")
    assert job.remote_type is RemoteType.REMOTE
    assert job.employment_type is EmploymentType.FULL_TIME
    assert job.seniority is Seniority.SENIOR
    assert job.salary_min == Decimal(70000)
    assert job.salary_max == Decimal(90000)
    assert job.salary_currency == "GBP"
    assert job.salary_period is SalaryPeriod.YEAR
