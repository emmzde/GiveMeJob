import pytest

from services.ingest.skills.esco import ESCOClient, ESCOResolutionError


def test_esco_search_rejects_unrelated_fuzzy_result() -> None:
    payload = {
        "_embedded": {
            "results": [
                {
                    "uri": "http://data.europa.eu/esco/skill/unrelated",
                    "title": "attend castings",
                }
            ]
        }
    }

    with pytest.raises(ESCOResolutionError, match="no exact English canonical"):
        ESCOClient.parse_search(payload, "Go", ["golang"])
