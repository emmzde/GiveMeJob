from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from services.ingest.connectors._utils import object_list, optional_str, parse_decimal
from services.ingest.http import PoliteHttpClient
from services.ingest.models import RequestSpec


class ExchangeRateSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: str = Field(min_length=1)
    rates_to_usd: dict[str, Decimal]


class ExchangeRateClient:
    endpoint = "https://api.frankfurter.dev/v2/rates"
    requests_per_second = 0.1

    def __init__(self, http: PoliteHttpClient) -> None:
        self._http = http

    async def latest_to_usd(self) -> ExchangeRateSnapshot:
        payload = await self._http.request_json(
            RequestSpec(url=self.endpoint, params={"base": "USD"}),
            requests_per_second=self.requests_per_second,
        )
        return self.parse_rates(payload)

    @staticmethod
    def parse_rates(payload: object) -> ExchangeRateSnapshot:
        rates_to_usd: dict[str, Decimal] = {"USD": Decimal(1)}
        date: str | None = None
        for item in object_list(payload, context="Frankfurter rates"):
            base = optional_str(item.get("base"))
            quote = optional_str(item.get("quote"))
            rate = parse_decimal(item.get("rate"))
            item_date = optional_str(item.get("date"))
            if base != "USD" or quote is None or rate is None or rate <= 0:
                continue
            rates_to_usd[quote.upper()] = Decimal(1) / rate
            date = date or item_date
        if date is None:
            raise ValueError("Frankfurter returned no USD exchange rates")
        return ExchangeRateSnapshot(date=date, rates_to_usd=rates_to_usd)
