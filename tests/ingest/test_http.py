import httpx
import pytest

from services.ingest.http import DomainRateLimiter, PoliteHttpClient, RetryPolicy
from services.ingest.models import RequestSpec


@pytest.mark.asyncio
async def test_http_client_retries_retryable_response() -> None:
    attempts = 0
    delays: list[float] = []

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(429, headers={"Retry-After": "0.25"}, request=request)
        return httpx.Response(200, json={"ok": True}, request=request)

    async def record_sleep(delay: float) -> None:
        delays.append(delay)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as transport_client:
        client = PoliteHttpClient(
            user_agent="GiveMeJobBot/0.1 (+https://example.com/bot)",
            client=transport_client,
            limiter=DomainRateLimiter(sleep=record_sleep),
            retry_policy=RetryPolicy(max_retries=1),
            sleep=record_sleep,
        )
        payload = await client.request_json(
            RequestSpec(url="https://api.example.com/jobs"),
            requests_per_second=2,
        )

    assert payload == {"ok": True}
    assert attempts == 2
    assert 0.25 in delays
