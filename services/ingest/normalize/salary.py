from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation

from pydantic import BaseModel, ConfigDict

from services.ingest.models import ConnectorJob, SalaryPeriod

_NUMBER_RE = re.compile(r"(?<![\w])(?P<number>\d+(?:[.,]\d+)?)\s*(?P<suffix>[kKmM]?)(?![\w])")
_CURRENCY_CODES = re.compile(r"\b([A-Z]{3})\b")
_SYMBOL_CURRENCIES = {
    "$": "USD",
    "€": "EUR",
    "£": "GBP",
    "₽": "RUB",
    "₹": "INR",
    "₺": "TRY",
}
_PERIOD_FACTORS = {
    SalaryPeriod.HOUR: Decimal(2080),
    SalaryPeriod.DAY: Decimal(260),
    SalaryPeriod.WEEK: Decimal(52),
    SalaryPeriod.MONTH: Decimal(12),
    SalaryPeriod.YEAR: Decimal(1),
}


class NormalizedSalary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    minimum: Decimal | None = None
    maximum: Decimal | None = None
    currency: str | None = None
    period: SalaryPeriod = SalaryPeriod.UNKNOWN
    usd_year: Decimal | None = None


class SalaryNormalizer:
    """Parse source salaries and convert their midpoint to annual USD."""

    def __init__(self, rates_to_usd: dict[str, Decimal] | None = None) -> None:
        self._rates_to_usd = {"USD": Decimal(1), **(rates_to_usd or {})}

    def normalize(self, job: ConnectorJob) -> NormalizedSalary:
        minimum = job.salary_min
        maximum = job.salary_max
        currency = job.salary_currency
        period = job.salary_period

        if minimum is None and maximum is None and job.salary_text:
            minimum, maximum = self._parse_numbers(job.salary_text)
            currency = currency or self._parse_currency(job.salary_text)
            if period is SalaryPeriod.UNKNOWN:
                period = self._parse_period(job.salary_text)

        if minimum is not None and maximum is None:
            maximum = minimum
        if maximum is not None and minimum is None:
            minimum = maximum

        usd_year: Decimal | None = None
        rate = self._rates_to_usd.get(currency or "")
        factor = _PERIOD_FACTORS.get(period)
        if minimum is not None and maximum is not None and rate is not None and factor:
            usd_year = ((minimum + maximum) / 2 * rate * factor).quantize(Decimal("0.01"))

        return NormalizedSalary(
            minimum=minimum,
            maximum=maximum,
            currency=currency,
            period=period,
            usd_year=usd_year,
        )

    @staticmethod
    def _parse_numbers(text: str) -> tuple[Decimal | None, Decimal | None]:
        values: list[Decimal] = []
        for match in _NUMBER_RE.finditer(text):
            try:
                value = Decimal(match.group("number").replace(",", "."))
            except InvalidOperation:
                continue
            suffix = match.group("suffix").casefold()
            if suffix == "k":
                value *= 1_000
            elif suffix == "m":
                value *= 1_000_000
            values.append(value)
            if len(values) == 2:
                break
        if not values:
            return None, None
        return (values[0], values[-1])

    @staticmethod
    def _parse_currency(text: str) -> str | None:
        for symbol, code in _SYMBOL_CURRENCIES.items():
            if symbol in text:
                return code
        match = _CURRENCY_CODES.search(text.upper())
        return match.group(1) if match else None

    @staticmethod
    def _parse_period(text: str) -> SalaryPeriod:
        normalized = text.casefold()
        if re.search(r"\b(hour|hourly|hr)\b", normalized):
            return SalaryPeriod.HOUR
        if re.search(r"\b(day|daily)\b", normalized):
            return SalaryPeriod.DAY
        if re.search(r"\b(week|weekly)\b", normalized):
            return SalaryPeriod.WEEK
        if re.search(r"\b(month|monthly|mo)\b", normalized):
            return SalaryPeriod.MONTH
        if re.search(r"\b(year|yearly|annual|annually|yr)\b", normalized):
            return SalaryPeriod.YEAR
        return SalaryPeriod.UNKNOWN
