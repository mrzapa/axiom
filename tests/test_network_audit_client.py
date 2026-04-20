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


def test_audited_urlopen_infers_post_from_data_kwarg_on_string_url(
    tmp_store: NetworkAuditStore,
) -> None:
    """``urlopen(url_string, data=b'...')`` sends POST; the audit event
    must record POST too, not the stdlib ``urlopen``-signature default
    of GET. Caught by Codex review on PR #517."""
    body = b'{"ping": 1}'

    with patch("urllib.request.urlopen", side_effect=_fake_response(status=201)):
        audited_urlopen(
            "https://example.com/api/endpoint",
            trigger_feature="unit_test",
            user_initiated=False,
            data=body,
            store=tmp_store,
        )

    events = tmp_store.recent(limit=10)
    assert len(events) == 1
    assert events[0].method == "POST"
    assert events[0].size_bytes_out == len(body)


def test_audited_urlopen_records_size_from_request_body(
    tmp_store: NetworkAuditStore,
) -> None:
    """A ``Request(data=...)`` object with no ``data`` kwarg must still
    record ``size_bytes_out`` from the Request's embedded body. Caught
    by Codex review on PR #517."""
    body = b"hello"
    req = urllib.request.Request(
        "https://example.com/api",
        data=body,
        method="POST",
    )

    with patch("urllib.request.urlopen", side_effect=_fake_response(status=200)):
        audited_urlopen(
            req,
            trigger_feature="unit_test",
            user_initiated=True,
            store=tmp_store,
        )

    events = tmp_store.recent(limit=10)
    assert len(events) == 1
    assert events[0].size_bytes_out == len(body)


def test_audited_urlopen_data_kwarg_overrides_request_body_size(
    tmp_store: NetworkAuditStore,
) -> None:
    """When both a ``Request(data=...)`` and a ``data=`` kwarg are
    passed, stdlib ``urlopen`` uses the kwarg; the recorded size must
    match the kwarg, not the Request's original body."""
    req = urllib.request.Request(
        "https://example.com/api",
        data=b"aaa",
        method="POST",
    )
    override = b"bbbbb"

    with patch("urllib.request.urlopen", side_effect=_fake_response(status=200)):
        audited_urlopen(
            req,
            trigger_feature="unit_test",
            user_initiated=True,
            data=override,
            store=tmp_store,
        )

    events = tmp_store.recent(limit=10)
    assert len(events) == 1
    assert events[0].size_bytes_out == len(override)


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
    """Providers whose ``kill_switch_setting_key`` is ``None`` are not blocked
    when the Phase 6 ``provider_block_llm`` map is empty or absent.

    openai has no host-level kill switch; absent a per-provider map
    entry (Phase 6) the audit-layer predicate stays quiet and Phase 4
    invocation-layer owns gating.
    """
    # Empty settings — no map at all.
    assert is_provider_blocked("openai", {}) is False
    assert is_provider_blocked("anthropic", {}) is False
    assert is_provider_blocked("huggingface_hub", {}) is False
    # Empty map — explicit, still not blocked.
    assert is_provider_blocked("openai", {"provider_block_llm": {}}) is False
    # Key explicitly False — not blocked.
    assert (
        is_provider_blocked(
            "openai", {"provider_block_llm": {"openai": False}}
        )
        is False
    )


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
# Phase 6 — provider_block_llm map
# ---------------------------------------------------------------------------


def test_is_provider_blocked_consults_provider_block_llm_map() -> None:
    """Phase 6: the per-provider map gates providers with no legacy kill switch.

    Covers the four map shapes the predicate must handle:

    (a) empty map           -> not blocked
    (b) key set to True     -> blocked
    (c) key set to False    -> not blocked
    (d) wrong-shape value   -> not blocked (defensive, no crash)
    """
    # (a) Empty map — openai has kill_switch_setting_key=None and
    # the map contributes nothing, so the predicate falls through to
    # "not blocked".
    assert (
        is_provider_blocked("openai", {"provider_block_llm": {}})
        is False
    )

    # (b) Explicit True — per-provider block fires.
    assert (
        is_provider_blocked(
            "openai", {"provider_block_llm": {"openai": True}}
        )
        is True
    )
    # Works for every kill_switch_setting_key=None provider named in
    # the Phase 6 spec.
    for provider in (
        "anthropic",
        "google",
        "xai",
        "openai_embeddings",
        "google_embeddings",
        "voyage",
        "huggingface_local",
        "local_lm_studio",
        "huggingface_hub",
        "jina_reader",
        "nyx_registry",
        "google_fonts",
    ):
        assert (
            is_provider_blocked(
                provider, {"provider_block_llm": {provider: True}}
            )
            is True
        ), f"provider_block_llm[{provider}]=True did not block"

    # (c) Explicit False — not blocked.
    assert (
        is_provider_blocked(
            "openai", {"provider_block_llm": {"openai": False}}
        )
        is False
    )

    # (d) Wrong-shape entry value (list instead of bool) — treated as
    # "not True" and falls through. The dict map itself is well-formed
    # in this sub-case; only the per-key value is odd.
    assert (
        is_provider_blocked(
            "openai", {"provider_block_llm": {"openai": ["yes"]}}
        )
        is False
    )


def test_airplane_mode_overrides_provider_block_llm() -> None:
    """Airplane mode wins regardless of per-provider map entries.

    When ``network_audit_airplane_mode`` is True, per-provider
    entries don't matter — even a ``provider_block_llm[key] = False``
    is overridden to blocked. This mirrors the existing airplane-mode
    semantics for legacy kill switches.
    """
    settings = {
        "network_audit_airplane_mode": True,
        "provider_block_llm": {"openai": False, "anthropic": False},
    }
    # Airplane wins over False entries.
    assert is_provider_blocked("openai", settings) is True
    assert is_provider_blocked("anthropic", settings) is True
    # Airplane wins over True entries (trivially the same outcome).
    settings["provider_block_llm"] = {"openai": True}
    assert is_provider_blocked("openai", settings) is True
    # Unknown provider keys still blocked under airplane mode, even
    # with a per-provider map present.
    assert is_provider_blocked("nonexistent_xyz", settings) is True


def test_provider_block_llm_non_dict_value_ignored() -> None:
    """A wrong-typed ``provider_block_llm`` value degrades gracefully.

    If the settings file is hand-edited to ``"provider_block_llm":
    "mock"`` (a string), the predicate must not crash. The invariant
    is "audit must never break the wrapped call"; that extends to
    "never raise on a wrong-shape settings value". The predicate
    falls through to the legacy path and returns ``False`` for
    providers whose ``kill_switch_setting_key`` is ``None``.
    """
    # String instead of dict.
    assert (
        is_provider_blocked("openai", {"provider_block_llm": "mock"})
        is False
    )
    # None instead of dict.
    assert (
        is_provider_blocked("openai", {"provider_block_llm": None})
        is False
    )
    # List instead of dict.
    assert (
        is_provider_blocked("openai", {"provider_block_llm": ["openai"]})
        is False
    )
    # Integer instead of dict.
    assert (
        is_provider_blocked("openai", {"provider_block_llm": 1})
        is False
    )
    # Confirm legacy behaviour still works alongside a malformed map
    # (the per-provider map is ignored, but news_comets_enabled still
    # gates ingestion providers).
    settings: dict[str, object] = {
        "provider_block_llm": "mock",
        "news_comets_enabled": False,
    }
    assert is_provider_blocked("reddit_api", settings) is True


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


# ---------------------------------------------------------------------------
# Phase 6 reason-string polish — block reason must name the right source
# ---------------------------------------------------------------------------


def test_blocked_error_reason_names_provider_block_llm_when_map_blocks(
    tmp_store: NetworkAuditStore,
) -> None:
    """A ``provider_block_llm``-map block yields a descriptive reason.

    Before Phase 6 Task B, the client built the reason as
    ``f"kill switch '{spec.kill_switch_setting_key}' is disabled"``,
    which for openai (``kill_switch_setting_key=None``) rendered as
    ``"kill switch 'None' is disabled"`` — ugly and wrong. The fix
    distinguishes the map-block case explicitly.
    """
    settings = {"provider_block_llm": {"openai": True}}

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
    assert "provider_block_llm" in exc_info.value.reason
    # The old bug rendered the ``None`` setting key literally; the fix
    # must not regress that.
    assert "'None'" not in exc_info.value.reason
    assert "None" not in exc_info.value.reason.split("provider_block_llm")[1]


def test_blocked_error_reason_names_legacy_key_when_legacy_blocks(
    tmp_store: NetworkAuditStore,
) -> None:
    """A legacy-kill-switch block names the offending settings key.

    Regression guard: the Phase 6 reason-string refactor must not
    break the existing behaviour for providers whose
    ``kill_switch_setting_key`` is real (e.g. ``reddit_api`` →
    ``news_comets_enabled``).
    """
    settings = {"news_comets_enabled": False}

    with patch("urllib.request.urlopen"):
        with pytest.raises(NetworkBlockedError) as exc_info:
            audited_urlopen(
                "https://www.reddit.com/r/test.json",
                trigger_feature="news_comet_worker",
                user_initiated=False,
                store=tmp_store,
                settings=settings,
            )

    assert exc_info.value.provider_key == "reddit_api"
    assert "news_comets_enabled" in exc_info.value.reason
    assert "provider_block_llm" not in exc_info.value.reason
