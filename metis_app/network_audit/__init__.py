"""Network Audit package (M17).

Phase 1 landed the declarative pieces: the known-provider registry and
the classification helper. Phase 2 added the audit event model
(``events.py``) and the SQLite-backed rolling store (``store.py``).
Phase 3a (this landing) adds the interception wrapper (``client.py``)
and the kill-switch layer (``kill_switches.py``). Later phases add the
API routes and the call-site migration.

See ``docs/adr/0010-network-audit-interception.md``,
``docs/adr/0011-network-audit-retention.md``, and
``plans/network-audit/plan.md`` for the full design.
"""

from metis_app.network_audit.client import (
    audited_urlopen,
)
from metis_app.network_audit.events import (
    NetworkAuditEvent,
    sanitize_url,
)
from metis_app.network_audit.kill_switches import (
    NetworkBlockedError,
    is_provider_blocked,
)
from metis_app.network_audit.providers import (
    KNOWN_PROVIDERS,
    ProviderCategory,
    ProviderSpec,
    classify_host,
)
from metis_app.network_audit.store import (
    NetworkAuditStore,
)

__all__ = [
    "KNOWN_PROVIDERS",
    "NetworkAuditEvent",
    "NetworkAuditStore",
    "NetworkBlockedError",
    "ProviderCategory",
    "ProviderSpec",
    "audited_urlopen",
    "classify_host",
    "is_provider_blocked",
    "sanitize_url",
]
