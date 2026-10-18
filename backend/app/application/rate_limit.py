"""Small process-local fixed-window limiter for expensive trip generation."""

from math import ceil
from threading import Lock
from time import monotonic


class RateLimited(Exception):
    def __init__(self, retry_after: int) -> None:
        self.retry_after = retry_after
        super().__init__("Too many trip requests. Try again shortly.")


class FixedWindowLimiter:
    def __init__(self) -> None:
        self._windows: dict[str, tuple[float, int]] = {}
        self._lock = Lock()

    def check(
        self, key: str, *, limit: int, window_seconds: int, now: float | None = None,
    ) -> int:
        current = monotonic() if now is None else now
        with self._lock:
            # Expired entries are removed on every request, so idle clients do
            # not leave permanent state behind.
            self._windows = {
                host: window for host, window in self._windows.items()
                if current - window[0] < window_seconds
            }
            start, count = self._windows.get(key, (current, 0))
            if count >= limit:
                return max(1, ceil(window_seconds - (current - start)))
            self._windows[key] = (start, count + 1)
            return 0

    def clear(self) -> None:
        with self._lock:
            self._windows.clear()
