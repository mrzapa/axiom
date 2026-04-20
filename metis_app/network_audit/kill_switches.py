"""Kill-switch evaluation for the M17 Network Audit wrapper.

Phase 3a landed the central :func:`is_provider_blocked` predicate and
the :class:`NetworkBlockedError` sentinel exception that
:mod:`metis_app.network_audit.client` raises when a call is stopped.

The predicate is the single place that interprets settings.json keys as
kill-switch signals. Two shapes are supported today:

- **Boolean feature flags** (``news_comets_enabled``,
  ``autonomous_research_enabled``) — blocked when the value is ``False``
  (feature disabled ⇒ no outbound traffic).
- **String kill switches** (``weaviate_url``, ``llm_provider``,
  ``autonomous_research_provider``) — blocked when the value is the
  empty string *or* the literal string ``"mock"`` (the LLM-provider
  convention for "use the in-memory fake").

A master ``network_audit_airplane_mode`` boolean short-circuits the
per-provider check and blocks every provider when true. Phase 5 wires
this to a single toggle in the privacy panel; Phase 3a just honours it
so the wrapper's contract is complete.

Providers whose :attr:`ProviderSpec.kill_switch_setting_key` is ``None``
have no host-level kill switch today. They may still be blocked by
invocation-layer checks in Phase 4 (e.g. absence of an API key for
LangChain providers), but that path is owned by the SDK factory, not by
this predicate.

See ``plans/network-audit/plan.md`` Phase 3 and
``docs/adr/0010-network-audit-interception.md`` for the full design.
"""

from __future__ import annotations

from typing import Any, Mapping

from metis_app.network_audit.providers import KNOWN_PROVIDERS

# ---------------------------------------------------------------------------
# Sentinel strings
# ---------------------------------------------------------------------------

# Settings keys whose values are interpreted as booleans. For these, a
# ``False`` value means the feature is disabled and outbound traffic is
# blocked. Centralising the list here keeps classification honest; a new
# boolean kill switch added in Phase 5 must be registered here (and in
# the provider spec).
_BOOLEAN_KILL_SWITCH_KEYS: frozenset[str] = frozenset(
    {
        "news_comets_enabled",
        "autonomous_research_enabled",
    }
)

# String values that, when found in a string-typed kill-switch setting,
# are read as "the feature is disabled". The empty string is the de
# facto disabled value for ``weaviate_url``; the literal ``"mock"`` is
# the convention for LLM-provider routing pointed at the in-memory
# fake. Both together keep the predicate honest regardless of which
# convention a given setting uses.
_STRING_DISABLED_VALUES: frozenset[str] = frozenset({"", "mock"})

# The master airplane-mode settings key. Phase 5 surfaces this as a
# single toggle in the privacy panel.
AIRPLANE_MODE_KEY = "network_audit_airplane_mode"

# Phase 6 per-provider block map. Lives in ``settings.json`` as a
# ``dict[str, bool]`` keyed by provider key (e.g. ``"openai"``,
# ``"anthropic"``, ``"voyage"``). Exists specifically to cover the
# LLM/embedding/model-hub/fonts providers that have no legacy
# ``kill_switch_setting_key`` (see ``providers.py`` —
# ``kill_switch_setting_key=None``). An entry set to ``True`` blocks
# that provider's outbound calls even when airplane mode is off.
PROVIDER_BLOCK_LLM_KEY = "provider_block_llm"


# ---------------------------------------------------------------------------
# Exception
# ---------------------------------------------------------------------------


class NetworkBlockedError(Exception):
    """Raised when an outbound call is blocked by the audit's kill switch.

    Carries the ``provider_key`` and ``reason`` so callers can degrade
    gracefully rather than crash. The message is pre-formatted for
    logging, but consumers should prefer the structured attributes
    when displaying the failure in the UI.
    """

    def __init__(self, provider_key: str, reason: str) -> None:
        super().__init__(
            f"Network call to provider '{provider_key}' blocked: {reason}"
        )
        self.provider_key = provider_key
        self.reason = reason


# ---------------------------------------------------------------------------
# Predicate
# ---------------------------------------------------------------------------


def is_provider_blocked(
    provider_key: str, settings: Mapping[str, Any]
) -> bool:
    """Return ``True`` iff the provider is currently blocked by user settings.

    Looks up the provider's ``kill_switch_setting_key`` from
    :data:`KNOWN_PROVIDERS` and consults ``settings`` for the value.
    A provider with ``kill_switch_setting_key=None`` is never blocked
    by this function (block is expressed some other way — e.g. absence
    of API key — and is handled in the SDK invocation layer, Phase 4).

    Special cases:

    - **Airplane mode**: if ``settings.get("network_audit_airplane_mode")
      is True``, ALL providers report blocked regardless of per-provider
      setting.
    - **Unknown provider key**: treated as not-blocked (fallthrough to
      ``unclassified`` should not silently block).
    - **``provider_block_llm`` map** (Phase 6): a ``dict[str, bool]``
      under the ``"provider_block_llm"`` settings key. If the map has
      ``provider_key`` set to ``True``, the provider is blocked. This
      covers the LLM/embedding/model-hub providers whose
      ``kill_switch_setting_key`` is ``None`` (no legacy per-feature
      flag). Missing keys, ``False`` values, and non-dict map values
      fall through to the legacy logic without raising.
    - **Boolean settings keys** (``news_comets_enabled``,
      ``autonomous_research_enabled``) — blocked when the value is
      ``False``.
    - **String settings keys** — blocked when the value is the empty
      string OR the literal ``"mock"``.
    """
    # Airplane mode is the master switch; short-circuit everything
    # else so the predicate stays truthful even if the caller passes
    # an unknown provider key.
    if settings.get(AIRPLANE_MODE_KEY) is True:
        return True

    spec = KNOWN_PROVIDERS.get(provider_key)
    if spec is None:
        # Unknown provider keys fall through to "not blocked"; the
        # wrapper still records the event so the panel shows them.
        return False

    # Phase 6 per-provider block map. Consulted *before* the legacy
    # ``kill_switch_setting_key`` path so providers with
    # ``kill_switch_setting_key=None`` (OpenAI, Anthropic, voyage,
    # huggingface_hub, …) can still be gated. A defensive isinstance
    # check keeps a malformed settings.json (e.g. the user hand-edited
    # ``"provider_block_llm": "mock"``) from crashing the predicate —
    # the invariant is "audit must not break the wrapped call", and
    # that extends to "never crash on a wrong-shape settings value".
    provider_block_llm = settings.get(PROVIDER_BLOCK_LLM_KEY)
    if isinstance(provider_block_llm, dict):
        if provider_block_llm.get(provider_key) is True:
            return True

    setting_key = spec.kill_switch_setting_key
    if setting_key is None:
        # No host-level kill switch and no per-provider override above;
        # invocation-layer checks (Phase 4) own this provider's gating.
        # Audit-layer predicate is quiet.
        return False

    if setting_key not in settings:
        # The setting is declared on the provider spec but absent from
        # the settings mapping. Do not block — we cannot prove the
        # feature is disabled; defer to the application default.
        return False

    value = settings[setting_key]

    if setting_key in _BOOLEAN_KILL_SWITCH_KEYS:
        # Explicit False blocks. Anything else (True, None, missing)
        # falls through to "not blocked".
        return value is False

    # String kill switches: blocked iff the value is the empty string
    # or the literal "mock". Non-string values (None, numbers) are
    # treated as "not disabled" — the convention is that these keys
    # only ever hold strings.
    if isinstance(value, str):
        return value in _STRING_DISABLED_VALUES

    return False


__all__ = [
    "AIRPLANE_MODE_KEY",
    "PROVIDER_BLOCK_LLM_KEY",
    "NetworkBlockedError",
    "is_provider_blocked",
]
