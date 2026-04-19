"""Tests for ``metis_app.network_audit.client`` + ``.kill_switches`` (Phase 3a of M17).

Covers the :func:`audited_urlopen` wrapper's full contract: successful
pass-through, kill-switch blocking, airplane-mode master override,
unknown-host fallthrough, privacy (no query strings stored), latency
measurement, :class:`urllib.request.Request` object acceptance,
graceful degradation on store failure, and required-kwarg typing.

Also exercises :func:`is_provider_blocked` directly for the three
shapes of kill switch (boolean feature flag, string disabled sentinel,
airplane mode) and the unknown-provider fallthrough.

See ``plans/network-audit/plan.md`` Phase 3 and
``docs/adr/0010-network-audit-interception.md``.
"""

from __future__ import annotations

import io
import sqlite3
import time
import urllib.request
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

import pytest

from metis_app.network_audit import (
    NetworkAuditStore,
    NetworkBlockedError,
    audited_urlopen,
    is_provider_blocked,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def tmp_store(tmp_path: Path) -> NetworkAuditStore:
    """An ephemeral store pointed at a per-test SQLite file."""
    store = NetworkAuditStore(tmp_path / "audit.db")
    try:
        yield store
    finally:
        store.close()


def _fake_response(
    *,
    status: int = 200,
    body: bytes = b"{}",
    sleep_seconds: float = 0.0,
) -> Any:
    """Return a minimal urlopen-compatible stand-in.

    The object carries a ``status`` attribute (matches
    ``http.client.HTTPResponse``) and a ``.read()`` method. The
    optional ``sleep_seconds`` blocks inside the patched call so
    :func:`audited_urlopen`'s latency measurement can be exercised.
    """

    def _factory(*_args: Any, **_kwargs: Any) -> Any:
        if sleep_seconds:
            time.sleep(sleep_seconds)
        buf = io.BytesIO(body)
        # SimpleNamespace with a .read() that forwards to the buffer.
        return SimpleNamespace(
            status=status,
            read=buf.read,
            close=buf.close,
            __enter__=lambda _self: _self,
            __exit__=lambda *_args: None,
        )

    return _factory


# ---------------------------------------------------------------------------
# audited_urlopen — successful pass-through
# ---------------------------------------------------------------------------


def test_audited_urlopen_records_event_on_success(
    tmp_store: NetworkAuditStore,
) -> None:
    """Successful call records exactly one event with the classified provider."""
    with patch("urllib.request.urlopen", side_effect=_fake_response(status=200)):
        response = audited_urlopen(
            "https://api.openai.com/v1/chat/completions",
            trigger_feature="unit_test",
            user_initiated=True,
            store=tmp_store,
        )
        assert response.status == 200

    events = tmp_store.recent(limit=10)
    assert len(events) == 1
    event = events[0]
    assert event.provider_key == "openai"
    assert event.blocked is False
    assert event.user_initiated is True
    assert event.url_host == "api.openai.com"
    assert event.url_path_prefix == "/v1"
    assert event.method == "GET"
    assert event.status_code == 200
    assert event.trigger_feature == "unit_test"


# ---------------------------------------------------------------------------
# audited_urlopen — blocking paths
# ---------------------------------------------------------------------------


def test_audited_urlopen_blocks_when_kill_switch_set(
    tmp_store: NetworkAuditStore,
) -> None:
    """Reddit URL + ``news_comets_enabled=False`` raises and records a blocked event."""
    settings = {"news_comets_enabled": False}

    with patch("urllib.request.urlopen") as mock_urlopen:
        with pytest.raises(NetworkBlockedError) as exc_info:
            audited_urlopen(
                "https://www.reddit.com/r/test.json",
                trigger_feature="news_comet_worker",
                user_initiated=False,
                store=tmp_store,
                settings=settings,
            )
        mock_urlopen.assert_not_called()

    assert exc_info.value.provider_key == "reddit_api"
    assert "news_comets_enabled" in exc_info.value.reason

    events = tmp_store.recent(limit=10)
    assert len(events) == 1
    assert events[0].blocked is True
    assert events[0].provider_key == "reddit_api"
    assert events[0].latency_ms is None
    assert events[0].status_code is None


def test_audited_urlopen_airplane_mode_blocks_everything(
    tmp_store: NetworkAuditStore,
) -> None:
    """Airplane mode blocks even providers with no per-provider kill switch."""
    settings = {"network_audit_airplane_mode": True}

    with patch("urllib.request.urlopen") as mock_urlopen:
        with pytest.raises(NetworkBlockedError) as exc_info:
            audited_urlopen(
                "https://api.openai.com/v1/chat",
                trigger_feature="unit_test",
                user_initiated=True,
                store=tmp_store,
                settings=settings,
            )
        mock_urlopen.assert_not_called()

    assert exc_info.value.provider_key == "openai"
    assert "airplane mode" in exc_info.value.reason.lower()

    events = tmp_store.recent(limit=10)
    assert len(events) == 1
    assert events[0].blocked is True


# ---------------------------------------------------------------------------
# Unknown host fallthrough
# ---------------------------------------------------------------------------


def test_audited_urlopen_classifies_unknown_host_as_unclassified(
    tmp_store: NetworkAuditStore,
) -> None:
    """Unknown hosts resolve to ``unclassified`` and are not blocked."""
    with patch("urllib.request.urlopen", side_effect=_fake_response()):
        audited_urlopen(
            "https://example.com/",
            trigger_feature="unit_test",
            user_initiated=False,
            store=tmp_store,
        )

    events = tmp_store.recent(limit=10)
    assert len(events) == 1
    assert events[0].provider_key == "unclassified"
    assert events[0].blocked is False
    assert events[0].url_host == "example.com"


# ---------------------------------------------------------------------------
# Privacy — query strings are never persisted
# ---------------------------------------------------------------------------


def test_audited_urlopen_never_stores_query_params(
    tmp_path: Path,
    tmp_store: NetworkAuditStore,
) -> None:
    """Query strings and secrets never land in the event or the SQLite row."""
    secret_url = (
        "https://api.openai.com/v1/chat?api_key=SECRET_TOKEN&prompt=leaked_prompt"
    )
    with patch("urllib.request.urlopen", side_effect=_fake_response()):
        audited_urlopen(
            secret_url,
            trigger_feature="unit_test",
            user_initiated=True,
            store=tmp_store,
        )

    events = tmp_store.recent(limit=10)
    assert len(events) == 1
    event = events[0]
    assert event.url_path_prefix == "/v1"
    # No field on the event may contain any of the query-string fragments.
    for value in (
        event.url_host,
        event.url_path_prefix,
        event.trigger_feature,
        event.provider_key,
    ):
        assert "SECRET_TOKEN" not in value
        assert "api_key" not in value
        assert "leaked_prompt" not in value
        assert "prompt=" not in value

    # Belt-and-braces: inspect the raw SQLite row to make sure nothing
    # leaked into any column the audit layer controls.
    conn = sqlite3.connect(str(tmp_store.db_path))
    try:
        cursor = conn.execute("SELECT * FROM network_audit_events")
        rows = cursor.fetchall()
        assert len(rows) == 1
        serialised = " ".join(str(cell) for cell in rows[0])
        assert "SECRET_TOKEN" not in serialised
        assert "api_key" not in serialised
        assert "leaked_prompt" not in serialised
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Latency + Request-object handling
# ---------------------------------------------------------------------------


def test_audited_urlopen_latency_is_measured(
    tmp_store: NetworkAuditStore,
) -> None:
    """A 100 ms sleep in the underlying urlopen is observable in ``latency_ms``."""
    with patch(
        "urllib.request.urlopen",
        side_effect=_fake_response(sleep_seconds=0.1),
    ):
        audited_urlopen(
            "https://api.openai.com/v1/chat",
            trigger_feature="unit_test",
            user_initiated=True,
            store=tmp_store,
        )

    events = tmp_store.recent(limit=10)
    assert len(events) == 1
    # 50ms floor (not 90) to absorb Windows timer jitter and CI load
    # without losing the core "latency > 0" signal. Windows sleep
    # typically overshoots but rare undershoots on busy runners could
    # cross a tighter threshold.
    assert events[0].latency_ms is not None
    assert events[0].latency_ms >= 50


def test_audited_urlopen_accepts_request_object(
    tmp_store: NetworkAuditStore,
) -> None:
    """Passing a pre-built ``Request`` preserves the custom method + URL."""
    req = urllib.request.Request(
        "https://example.com/api/endpoint",
        data=b'{"ping": 1}',
        method="POST",
    )

    with patch("urllib.request.urlopen", side_effect=_fake_response(status=201)):
        audited_urlopen(
            req,
            trigger_feature="unit_test",
            user_initiated=False,
            store=tmp_store,
        )

    events = tmp_store.recent(limit=10)
    assert len(events) == 1
    assert events[0].method == "POST"
    assert events[0].url_host == "example.com"
    assert events[0].url_path_prefix == "/api"


# ---------------------------------------------------------------------------
# Graceful degradation on audit-layer failure
# ---------------------------------------------------------------------------


class _BrokenStore:
    """Minimal store stand-in whose ``append`` always raises."""

    def __init__(self) -> None:
        self.attempts = 0

    def append(self, event: Any) -> None:
        self.attempts += 1
        raise sqlite3.OperationalError("disk I/O error (simulated)")


def test_audited_urlopen_store_failure_does_not_crash_call(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A broken store logs a warning but does not break the wrapped call."""
    broken = _BrokenStore()
    with patch("urllib.request.urlopen", side_effect=_fake_response(status=200)):
        with caplog.at_level("WARNING", logger="metis_app.network_audit"):
            response = audited_urlopen(
                "https://api.openai.com/v1/chat",
                trigger_feature="unit_test",
                user_initiated=True,
                store=broken,  # type: ignore[arg-type]
            )
    assert response.status == 200
    assert broken.attempts == 1
    assert any(
        "failed to append event" in record.message for record in caplog.records
    )


# ---------------------------------------------------------------------------
# Signature enforcement
# ---------------------------------------------------------------------------


def test_audited_urlopen_rejects_missing_required_kwargs() -> None:
    """``trigger_feature`` and ``user_initiated`` are keyword-only + required."""
    with pytest.raises(TypeError):
        audited_urlopen("https://example.com/")  # type: ignore[call-arg]
    with pytest.raises(TypeError):
        audited_urlopen(  # type: ignore[call-arg]
            "https://example.com/", trigger_feature="unit_test"
        )
    with pytest.raises(TypeError):
        audited_urlopen(  # type: ignore[call-arg]
            "https://example.com/", user_initiated=True
        )


# ---------------------------------------------------------------------------
# is_provider_blocked — direct predicate tests
# ---------------------------------------------------------------------------


def test_is_provider_blocked_airplane_mode() -> None:
    """Airplane mode overrides every provider, including ones with no kill switch."""
    settings = {"network_audit_airplane_mode": True}
    # Provider with kill_switch_setting_key=None (openai) — still blocked.
    assert is_provider_blocked("openai", settings) is True
    # Provider with a real kill switch (reddit_api) — blocked.
    assert is_provider_blocked("reddit_api", settings) is True
    # Unknown provider — blocked under airplane mode.
    assert is_provider_blocked("nonexistent_provider_xyz", settings) is True


def test_is_provider_blocked_disabled_feature() -> None:
    """``news_comets_enabled=False`` blocks every ingestion provider wired to it."""
    settings = {"news_comets_enabled": False}
    assert is_provider_blocked("rss_feed", settings) is True
    assert is_provider_blocked("hackernews_api", settings) is True
    assert is_provider_blocked("reddit_api", settings) is True
    # Providers with a different kill switch are unaffected.
    assert is_provider_blocked("duckduckgo", settings) is False
    # Providers with no kill switch are never blocked by per-provider logic.
    assert is_provider_blocked("openai", settings) is False


def test_is_provider_blocked_string_disabled_values() -> None:
    """String kill switches block on empty-string or literal ``"mock"``."""
    # Weaviate: empty string disables.
    assert is_provider_blocked("weaviate", {"weaviate_url": ""}) is True
    assert (
        is_provider_blocked("weaviate", {"weaviate_url": "http://localhost:8080"})
        is False
    )
    # Tavily: autonomous_research_provider="mock" disables.
    assert (
        is_provider_blocked("tavily", {"autonomous_research_provider": "mock"})
        is True
    )
    assert (
        is_provider_blocked("tavily", {"autonomous_research_provider": "tavily"})
        is False
    )


def test_is_provider_blocked_unknown_provider_key() -> None:
    """An unknown provider key is never blocked (fallthrough to ``unclassified``)."""
    assert is_provider_blocked("made_up_provider", {}) is False
    # Even with real settings, an unknown key falls through when airplane
    # mode is off.
    assert (
        is_provider_blocked("made_up_provider", {"news_comets_enabled": False})
        is False
    )


def test_is_provider_blocked_provider_without_kill_switch() -> None:
    """Providers whose ``kill_switch_setting_key`` is ``None`` are never blocked here."""
    # openai has no host-level kill switch; Phase 4 invocation-layer
    # owns gating. Audit-layer predicate stays quiet.
    assert is_provider_blocked("openai", {}) is False
    assert is_provider_blocked("anthropic", {}) is False
    assert is_provider_blocked("huggingface_hub", {}) is False


def test_is_provider_blocked_setting_absent_from_mapping() -> None:
    """A declared kill-switch key that is missing from ``settings`` does not block."""
    # The spec says: defer to the application default when the key
    # isn't in settings. We can't prove the feature is off.
    assert is_provider_blocked("reddit_api", {}) is False
    assert is_provider_blocked("weaviate", {}) is False


def test_is_provider_blocked_boolean_true_does_not_block() -> None:
    """``news_comets_enabled=True`` keeps the provider unblocked."""
    settings = {"news_comets_enabled": True}
    assert is_provider_blocked("reddit_api", settings) is False
    assert is_provider_blocked("hackernews_api", settings) is False


# ---------------------------------------------------------------------------
# NetworkBlockedError — fields
# ---------------------------------------------------------------------------


def test_network_blocked_error_carries_fields() -> None:
    """``provider_key`` and ``reason`` are exposed as attributes and in the message."""
    err = NetworkBlockedError("openai", "airplane mode")
    assert err.provider_key == "openai"
    assert err.reason == "airplane mode"
    assert "openai" in str(err)
    assert "airplane mode" in str(err)
