from collections.abc import Callable
from decimal import Decimal

import pytest

from services.ingest.connectors.himalayas import HimalayasConnector
from services.ingest.models import EmploymentType, RemoteType, SalaryPeriod, Seniority


@pytest.mark.contract
def test_himalayas_contract(load_connector_fixture: Callable[[str], object]) -> None:
    connector = HimalayasConnector()
    request = connector.build_request(None)
    page = connector.parse_page(load_connector_fixture("himalayas"))

    assert connector.requests_per_second == 2.0
    assert request.params == {"offset": 0, "limit": 20}
    assert page.total_hint == 1
    assert page.next_cursor is None
    assert len(page.jobs) == 1

    job = page.jobs[0]
    assert job.source == "himalayas"
    assert job.attribution == "Himalayas"
    assert job.source_url.startswith("https://himalayas.app/")
    assert job.apply_url == job.source_url
    assert job.remote_type is RemoteType.REMOTE
    assert job.employment_type is EmploymentType.FULL_TIME
    assert job.seniority is Seniority.SENIOR
    assert job.salary_min == Decimal(120000)
    assert job.salary_max == Decimal(160000)
    assert job.salary_currency == "USD"
    assert job.salary_period is SalaryPeriod.YEAR
    assert job.posted_at is not None and job.posted_at.tzinfo is not None
