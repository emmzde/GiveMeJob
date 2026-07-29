from datetime import UTC, datetime
from decimal import Decimal

from services.ingest.models import ConnectorJob, RemoteType, SalaryPeriod, Seniority
from services.ingest.normalize.pipeline import JobNormalizer
from services.ingest.normalize.salary import SalaryNormalizer
from services.ingest.normalize.skills import SkillDefinition, SkillMatcher


def test_normalizes_job_without_network_or_llm() -> None:
    matcher = SkillMatcher(
        [
            SkillDefinition(
                esco_uri="http://data.europa.eu/esco/skill/python-example",
                name="Python (computer programming)",
                aliases=["Python"],
            ),
            SkillDefinition(
                esco_uri="http://data.europa.eu/esco/skill/postgresql-example",
                name="PostgreSQL",
                aliases=["PostgreSQL", "Postgres"],
            ),
        ]
    )
    normalizer = JobNormalizer(
        matcher,
        SalaryNormalizer({"EUR": Decimal("1.10")}),
    )
    source = ConnectorJob(
        source="greenhouse",
        source_job_id="example:1",
        source_url="https://boards.greenhouse.io/example/jobs/1",
        attribution="Example via Greenhouse",
        title="Senior Python Engineer",
        company_name="Example",
        description_html=(
            "<h2>Requirements</h2><p>At least 5 years of experience with Python and PostgreSQL.</p>"
        ),
        location="Berlin, Germany",
        remote_type=RemoteType.HYBRID,
        salary_text="€80k - €100k per year",
        posted_at=datetime(2026, 7, 28, tzinfo=UTC),
    )

    result = normalizer.normalize(source)

    assert result.title_normalized == "senior python engineer"
    assert result.country == "DE"
    assert result.city == "Berlin"
    assert result.seniority is Seniority.SENIOR
    assert result.min_years_exp == 5
    assert result.salary_min == Decimal(80000)
    assert result.salary_max == Decimal(100000)
    assert result.salary_currency == "EUR"
    assert result.salary_period is SalaryPeriod.YEAR
    assert result.salary_usd_year == Decimal("99000.00")
    assert {skill.name for skill in result.skills} == {
        "Python (computer programming)",
        "PostgreSQL",
    }
    assert result.blocking_key == "example\x1fsenior python engineer\x1fde\x1fberlin"
    assert -(1 << 63) <= result.simhash < 1 << 63
    assert result.quality_score == 0.85
