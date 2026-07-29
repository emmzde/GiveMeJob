from datetime import timedelta

from services.ingest.scheduler import celery_app


def test_scheduler_respects_provider_polling_windows() -> None:
    schedule = celery_app.conf.beat_schedule

    assert schedule["remotive-six-hourly"]["schedule"] == timedelta(hours=6)
    assert schedule["ats-eight-hourly"]["schedule"] == timedelta(hours=8)
    assert schedule["himalayas-daily"]["schedule"] == timedelta(hours=24)
    assert all(
        entry["schedule"] >= timedelta(hours=6)
        for name, entry in schedule.items()
        if name != "himalayas-daily"
    )
