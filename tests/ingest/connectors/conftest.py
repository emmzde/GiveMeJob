import json
from collections.abc import Callable
from pathlib import Path

import pytest


@pytest.fixture
def load_connector_fixture() -> Callable[[str], object]:
    fixture_root = Path(__file__).parents[2] / "fixtures" / "connectors"

    def load(name: str) -> object:
        return json.loads((fixture_root / f"{name}.json").read_text(encoding="utf-8"))

    return load
