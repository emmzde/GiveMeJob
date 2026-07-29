from __future__ import annotations

from services.ingest.dedupe.simhash import company_blocking_key, simhash64
from services.ingest.models import ConnectorJob, Seniority
from services.ingest.normalize.location import normalize_location
from services.ingest.normalize.models import NormalizedJob
from services.ingest.normalize.salary import SalaryNormalizer
from services.ingest.normalize.seniority import extract_min_years, infer_seniority
from services.ingest.normalize.skills import SkillMatcher
from services.ingest.normalize.text import html_to_markdown, normalize_title


class JobNormalizer:
    def __init__(self, skill_matcher: SkillMatcher, salary_normalizer: SalaryNormalizer) -> None:
        self._skill_matcher = skill_matcher
        self._salary_normalizer = salary_normalizer

    def normalize(self, job: ConnectorJob) -> NormalizedJob:
        description_md = html_to_markdown(job.description_html)
        title_normalized = normalize_title(job.title)
        seniority = job.seniority
        if seniority is Seniority.UNKNOWN:
            seniority = infer_seniority(job.title, description_md)
        min_years = extract_min_years(description_md)
        salary = self._salary_normalizer.normalize(job)
        location = normalize_location(job.location)
        skills = self._skill_matcher.match(job.title, description_md)
        blocking_key = company_blocking_key(job.company_name)
        simhash = simhash64(f"{blocking_key} {title_normalized}")
        quality_score = self._quality_score(
            description_md=description_md,
            has_salary=salary.minimum is not None or salary.maximum is not None,
            has_posted_at=job.posted_at is not None,
            has_skills=bool(skills),
            is_direct_source=job.source in {"greenhouse", "lever", "ashby", "workable"},
        )

        return NormalizedJob(
            source=job,
            title_normalized=title_normalized,
            description_md=description_md,
            country=location.country,
            city=location.city,
            seniority=seniority,
            min_years_exp=min_years,
            salary_min=salary.minimum,
            salary_max=salary.maximum,
            salary_currency=salary.currency,
            salary_period=salary.period,
            salary_usd_year=salary.usd_year,
            skills=skills,
            simhash=simhash,
            blocking_key=blocking_key,
            quality_score=quality_score,
        )

    @staticmethod
    def _quality_score(
        *,
        description_md: str,
        has_salary: bool,
        has_posted_at: bool,
        has_skills: bool,
        is_direct_source: bool,
    ) -> float:
        score = 0.2
        score += 0.25 if len(description_md) >= 200 else 0.1 if description_md else 0
        score += 0.2 if has_salary else 0
        score += 0.1 if has_posted_at else 0
        score += 0.15 if has_skills else 0
        score += 0.1 if is_direct_source else 0
        return min(score, 1.0)
