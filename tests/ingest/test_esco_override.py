from services.ingest.skills.esco import ESCOClient


def test_esco_override_accepts_audited_broader_canonical_label() -> None:
    payload = {
        "_embedded": {
            "results": [
                {
                    "uri": "http://data.europa.eu/esco/skill/virtualisation",
                    "title": "manage ICT virtualisation environments",
                },
                {
                    "uri": "http://data.europa.eu/esco/skill/unrelated",
                    "title": "operate dock",
                },
            ]
        }
    }

    skill = ESCOClient.parse_search(
        payload,
        "Docker",
        ["docker", "containers"],
        expected_title="manage ICT virtualisation environments",
    )

    assert skill.name == "manage ICT virtualisation environments"
    assert "docker" in skill.aliases
