# 0008 - Feed Storage Format

- **Status:** Accepted (M13 Phase 3 prep)
- **Date:** 2026-04-25

## Context

M13 Phase 2 (PR #541) shipped the Seedling lifecycle shell — a ticking
worker, a status surface, and a companion-activity bridge. Phase 2 is
deliberately a no-op heartbeat: it does not poll feeds, classify items,
or move comets through their lifecycle.

Phase 3 turns that heartbeat into a continuous-ingestion loop. Before
the worker can call into `NewsIngestService` from inside a tick, the
plan (`plans/seedling-and-feed/plan.md` Phase 3) requires a durable
home for two things the news-comet pipeline currently keeps in
volatile memory:

1. **Active comets.** `metis_app/api_litestar/routes/comets.py:36`
   declares `_active_comets: list[CometEvent] = []` at module scope. A
   process restart loses every drifting/approaching comet, so a comet
   the user saw last night never resolves on this morning's run.
2. **Seen-item dedup.** `NewsIngestService._seen_hashes`
   (`metis_app/services/news_ingest_service.py:252`) is an in-process
   `OrderedDict` capped at 2 000 hashes. After restart it is empty;
   the next poll re-emits the entire RSS / HN window as "new" and
   the user sees a flood of stale comets.

Phase 3 also wants per-source cursors so polling becomes incremental
rather than re-scanning every entry every cycle, and it wants OPML
import so users can move their existing feed reader into METIS without
hand-editing JSON.

This ADR locks the storage shape for those four concerns —
durable comets, durable dedup, per-source cursors, and OPML import —
before any worker code touches them.

The repo already ships the load-bearing patterns:

- `metis_app/services/skill_repository.py::_DEFAULT_CANDIDATES_DB_PATH`
  established the per-feature single-SQLite-file convention at
  `<repo_root>/skill_candidates.db`. ADR 0011 followed that same
  pattern with `network_audit.db`.
- `metis_app/services/atlas_repository.py` shows the in-repo SQLite
  scaffolding: `_connect`, `_transaction`, `init_db` with idempotent
  `CREATE TABLE IF NOT EXISTS` plus targeted indexes, and a
  `_shared_conn` for `:memory:` test mode.
- `metis_app/models/comet_event.py` already gives us the wire-shape
  dataclasses (`NewsItem`, `CometEvent`) plus `to_dict()` / phase
  enums. The store does not need to invent a new schema vocabulary.

Phase 3 therefore has to wire these together; it does not need to
re-invent SQLite plumbing. This ADR records the shape.

## Decision

Store news-comet state in a new per-feature SQLite file at
`<repo_root>/news_items.db`, accessed through a new
`metis_app/services/news_feed_repository.py` that mirrors the
`atlas_repository` pattern. **Do not extend `rag_sessions.db`.** The
shared session DB is already four tables wide (atlas, assistants,
sessions, improvements) and adding feed churn on top of it would
muddy backup, retention, and Phase 5 panel queries.

### 1. Three tables — `news_items`, `comet_events`, `feed_cursors`

```sql
CREATE TABLE news_items (
    item_hash         TEXT PRIMARY KEY,        -- 16-char sha256 prefix; see "Dedup hash" below
    item_id           TEXT NOT NULL,           -- existing NewsItem.item_id (12-char hex)
    title             TEXT NOT NULL,
    summary           TEXT NOT NULL,
    url               TEXT NOT NULL,
    source_channel    TEXT NOT NULL,           -- "rss" / "hn" / "reddit" / "exa" / ...
    source_url        TEXT NOT NULL,           -- which feed/sub/channel produced it; "" for global
    published_at      REAL NOT NULL,           -- epoch seconds
    fetched_at        REAL NOT NULL,
    raw_metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_news_items_fetched ON news_items (fetched_at DESC);
CREATE INDEX idx_news_items_source  ON news_items (source_channel, source_url, fetched_at DESC);

CREATE TABLE comet_events (
    comet_id              TEXT PRIMARY KEY,
    item_hash             TEXT NOT NULL REFERENCES news_items(item_hash) ON DELETE CASCADE,
    faculty_id            TEXT NOT NULL DEFAULT '',
    secondary_faculty_id  TEXT NOT NULL DEFAULT '',
    classification_score  REAL NOT NULL DEFAULT 0.0,
    decision              TEXT NOT NULL,        -- "drift" / "approach" / "absorb"
    relevance_score       REAL NOT NULL DEFAULT 0.0,
    gap_score             REAL NOT NULL DEFAULT 0.0,
    phase                 TEXT NOT NULL,        -- CometPhase literal
    created_at            REAL NOT NULL,
    decided_at            REAL NOT NULL DEFAULT 0.0,
    absorbed_at           REAL NOT NULL DEFAULT 0.0,
    notes                 TEXT NOT NULL DEFAULT ''  -- absorb/dismiss notes
);
CREATE INDEX idx_comet_events_phase   ON comet_events (phase, created_at DESC);
CREATE INDEX idx_comet_events_active  ON comet_events (created_at DESC)
    WHERE phase NOT IN ('absorbed','dismissed','fading');

CREATE TABLE feed_cursors (
    source_channel        TEXT NOT NULL,        -- "rss" / "hn" / "reddit" / ...
    source_url            TEXT NOT NULL,        -- feed URL, sub name, or "" for global
    last_polled_at        REAL NOT NULL,
    last_success_at       REAL NOT NULL DEFAULT 0.0,
    last_item_hash        TEXT NOT NULL DEFAULT '',
    failure_count         INTEGER NOT NULL DEFAULT 0,
    paused_until          REAL NOT NULL DEFAULT 0.0,
    PRIMARY KEY (source_channel, source_url)
);
```

WAL journal mode (`PRAGMA journal_mode=WAL`) is enabled on connect so
the SSE comet stream can read while the worker writes. All writes go
through a single `threading.Lock` per `NewsFeedRepository` instance —
matching the `atlas_repository` posture and the
`network_audit.runtime` pattern.

### 2. Dedup hash — keep the existing algorithm, persist it

Use the existing
`NewsIngestService._item_hash(title, url) = sha256(f"{title.lower()}|{url.lower()}")[:16]`.
Phase 3 wraps it as `news_feed_repository.compute_item_hash(...)` so
both the ingest service and the repository agree, and stores it as
`news_items.item_hash` (the primary key). On every poll, the worker
runs the same hash over fetched items and uses
`INSERT … ON CONFLICT(item_hash) DO NOTHING` to drop duplicates
without an explicit "have I seen this?" round-trip per item.

`NewsIngestService._seen_hashes` becomes an in-process **read-through
cache** in front of the repository, kept for fast-path latency on
high-frequency polls. The persisted set is the source of truth.

### 3. Per-source cursors

Every poll cycle reads `feed_cursors` for the configured RSS feeds
and Reddit subs, fetches incrementally where the source supports it
(RSS: `If-Modified-Since` / `ETag` against `last_polled_at` /
`last_item_hash`; HN/Reddit: per-source ordering already keeps newest
first, so cursor is the newest hash seen last cycle), and writes
`last_polled_at`, `last_success_at`, and `last_item_hash` back at the
end of the cycle. `failure_count` and `paused_until` move the existing
`_SourceHealth` backoff state from process memory into the DB so a
restart does not lose the "this feed has been failing for an hour,
back off" signal.

### 4. Retention policy

Two writers, one cleaner.

- **`news_items`:** rolling 14-day window, evict oldest by
  `fetched_at`. Hard cap of 50 000 rows, whichever hits first. This
  is enough to keep dedup honest without turning the DB into a
  permanent reading history.
- **`comet_events`:**
  - Active phases (`entering`, `drifting`, `approaching`,
    `absorbing`) survive eviction regardless of age — losing those
    contradicts decision (1) of the *Context* above.
  - `dismissed` and `fading` evicted after 7 days.
  - `absorbed` evicted only after the linked star is itself
    promoted into Atlas / removed (Phase 3+ ties this to
    `atlas_repository`); until then the absorbed comet stays as
    provenance.
  - `ON DELETE CASCADE` on `news_items.item_hash` keeps things in
    sync; the cleaner deletes from `news_items` and SQLite reaps
    the comet rows.
- **`feed_cursors`:** never auto-evicted. A cursor row is the size of
  a settings entry; if the user removes the feed from
  `news_comet_rss_feeds`, the worker leaves the cursor row in place
  for one week so re-adding the same feed resumes incremental polling
  rather than re-scanning the whole archive.

The cleaner runs once per Seedling tick (Phase 3 introduces it), not
on a separate schedule. `news_feed_repository.cleanup(now)` is a pure
function over `(now, retention_policy)` and is tested with frozen
`now` rather than wall-clock sleeps.

### 5. OPML import

OPML is a tree of `<outline>` elements; a feed reader's export is a
flat list of `<outline xmlUrl="…" type="rss" />` nested inside one
outer `<outline text="Subscriptions">`. Phase 3 v1 supports import
only.

- New endpoint: `POST /v1/comets/opml/import` accepting
  `multipart/form-data` with a single OPML file (≤1 MB).
- Parser: stdlib `xml.etree.ElementTree` with `defusedxml` if already
  available, otherwise `ElementTree.fromstring(..., parser=ET.XMLParser())`
  configured to disable DTD loading. **No external XML libraries.**
- Behaviour: the parser walks the tree, collects every `xmlUrl`
  attribute on outlines whose `type` attribute is `rss` (or absent),
  validates each as a URL through the same SSRF gate that
  `NewsIngestService._safe_get` already uses, dedups against the
  existing `news_comet_rss_feeds` setting, and appends new entries.
  For each new feed it writes a `feed_cursors` row with
  `last_polled_at = 0` so the next worker tick treats it as a cold
  feed.
- The endpoint returns `{added: int, skipped_duplicate: int,
  skipped_invalid: int, errors: [...]}`. It does **not** start a
  poll synchronously — the next worker tick picks up the new feeds.
- Export deferred to a follow-up. Tracked in `plans/IDEAS.md` as
  *"OPML export of current feed list"*.

## Constraints

- Preserve ADR 0004: single Litestar process, no second daemon. The
  store is a SQLite file the worker opens; no service mesh, no
  network DB.
- Preserve ADR 0011's privacy posture for feed *content*. URLs and
  titles of items the user fetches *are* recorded — that is by design
  for dedup and for "show me the comets I dismissed" — but they live
  on the user's disk and are never exfiltrated. The `news_items.db`
  retention windows above are the explicit honest answer to "what
  exactly are you keeping about my reading habits?".
- Coordinate with M17 (Network audit). Every outbound fetch the
  worker triggers — RSS fetch, HN fetch, Reddit fetch, OPML feed
  validation — must already be going through `audited_urlopen` with
  a `trigger_feature` tag. This ADR does not introduce new outbound
  call sites; it persists the *results* of the existing audited
  ones.
- Coordinate with M09 (`AutonomousResearchService`) and the comet
  decision engine. The repository owns serialization; the decision
  engine continues to own scoring. No business logic moves into
  `news_feed_repository`.
- Do **not** add a new dependency. SQLite ships with stdlib;
  `xml.etree.ElementTree` ships with stdlib; both already pass the
  existing dependency policy.

## Alternatives Considered

- **Extend `rag_sessions.db` with `news_items` / `comet_events`
  tables.** Rejected. The shared DB is already the home of atlas,
  sessions, assistants, and improvements. Adding feed churn on top
  introduces lock contention for the user-facing chat path against
  the background poller, complicates retention (atlas entries are
  permanent; comet rows roll over), and crosses the "one decision
  per file" principle that ADR 0011 used to justify
  `network_audit.db` as a separate file.

- **Extend `atlas_repository` with `news_items` and treat absorbed
  comets as draft Atlas entries.** Tempting, because absorbed
  comets *do* eventually become Atlas-style provenance for stars,
  but the lifecycle is too different. Atlas entries are user-curated
  end-state artefacts; comets are transient and most never reach
  absorption. Forcing a comet through the Atlas data model bloats
  Atlas with throwaway rows.

- **JSON files on disk** (one per active comet, one per cursor).
  Rejected. The existing in-memory list already outgrew its first
  shape; a file-per-comet approach would be slower for the
  "list_active_comets" query that the constellation polls every few
  seconds, and harder to atomically rewrite during eviction.

- **A second event-log SQLite file** (`comet_events.db`) separate
  from `news_items.db`. Rejected. The two tables are tightly
  coupled by `item_hash`; splitting them across files breaks
  foreign-key enforcement and forces a manual cleanup join the
  cleaner does not need.

- **Store feed cursors in `default_settings.json`.** Rejected. The
  settings file is user-readable and user-editable; cursors change
  every poll cycle. Mixing those write rates would break the "edit
  settings without losing my place" mental model and would force
  the worker to take a write lock on a file the UI also writes to.

## Consequences

Accepted implementation follow-ups (Phase 3+):

- Add `metis_app/services/news_feed_repository.py` with the schema
  above, plus `add_news_items`, `record_comet`, `update_phase`,
  `list_active`, `get_cursor`, `update_cursor`, `cleanup` methods.
  Tests in `tests/test_news_feed_repository.py` use `:memory:` mode
  and assert idempotent `init_db`, dedup-on-conflict, retention
  windows, and cursor round-trips.
- Refactor `metis_app/api_litestar/routes/comets.py` so
  `_active_comets`, `_last_poll`, and `_gc_terminal_comets` are
  thin wrappers over the repository. The HTTP shape does not
  change in Phase 3.
- Refactor `metis_app/services/news_ingest_service.py` so
  `_seen_hashes` is an LRU on top of `news_feed_repository`. The
  service still owns fetch + parse + classification staging; the
  repository owns persistence.
- Add `seedling_feed_db_path` setting (default
  `<repo_root>/news_items.db`) so packaged deployments and tests can
  override the location through the same path the existing
  `local_gguf_*` overrides use.
- Add `seedling_feed_retention_days` (default 14) and
  `seedling_feed_max_rows` (default 50 000) to
  `metis_app/default_settings.json` with the same caveat that they
  are advisory; the cleaner clamps both.
- The Phase 3 ingestion loop is the **only** writer to
  `comet_events.phase = "absorbing" → "absorbed"`. Front-end absorb
  / dismiss endpoints (`/v1/comets/{id}/absorb` and `/dismiss`) call
  through `news_feed_repository.update_phase`; they do not mutate
  the repository directly from the route handler so tests can
  assert against a single seam.
- The OPML import endpoint registers under
  `routes/comets.py::router` — there is no new "feeds" router.
  Authorisation uses the same `require_token_guard` as the rest of
  `protected_routes`.

## Open Questions

- Should a comet that was *absorbed* before Phase 5's growth-stage
  signal lands count toward the "stars indexed" threshold? Phase 5
  needs to decide; this ADR notes the question so the
  `comet_events.phase = 'absorbed'` row stays the canonical
  provenance.
- The cleaner runs on every Seedling tick. For a once-a-minute tick
  with 50k-row caps, the per-tick work is bounded, but if Phase 5
  raises `seedling_tick_interval_seconds` above one minute the
  cleaner should not skip cycles. Track in Phase 5 retro.
- Long-term: does OPML import deserve a settings-level UI surface
  (drag-drop OPML in the comets settings page), or only a CLI / API
  call? Tracked in `plans/IDEAS.md` after the API endpoint lands and
  user feedback decides.
- If a feed sets `If-Modified-Since` headers but lies about
  `Last-Modified`, the cursor will under- or over-fetch. The
  fallback (cursor by newest item hash) covers correctness but
  wastes bandwidth. Note for Phase 3 measurement, not an ADR-level
  decision.
