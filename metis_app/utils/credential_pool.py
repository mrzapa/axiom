"""metis_app.utils.credential_pool — Thread-safe API key pool with least-used rotation."""
from __future__ import annotations

import threading
import time
from typing import Sequence


class CredentialPool:
    """Manages a pool of API keys for a single provider.

    Strategy: least-used — always return the key with the lowest success_count.
    On a transient failure, the key is quarantined for an exponential backoff
    period and automatically re-admitted when the cooldown expires.
    On a permanent failure, the key is removed entirely.
    Thread-safe via a single Lock.
    """

    _MAX_QUARANTINE_SECS: int = 300

    def __init__(self, keys: Sequence[str]) -> None:
        self._lock = threading.Lock()
        self._pool: dict[str, int] = {k: 0 for k in keys if k}
        self._quarantine: dict[str, float] = {}
        self._failure_counts: dict[str, int] = {}

    def get_key(self) -> str:
        with self._lock:
            self._recheck_quarantine()
            if not self._pool:
                raise RuntimeError(
                    "No credential pool keys available. "
                    "Add more keys to 'credential_pool' in settings."
                )
            return min(self._pool, key=self._pool.__getitem__)

    def report_success(self, key: str) -> None:
        with self._lock:
            if key in self._pool:
                self._pool[key] += 1
            self._failure_counts.pop(key, None)

    def report_failure(self, key: str, *, permanent: bool = False) -> None:
        with self._lock:
            if permanent:
                self._pool.pop(key, None)
                self._quarantine.pop(key, None)
                self._failure_counts.pop(key, None)
            else:
                self._pool.pop(key, None)
                count = self._failure_counts.get(key, 0) + 1
                self._failure_counts[key] = count
                cooldown = min(self._MAX_QUARANTINE_SECS, 2 ** count)
                self._quarantine[key] = time.monotonic() + cooldown

    def active_count(self) -> int:
        with self._lock:
            self._recheck_quarantine()
            return len(self._pool)

    def quarantine_count(self) -> int:
        with self._lock:
            return len(self._quarantine)

    def _recheck_quarantine(self) -> None:
        """Re-admit quarantined keys whose cooldown has expired. Must hold lock."""
        now = time.monotonic()
        to_readmit = [k for k, t in self._quarantine.items() if now >= t]
        for k in to_readmit:
            del self._quarantine[k]
            self._pool[k] = 0
