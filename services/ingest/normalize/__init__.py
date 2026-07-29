"""Normalization pipeline is introduced in Phase 1."""

from services.ingest.normalize.models import NormalizedJob
from services.ingest.normalize.pipeline import JobNormalizer
from services.ingest.normalize.salary import NormalizedSalary, SalaryNormalizer
from services.ingest.normalize.skills import SkillDefinition, SkillMatch, SkillMatcher

__all__ = [
    "JobNormalizer",
    "NormalizedJob",
    "NormalizedSalary",
    "SalaryNormalizer",
    "SkillDefinition",
    "SkillMatch",
    "SkillMatcher",
]
