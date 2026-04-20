"""Audited ``urlopen`` wrapper for the M17 Network Audit panel.

Phase 3a landed :func:`audited_urlopen` — a stdlib-drop-in replacement
for :func:`urllib.request.urlopen` that classifies the destination,
records a :class:`NetworkAuditEvent`, consults the kill switch, and
either raises :class:`NetworkBlockedError` or calls through and
measures latency. The wrapper is the single seam the ten stdlib call
sites listed in ``plans/network-audit/plan.md`` Phase 3 will migrate
onto in Phase 3b.

**Design guarantees** (the panel's credibility rests on these):

- Audit-layer failures (store disk full, DB locked) NEVER crash the
  wrapped call. A failed ``store.append`` is logged at warning level
  and the outbound call proceeds. The audit panel losing a row is a
  smaller regression than the product breaking.
- The wrapper is stateless. The backing :class:`NetworkAuditStore`
  already serialises its writes under an internal lock.
- Query strings are never persisted. :func:`sanitize_url` strips them
  before the event is built; see ADR 0011.

**Known limitation (v1)**: ``size_bytes_in`` is always recorded as
``None``. ``urllib`` returns a lazily-read body and we do not wrap the
response file object here. A byte-accurate size hook is Phase 4+
concern — see ``plans/network-audit/plan.md`` Phase 4 for the
vendor-SDK invocation-layer alternative.
"""

from __future__ import annotations

import logging
import time
import urllib.request
from datetime import datetime, timezone
from typing import Any, Mapping

from metis_app.network_audit.events import NetworkAuditEvent, sanitize_url
from metis_app.network_audit.kill_switches import (
    AIRPLANE_MODE_KEY,
    PROVIDER_BLOCK_LLM_KEY,
    NetworkBlockedError,
    is_provider_blocked,
)
from metis_app.network_audit.providers import classify_host
from metis_app.network_audit.store import NetworkAuditStore, new_ulid

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _byte_len(body: Any) -> int | None:
    """Return ``len(body)`` if the body is a sized type; ``None`` otherwise.

    Request bodies may be bytes, bytearray, memoryview, str, or an
    iterable / file-like object per stdlib semantics. Only the sized
    forms have a knowable outbound size; for iterables we return
    ``None`` rather than consume them to measure.
    """
    if body is None:
        return None
    try:
        return len(body)
    except TypeError:
        return None


def _extract_call_metadata(
    url_or_req: str | urllib.request.Request,
    data: bytes | None,
) -> tuple[str, str, int | None]:
    """Return ``(url, method, size_bytes_out)`` for the call.

    For a bare string URL the method is ``"POST"`` if ``data`` is
    non-``None`` (matching stdlib ``urlopen(url, data=...)`` semantics,
    which promotes the request to POST), else ``"GET"``. Outbound size
    is ``len(data)`` when ``data`` is set.

    For a ``Request`` object ``get_method()`` returns the correctly
    uppercased verb, honouring an explicit ``method=`` kwarg and the
    implicit-POST-from-body rule. Outbound size resolves by the same
    rule ``urllib.request.urlopen`` applies: if the caller passes a
    ``data=`` kwarg it effectively replaces the Request's own body, so
    the kwarg wins; otherwise we fall back to ``Request.data``.
    """
    if isinstance(url_or_req, urllib.request.Request):
        if data is not None:
            size = _byte_len(data)
        else:
            size = _byte_len(url_or_req.data)
        return url_or_req.full_url, url_or_req.get_method(), size

    method = "POST" if data is not None else "GET"
    return str(url_or_req), method, _byte_len(data)


def _safe_append(store: NetworkAuditStore, event: NetworkAuditEvent) -> None:
    """Append ``event`` to ``store`` but swallow any exception.

    The audit panel's promise is "show everything we can"; a disk-full
    SQLite or a locked WAL file must never break the wrapped call.
    Failures are logged at warning level so they show up in the app's
    normal diagnostics without being fatal.
    """
    try:
        store.append(event)
    except Exception:  # noqa: BLE001 - intentional: audit must never crash caller
        logger.warning(
            "network_audit: failed to append event for provider=%s host=%s; "
            "wrapped call will still proceed",
            event.provider_key,
            event.url_host,
            exc_info=True,
        )


# ---------------------------------------------------------------------------
# Public wrapper
# ---------------------------------------------------------------------------


def audited_urlopen(
    url_or_req: str | urllib.request.Request,
    *,
    trigger_feature: str,
    user_initiated: bool,
    data: bytes | None = None,
    timeout: float | None = None,
    store: NetworkAuditStore | None = None,
    settings: Mapping[str, Any] | None = None,
) -> Any:
    """Stdlib-drop-in replacement for :func:`urllib.request.urlopen` with audit hooks.

    Semantics preserved: same positional signature extended with
    keyword-only audit metadata. Returns the same object
    :func:`urllib.request.urlopen` returns (an
    :class:`http.client.HTTPResponse`-like context manager).

    Behaviour on each call:

    1. Extract the URL and HTTP method from ``url_or_req`` (accepts
       either a bare URL string or a pre-built
       :class:`urllib.request.Request`).
    2. Sanitise to ``(host, path_prefix)`` via :func:`sanitize_url` —
       query strings and fragments are dropped here, never persisted.
    3. Classify the host into a provider via :func:`classify_host`.
       Unknown hosts resolve to the ``unclassified`` entry and are
       still recorded (but never kill-switch-blocked by this layer).
    4. Consult :func:`is_provider_blocked`. On block: record an event
       with ``blocked=True`` and raise :class:`NetworkBlockedError`.
    5. Otherwise: record the start time, call through to
       :func:`urllib.request.urlopen`, measure wall-clock latency,
       and emit an event with ``blocked=False`` plus the observed
       ``status_code`` and ``latency_ms``.
    6. Return the response object. ``size_bytes_in`` is always
       ``None`` in v1 — see the module docstring for why.

    Arguments:
        url_or_req: A URL string or a :class:`urllib.request.Request`.
        trigger_feature: Free-form feature tag the caller declares so
            the panel can group events (e.g. ``"news_comet_worker"``,
            ``"autonomous_research"``). Required.
        user_initiated: ``True`` iff a human action in the current
            session directly caused this call. Required.
        data: Optional POST body. Passed straight to ``urlopen``.
        timeout: Optional request timeout in seconds. Passed straight
            to ``urlopen`` when supplied; no synthesised default.
        store: :class:`NetworkAuditStore` to record the event into.
            ``None`` disables recording (useful in isolated unit
            tests; production wires a singleton).
        settings: Mapping of settings.json-style keys to values,
            consulted by :func:`is_provider_blocked`. ``None`` is
            treated as an empty mapping (no kill switches active).

    Raises:
        NetworkBlockedError: If the destination provider is currently
            blocked by :func:`is_provider_blocked`.
    """
    url, method, size_bytes_out = _extract_call_metadata(url_or_req, data)
    host, path_prefix = sanitize_url(url)
    spec = classify_host(host)
    provider_key = spec.key

    effective_settings: Mapping[str, Any] = settings if settings is not None else {}

    # --- Block path -----------------------------------------------------
    if is_provider_blocked(provider_key, effective_settings):
        # Reason ordering mirrors ``is_provider_blocked``: airplane mode
        # is the master switch; the Phase 6 ``provider_block_llm`` map
        # is consulted next (it gates providers whose
        # ``kill_switch_setting_key`` is ``None`` — the old code would
        # render this path as ``"kill switch 'None' is disabled"``,
        # which is both ugly and wrong); legacy per-feature kill-switch
        # setting keys are the fallthrough.
        if effective_settings.get(AIRPLANE_MODE_KEY) is True:
            reason = "airplane mode"
        else:
            provider_block_llm = effective_settings.get(PROVIDER_BLOCK_LLM_KEY)
            if (
                isinstance(provider_block_llm, dict)
                and provider_block_llm.get(provider_key) is True
            ):
                reason = "blocked by provider_block_llm map"
            else:
                reason = (
                    f"kill switch '{spec.kill_switch_setting_key}' is disabled"
                )
        if store is not None:
            _safe_append(
                store,
                NetworkAuditEvent(
                    id=new_ulid(),
                    timestamp=datetime.now(timezone.utc),
                    method=method,
                    url_host=host,
                    url_path_prefix=path_prefix,
                    query_params_stored=False,
                    provider_key=provider_key,
                    trigger_feature=trigger_feature,
                    size_bytes_in=None,
                    size_bytes_out=size_bytes_out,
                    latency_ms=None,
                    status_code=None,
                    user_initiated=user_initiated,
                    blocked=True,
                ),
            )
        raise NetworkBlockedError(provider_key, reason)

    # --- Pass-through path ---------------------------------------------
    # Build kwargs for urlopen so we only forward the ones the caller
    # actually set. urlopen's own defaults differ across Python
    # versions (notably the global socket timeout); don't override.
    kwargs: dict[str, Any] = {}
    if data is not None:
        kwargs["data"] = data
    if timeout is not None:
        kwargs["timeout"] = timeout

    start = time.perf_counter()
    status_code: int | None = None
    try:
        response = urllib.request.urlopen(url_or_req, **kwargs)  # noqa: S310 - wrapped
        # ``HTTPResponse`` exposes .status; some file-like responses
        # (e.g. file://) do not. Fall back to None in that case.
        status_code = getattr(response, "status", None)
        return response
    finally:
        latency_ms = int((time.perf_counter() - start) * 1000)
        if store is not None:
            _safe_append(
                store,
                NetworkAuditEvent(
                    id=new_ulid(),
                    timestamp=datetime.now(timezone.utc),
                    method=method,
                    url_host=host,
                    url_path_prefix=path_prefix,
                    query_params_stored=False,
                    provider_key=provider_key,
                    trigger_feature=trigger_feature,
                    size_bytes_in=None,
                    size_bytes_out=size_bytes_out,
                    latency_ms=latency_ms,
                    status_code=status_code,
                    user_initiated=user_initiated,
                    blocked=False,
                ),
            )


__all__ = [
    "audited_urlopen",
]
