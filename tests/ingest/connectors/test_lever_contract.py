from collections.abc import Callable
from decimal import Decimal

import pytest

from services.ingest.connectors.lever import LeverConnector
from services.ingest.models import EmploymentType, RemoteType, SalaryPeriod, Seniority


@pytest.mark.contract
def test_lever_contract(load_connector_fixture: Callable[[str], object]) -> None:
    connector = LeverConnector("example", "Example Cloud")
    request = connector.build_request(None)
    page = connector.parse_page(load_connector_fixture("lever"))

    assert request.params == {"mode": "json", "skip": 0, "limit": 100}
    assert page.next_cursor is None
    job = page.jobs[0]
    assert job.attribution == "Example Cloud via Lever"
    assert job.remote_type is RemoteType.REMOTE
    assert job.employment_type is EmploymentType.FULL_TIME
    assert job.seniority is Seniority.STAFF
    assert job.salary_min == Decimal(90000)
    assert job.salary_max == Decimal(120000)
    assert job.salary_currency == "EUR"
    assert job.salary_period is SalaryPeriod.YEAR
