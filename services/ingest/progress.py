from __future__ import annotations

import sys
from collections.abc import Callable
from threading import Event, Lock, Thread
from time import monotonic
from typing import TextIO


def format_progress_line(
    *,
    label: str,
    status: str,
    processed: int,
    total: int | None,
    elapsed_seconds: float,
) -> str:
    safe_elapsed = max(elapsed_seconds, 0.001)
    rps = processed / safe_elapsed
    if total is None:
        total_text = "?"
        eta_text = "unknown"
    else:
        total_text = str(total)
        remaining = max(total - processed, 0)
        eta_text = _format_duration(remaining / rps) if rps > 0 else "unknown"
    return (
        f"progress label={label} status={status} processed={processed} "
        f"total={total_text} rps={rps:.2f} eta={eta_text}"
    )


class ProgressReporter:
    """Emit progress to stderr on a wall-clock interval, even during blocking work."""

    def __init__(
        self,
        label: str,
        *,
        total: int | None = None,
        interval_seconds: float = 10.0,
        output: TextIO | None = None,
        clock: Callable[[], float] = monotonic,
    ) -> None:
        if interval_seconds <= 0:
            raise ValueError("progress interval must be positive")
        self._label = label
        self._total = total
        self._interval_seconds = interval_seconds
        self._output = output or sys.stderr
        self._clock = clock
        self._processed = 0
        self._started_at = 0.0
        self._lock = Lock()
        self._stop = Event()
        self._thread: Thread | None = None

    def __enter__(self) -> ProgressReporter:
        self._started_at = self._clock()
        self._thread = Thread(
            target=self._run,
            name=f"progress-{self._label}",
            daemon=True,
        )
        self._thread.start()
        return self

    def __exit__(self, exc_type: object, exc: object, traceback: object) -> None:
        del exc, traceback
        self.close(status="failed" if exc_type is not None else "done")

    def update(self, processed: int, *, total: int | None = None) -> None:
        if processed < 0:
            raise ValueError("processed count cannot be negative")
        with self._lock:
            self._processed = processed
            if total is not None:
                self._total = total

    def close(self, *, status: str = "done") -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=self._interval_seconds)
            self._thread = None
        self._emit(status=status)

    def _run(self) -> None:
        while not self._stop.wait(self._interval_seconds):
            self._emit(status="running")

    def _emit(self, *, status: str) -> None:
        with self._lock:
            processed = self._processed
            total = self._total
        line = format_progress_line(
            label=self._label,
            status=status,
            processed=processed,
            total=total,
            elapsed_seconds=self._clock() - self._started_at,
        )
        self._output.write(f"{line}\n")
        self._output.flush()


def _format_duration(seconds: float) -> str:
    rounded = max(int(seconds), 0)
    hours, remainder = divmod(rounded, 3600)
    minutes, secs = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"
