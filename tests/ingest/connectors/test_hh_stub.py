import pytest

from services.ingest.connectors.hh import HHConnector, HHDeveloperAgreementRequiredError


def test_hh_connector_stays_disabled_until_agreement() -> None:
    connector = HHConnector()

    assert connector.enabled is False
    with pytest.raises(HHDeveloperAgreementRequiredError, match="Developer Agreement"):
        connector.build_request(None)
