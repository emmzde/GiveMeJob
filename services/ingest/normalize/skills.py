from __future__ import annotations

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SkillDefinition(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    esco_uri: str = Field(pattern=r"^https?://data\.europa\.eu/esco/skill/")
    name: str = Field(min_length=1)
    aliases: list[str] = Field(min_length=1)
    category: str = "digital"

    @field_validator("aliases")
    @classmethod
    def normalize_aliases(cls, aliases: list[str]) -> list[str]:
        unique: dict[str, None] = {}
        for alias in aliases:
            normalized = " ".join(alias.split()).strip()
            if normalized:
                unique.setdefault(normalized, None)
        if not unique:
            raise ValueError("at least one non-empty alias is required")
        return list(unique)


class SkillMatch(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    esco_uri: str
    name: str
    aliases: list[str]
    category: str
    requirement: str = "must_have"


class SkillMatcher:
    def __init__(self, definitions: list[SkillDefinition]) -> None:
        self._patterns = [
            (
                definition,
                re.compile(
                    "|".join(
                        self._alias_pattern(alias)
                        for alias in sorted(
                            definition.aliases,
                            key=len,
                            reverse=True,
                        )
                    ),
                    re.IGNORECASE,
                ),
            )
            for definition in definitions
        ]

    def match(self, title: str, description: str) -> list[SkillMatch]:
        text = f"{title}\n{description}"
        return [
            SkillMatch(
                esco_uri=definition.esco_uri,
                name=definition.name,
                aliases=definition.aliases,
                category=definition.category,
            )
            for definition, pattern in self._patterns
            if pattern.search(text)
        ]

    @staticmethod
    def _alias_pattern(alias: str) -> str:
        escaped = re.escape(alias)
        prefix = r"(?<!\w)" if alias[0].isalnum() else ""
        suffix = r"(?!\w)" if alias[-1].isalnum() else ""
        return f"{prefix}{escaped}{suffix}"
