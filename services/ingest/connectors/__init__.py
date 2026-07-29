"""Phase 1 ingestion source connectors."""

from services.ingest.connectors.adzuna import AdzunaConnector
from services.ingest.connectors.arbeitnow import ArbeitnowConnector
from services.ingest.connectors.ashby import AshbyConnector
from services.ingest.connectors.base import Connector
from services.ingest.connectors.greenhouse import GreenhouseConnector
from services.ingest.connectors.hh import HHConnector
from services.ingest.connectors.himalayas import HimalayasConnector
from services.ingest.connectors.jobicy import JobicyConnector
from services.ingest.connectors.jooble import JoobleConnector
from services.ingest.connectors.lever import LeverConnector
from services.ingest.connectors.remotive import RemotiveConnector
from services.ingest.connectors.workable import WorkableConnector

__all__ = [
    "AdzunaConnector",
    "ArbeitnowConnector",
    "AshbyConnector",
    "Connector",
    "GreenhouseConnector",
    "HHConnector",
    "HimalayasConnector",
    "JobicyConnector",
    "JoobleConnector",
    "LeverConnector",
    "RemotiveConnector",
    "WorkableConnector",
]
