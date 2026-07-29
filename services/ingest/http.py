from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from urllib.parse import urlsplit

import httpx

from services.ingest.models import RequestSpec

Sleep = Callable[[float], Awaitable[None]]


class ConnectorRequestError(RuntimeError):
    """Raised after the shared HTTP client's retry budget is exhausted."""


@dataclass(frozen=True, slots=True)
class RetryPolicy:
    max_retries: int = 4
    base_delay_seconds: float = 0.5
    max_delay_seconds: float = 20.0


class DomainRateLimiter:
    """Cooperatively limits all requests sharing the same hostname."""

    def __init__(self, *, sleep: Sleep = asyncio.sleep) -> None:
        self._sleep = sleep
        self._locks: dict[str, asyncio.Lock] = {}
        self._next_request_at: dict[str, float] = {}

    async def wait(self, url: str, requests_per_second: float) -> None:
        if requests_per_second <= 0:
            raise ValueError("requests_per_second must be positive")
        hostname = urlsplit(url).hostname
        if hostname is None:
            raise ValueError(f"request URL has no hostname: {url}")

        lock = self._locks.setdefault(hostname, asyncio.Lock())
        interval = 1.0 / requests_per_second
        loop = asyncio.get_running_loop()
        async with lock:
            now = loop.time()
            scheduled = self._next_request_at.get(hostname, now)
            if scheduled > now:
                await self._sleep(scheduled - now)
                now = loop.time()
            self._next_request_at[hostname] = max(now, scheduled) + interval


class PoliteHttpClient:
    """The only HTTP path used by connectors: timeout, rate limit, retry, User-Agent."""

    RETRYABLE_STATUS_CODES = frozenset({429, 500, 502, 503, 504})

    def __init__(
        self,
        *,
        user_agent: str,
        retry_policy: RetryPolicy | None = None,
        client: httpx.AsyncClient | None = None,
        limiter: DomainRateLimiter | None = None,
        sleep: Sleep = asyncio.sleep,
    ) -> None:
        if not user_agent.strip():
            raise ValueError("a truthful User-Agent is required")
        self._retry_policy = retry_policy or RetryPolicy()
        self._sleep = sleep
        self._limiter = limiter or DomainRateLimiter(sleep=sleep)
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(
            headers={"User-Agent": user_agent, "Accept": "application/json"},
            follow_redirects=True,
            timeout=httpx.Timeout(connect=10.0, read=30.0, write=15.0, pool=5.0),
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )

    async def __aenter__(self) -> PoliteHttpClient:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: object,
    ) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def request_json(
        self,
        request: RequestSpec,
        *,
        requests_per_second: float,
    ) -> object:
        last_error: Exception | None = None
        attempts = self._retry_policy.max_retries + 1
        safe_url = request.redacted_url or request.url

        for attempt in range(attempts):
            await self._limiter.wait(request.url, requests_per_second)
            try:
                response = await self._client.request(
                    request.method,
                    request.url,
                    params=request.params,
                    json=request.json_body,
                    headers=request.headers or None,
                )
                if response.status_code in self.RETRYABLE_STATUS_CODES:
                    if attempt == attempts - 1:
                        response.raise_for_status()
                    await self._sleep(self._retry_delay(attempt, response))
                    continue
                response.raise_for_status()
                payload: object = response.json()
                return payload
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                last_error = exc
                if attempt == attempts - 1:
                    break
                await self._sleep(self._retry_delay(attempt, None))
            except httpx.HTTPStatusError as exc:
                raise ConnectorRequestError(
                    f"{request.method} {safe_url} returned {exc.response.status_code}"
                ) from exc

        raise ConnectorRequestError(
            f"{request.method} {safe_url} failed after {attempts} attempts"
        ) from last_error

    def _retry_delay(self, attempt: int, response: httpx.Response | None) -> float:
        retry_after = self._retry_after_seconds(response)
        if retry_after is not None:
            return min(retry_after, self._retry_policy.max_delay_seconds)
        exponential = self._retry_policy.base_delay_seconds * (2.0**attempt)
        return min(exponential, self._retry_policy.max_delay_seconds)

    @staticmethod
    def _retry_after_seconds(response: httpx.Response | None) -> float | None:
        if response is None:
            return None
        value = response.headers.get("Retry-After")
        if not value:
            return None
        try:
            return max(float(value), 0.0)
        except ValueError:
            try:
                parsed = parsedate_to_datetime(value)
            except (TypeError, ValueError):
                return None
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=UTC)
            return max((parsed - datetime.now(UTC)).total_seconds(), 0.0)
