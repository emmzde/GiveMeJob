import json
from pathlib import Path
from typing import Any

from services.api.config import Settings


def test_product_scope_defaults_match_decisions() -> None:
    settings = Settings(_env_file=None)

    assert settings.mvp_market == "remote-first-global-plus-cis"
    assert settings.mvp_vertical == "it-digital"
    assert settings.mvp_interface_locale == "ru"
    assert settings.mvp_index_languages == "multilingual"
    assert settings.skill_canonical_language == "en"
    assert settings.skill_taxonomy == "ESCO"
    assert settings.project_visibility == "private"


def test_machine_readable_product_config_matches_scope() -> None:
    product_config_path = Path(__file__).parents[2] / "config" / "product.json"
    data: dict[str, Any] = json.loads(product_config_path.read_text(encoding="utf-8"))

    assert data["market"] == {
        "strategy": "remote-first",
        "geographies": ["global-remote", "cis"],
        "vertical": "it-digital",
    }
    assert data["localization"]["uiDefaultLocale"] == "ru"
    assert data["localization"]["uiArchitecture"] == "i18n"
    assert data["localization"]["indexLanguages"] == "multilingual"
    assert data["skills"] == {"canonicalLanguage": "en", "taxonomy": "ESCO"}
    assert data["repository"]["visibility"] == "private"
