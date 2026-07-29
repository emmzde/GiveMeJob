from io import StringIO

from services.ingest.progress import ProgressReporter, format_progress_line


def test_format_progress_line_includes_rps_and_eta() -> None:
    line = format_progress_line(
        label="himalayas",
        status="running",
        processed=300,
        total=900,
        elapsed_seconds=1.0,
    )

    assert line == (
        "progress label=himalayas status=running processed=300 total=900 rps=300.00 eta=00:00:02"
    )


def test_progress_reporter_emits_final_unknown_total() -> None:
    output = StringIO()
    timestamps = iter([10.0, 12.0])
    reporter = ProgressReporter(
        "ats",
        output=output,
        interval_seconds=60.0,
        clock=lambda: next(timestamps),
    )

    with reporter:
        reporter.update(20)

    assert output.getvalue() == (
        "progress label=ats status=done processed=20 total=? rps=10.00 eta=unknown\n"
    )
