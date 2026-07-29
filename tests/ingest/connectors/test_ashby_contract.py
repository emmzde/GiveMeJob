from collections.abc import Callable
from decimal import Decimal

import pytest

from services.ingest.connectors.ashby import AshbyConnector
from services.ingest.models import EmploymentType, RemoteType, SalaryPeriod, Seniority


@pytest.mark.contract
def test_ashby_contract(load_connector_fixture: Callable[[str], object]) -> None:
    connector = AshbyConnector("example", "Example Cloud")
    request = connector.build_request(None)
    page = connector.parse_page(load_connector_fixture("ashby"))

    assert request.params == {"includeCompensation": "true"}
    assert page.total_hint == 1
    job = page.jobs[0]
    assert job.attribution == "Example Cloud via Ashby"
    assert job.remote_type is RemoteType.REMOTE
    assert job.employment_type is EmploymentType.FULL_TIME
    assert job.seniority is Seniority.SENIOR
    assert job.salary_min == Decimal(150000)
    assert job.salary_max == Decimal(190000)
    assert job.salary_currency == "USD"
    assert job.salary_period is SalaryPeriod.YEAR
