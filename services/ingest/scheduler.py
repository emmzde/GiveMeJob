from __future__ import annotations

import asyncio
from datetime import timedelta

from celery import Celery

from services.api.config import get_settings
from services.ingest.cli import run_ats, run_public
from services.ingest.pipeline import PERSISTENCE_BATCH_MIN

settings = get_settings()

celery_app = Celery(
    "givemejob-ingest",
    broker=settings.redis_url,
    backend=settings.redis_url,
)
celery_app.conf.update(
    timezone="UTC",
    enable_utc=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    beat_schedule={
        "himalayas-daily": {
            "task": "ingest.public",
            "schedule": timedelta(hours=24),
            "args": ("himalayas",),
        },
        "arbeitnow-six-hourly": {
            "task": "ingest.public",
            "schedule": timedelta(hours=6),
            "args": ("arbeitnow",),
        },
        "remotive-six-hourly": {
            "task": "ingest.public",
            "schedule": timedelta(hours=6),
            "args": ("remotive",),
        },
        "jobicy-six-hourly": {
            "task": "ingest.public",
            "schedule": timedelta(hours=6),
            "args": ("jobicy",),
        },
        "adzuna-six-hourly": {
            "task": "ingest.public",
            "schedule": timedelta(hours=6),
            "args": ("adzuna",),
        },
        "jooble-six-hourly": {
            "task": "ingest.public",
            "schedule": timedelta(hours=6),
            "args": ("jooble",),
        },
        "ats-eight-hourly": {
            "task": "ingest.ats",
            "schedule": timedelta(hours=8),
        },
    },
)


def run_public_task(connector: str) -> dict[str, object]:
    return asyncio.run(
        run_public(
            settings,
            name=connector,
            limit=None,
            embed=True,
            batch_size=PERSISTENCE_BATCH_MIN,
        )
    )


def run_ats_task() -> dict[str, object]:
    return asyncio.run(
        run_ats(
            settings,
            provider=None,
            limit_companies=None,
            embed=True,
            batch_size=PERSISTENCE_BATCH_MIN,
        )
    )


celery_app.task(name="ingest.public")(run_public_task)
celery_app.task(name="ingest.ats")(run_ats_task)
