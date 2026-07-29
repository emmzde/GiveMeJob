from fastapi.testclient import TestClient

from services.api.main import create_app


def test_health_returns_service_metadata() -> None:
    with TestClient(create_app()) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "givemejob-api",
        "version": "0.1.0",
    }
