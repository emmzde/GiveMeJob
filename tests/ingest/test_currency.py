from decimal import Decimal

from services.ingest.normalize.currency import ExchangeRateClient


def test_exchange_rates_are_inverted_to_usd() -> None:
    snapshot = ExchangeRateClient.parse_rates(
        [
            {"date": "2026-07-29", "base": "USD", "quote": "EUR", "rate": 0.8},
            {"date": "2026-07-29", "base": "USD", "quote": "GBP", "rate": 0.75},
        ]
    )

    assert snapshot.date == "2026-07-29"
    assert snapshot.rates_to_usd["USD"] == Decimal(1)
    assert snapshot.rates_to_usd["EUR"] == Decimal("1.25")
