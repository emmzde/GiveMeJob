from __future__ import annotations

from services.ingest.connectors.base import Connector
from services.ingest.models import ConnectorJob, ConnectorPage, RequestSpec


class HHDeveloperAgreementRequiredError(RuntimeError):
    """Raised until the hh.ru Developer Agreement has been signed."""


class HHConnector(Connector):
    name = "hh"
    enabled = False

    @staticmethod
    def _disabled() -> HHDeveloperAgreementRequiredError:
        return HHDeveloperAgreementRequiredError(
            "hh.ru connector is disabled until the Developer Agreement is signed"
        )

    def build_request(self, cursor: str | None) -> RequestSpec:
        del cursor
        raise self._disabled()

    def parse_page(self, payload: object, cursor: str | None = None) -> ConnectorPage:
        del payload, cursor
        raise self._disabled()

    def normalize(self, raw: dict[str, object]) -> ConnectorJob:
        del raw
        raise self._disabled()
