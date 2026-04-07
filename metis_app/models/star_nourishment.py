"""Star Nourishment state model — tracks METIS companion hunger/satiation.

Inspired by GuppyLM's personality-through-structure pattern:
personality isn't prompted, it's built from state awareness.

The NourishmentState gives the companion a *felt sense* of its constellation:
- **hunger_level**: 0.0 (satiated) → 1.0 (starving). Rises over time
  without new stars, drops when stars are added.
- **faculty_gaps**: faculties with < threshold stars (knowledge blind spots).
- **star_events**: recent star additions/removals the companion perceives.
- **lightning_eligible**: whether the constellation has enough mass to
  unlock agent lightning (fast-path agentic execution).

Wave 3 additions:
- **PersonalityEvolution**: Tracks abliteration lineage and personality depth.
  Connects heretic pipeline → companion identity via weight-level change history.
- **Swarm persona scaling**: n_personas = f(total_stars) — more stars feed
  richer multi-persona debate in Simulation mode.
- **personality_baked event type**: New star event fired when abliteration
  completes, connecting heretic to the nourishment feedback loop.

Anti-sandbagging constraint: hunger NEVER degrades output quality.
It shapes desire/expression, not capability. The quality floor is
independent of nourishment state.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

from .assistant_types import _coerce_float, _coerce_int, assistant_now_iso


# ---------------------------------------------------------------------------
# Star event — atomic perception of a constellation change
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class StarEvent:
    event_type: str          # "star_added" | "star_removed" | "star_evolved"
    star_id: str
    faculty_id: str
    timestamp: str
    detail: str = ""         # e.g. "Scroll star added to Physics faculty"

    def to_payload(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_payload(cls, data: dict[str, Any]) -> "StarEvent":
        return cls(
            event_type=str(data.get("event_type") or "star_added"),
            star_id=str(data.get("star_id") or ""),
            faculty_id=str(data.get("faculty_id") or ""),
            timestamp=str(data.get("timestamp") or assistant_now_iso()),
            detail=str(data.get("detail") or ""),
        )


# ---------------------------------------------------------------------------
# Faculty nourishment snapshot
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class FacultyNourishment:
    faculty_id: str
    faculty_name: str
    star_count: int
    satiation: float         # 0.0–1.0; per-faculty fullness
    is_gap: bool             # star_count < gap_threshold

    def to_payload(self) -> dict[str, Any]:
        return asdict(self)


# ---------------------------------------------------------------------------
# Nourishment thresholds
# ---------------------------------------------------------------------------

# Stars required per faculty before it's considered "nourished"
FACULTY_GAP_THRESHOLD = 3

# Total stars needed to unlock agent lightning
LIGHTNING_STAR_THRESHOLD = 10

# Hunger decay rate (hunger rises by this per hour without new stars)
HUNGER_DECAY_RATE_PER_HOUR = 0.04

# Maximum recent events the companion tracks
MAX_RECENT_EVENTS = 20

# Topology thresholds
MIN_INTEGRATION_LOOPS = 2     # Fewer H₁ loops than this → topology hunger
ISOLATION_PENALTY_PER_FACULTY = 0.04  # Per isolated faculty hunger boost

# Hunger response levels
HUNGER_LEVELS = {
    "satiated":  (0.0, 0.15),
    "content":   (0.15, 0.35),
    "curious":   (0.35, 0.55),
    "hungry":    (0.55, 0.75),
    "ravenous":  (0.75, 0.90),
    "starving":  (0.90, 1.01),
}


def hunger_label(level: float) -> str:
    """Map a 0.0–1.0 hunger value to a named state."""
    for name, (lo, hi) in HUNGER_LEVELS.items():
        if lo <= level < hi:
            return name
    return "starving"


# ---------------------------------------------------------------------------
# Topology signal — scaffold data fed into hunger computation
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class TopologySignal:
    """Lightweight summary of scaffold topology passed to nourishment."""
    betti_0: int = 1              # Connected regions
    betti_1: int = 0              # Integration loops (H₁ generators)
    scaffold_edge_count: int = 0
    strongest_persistence: float = 0.0
    isolated_faculties: list[str] = field(default_factory=list)  # Faculty IDs with no scaffold edges
    summary: str = ""

    def to_payload(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_payload(cls, data: dict[str, Any] | None) -> "TopologySignal":
        if not data:
            return cls()
        return cls(
            betti_0=max(0, _coerce_int(data.get("betti_0"), 1)),
            betti_1=max(0, _coerce_int(data.get("betti_1"), 0)),
            scaffold_edge_count=max(0, _coerce_int(data.get("scaffold_edge_count"), 0)),
            strongest_persistence=max(0.0, _coerce_float(data.get("strongest_persistence"), 0.0)),
            isolated_faculties=list(data.get("isolated_faculties") or []),
            summary=str(data.get("summary") or ""),
        )


# ---------------------------------------------------------------------------
# Personality evolution — heretic abliteration lineage (Wave 3)
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class AbliterationRecord:
    """Single abliteration event in the companion's personality lineage."""
    model_id: str                  # HuggingFace model ID that was abliterated
    timestamp: str                 # ISO timestamp of completion
    traits_seeded: list[str] = field(default_factory=list)  # Faculty-derived trait tags
    star_count_at_bake: int = 0    # Stars when abliteration ran
    hunger_at_bake: float = 0.5    # Hunger level at abliteration time

    def to_payload(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_payload(cls, data: dict[str, Any]) -> "AbliterationRecord":
        return cls(
            model_id=str(data.get("model_id") or ""),
            timestamp=str(data.get("timestamp") or assistant_now_iso()),
            traits_seeded=list(data.get("traits_seeded") or []),
            star_count_at_bake=max(0, _coerce_int(data.get("star_count_at_bake"), 0)),
            hunger_at_bake=max(0.0, min(1.0, _coerce_float(data.get("hunger_at_bake"), 0.5))),
        )


@dataclass(slots=True)
class PersonalityEvolution:
    """Tracks weight-level personality depth via abliteration history.

    Each abliteration 'bakes' the companion's current state into model weights.
    The personality_depth score grows with both star diversity and abliteration
    count — you can't get depth by abliterating with an empty constellation,
    and you can't get depth from stars alone without ever baking.

    Swarm persona scaling: more personality depth → richer persona diversity
    in Simulation mode debates.
    """
    abliteration_count: int = 0
    abliteration_history: list[AbliterationRecord] = field(default_factory=list)
    personality_depth: float = 0.0    # 0.0–1.0; computed from stars × abliterations
    last_baked_at: str = ""           # ISO timestamp of most recent abliteration
    dominant_traits: list[str] = field(default_factory=list)  # Top trait tags from history

    def to_payload(self) -> dict[str, Any]:
        d = asdict(self)
        d["personality_depth"] = round(self.personality_depth, 3)
        return d

    @classmethod
    def from_payload(cls, data: dict[str, Any] | None) -> "PersonalityEvolution":
        if not data:
            return cls()
        history = [
            AbliterationRecord.from_payload(r) if isinstance(r, dict) else r
            for r in (data.get("abliteration_history") or [])
        ]
        return cls(
            abliteration_count=max(0, _coerce_int(data.get("abliteration_count"), 0)),
            abliteration_history=history,
            personality_depth=max(0.0, min(1.0, _coerce_float(data.get("personality_depth"), 0.0))),
            last_baked_at=str(data.get("last_baked_at") or ""),
            dominant_traits=list(data.get("dominant_traits") or []),
        )

    def record_abliteration(
        self,
        model_id: str,
        star_count: int,
        hunger_level: float,
        faculty_ids: list[str],
    ) -> None:
        """Record a new abliteration and recompute personality depth."""
        record = AbliterationRecord(
            model_id=model_id,
            timestamp=assistant_now_iso(),
            traits_seeded=list(faculty_ids[:10]),
            star_count_at_bake=star_count,
            hunger_at_bake=hunger_level,
        )
        self.abliteration_history.append(record)
        self.abliteration_count = len(self.abliteration_history)
        self.last_baked_at = record.timestamp
        self._recompute_depth(star_count)
        self._recompute_traits()

    def _recompute_depth(self, current_stars: int) -> None:
        """Personality depth = f(abliteration_count, star_diversity).

        Uses a logistic-like curve: depth grows fast with the first few
        abliterations but saturates. Star count amplifies the ceiling.
        """
        if self.abliteration_count == 0:
            self.personality_depth = 0.0
            return
        # Star factor: more stars → higher depth ceiling (capped at 1.0)
        star_factor = min(1.0, current_stars / 20.0)
        # Abliteration factor: diminishing returns (1 - e^(-count/3))
        abl_factor = 1.0 - math.exp(-self.abliteration_count / 3.0)
        self.personality_depth = round(min(1.0, star_factor * abl_factor), 3)

    def _recompute_traits(self) -> None:
        """Aggregate trait tags by frequency across abliteration history."""
        counts: dict[str, int] = {}
        for rec in self.abliteration_history:
            for trait in rec.traits_seeded:
                counts[trait] = counts.get(trait, 0) + 1
        # Sort by frequency, keep top 10
        self.dominant_traits = sorted(counts, key=lambda t: counts[t], reverse=True)[:10]


# ---------------------------------------------------------------------------
# Swarm persona scaling — star count → persona diversity (Wave 3)
# ---------------------------------------------------------------------------

# Minimum / maximum personas regardless of star count
_SWARM_MIN_PERSONAS = 3
_SWARM_MAX_PERSONAS = 32

# Personality depth bonus: extra personas from deep personality
_SWARM_DEPTH_BONUS_MAX = 8


def swarm_persona_count(
    total_stars: int,
    personality_depth: float = 0.0,
) -> int:
    """Compute optimal swarm persona count from star + personality state.

    Base formula: clamp(total_stars, 3, 32)
    Personality depth adds up to 8 bonus personas (depth × 8, rounded).

    More stars = more knowledge diversity to seed distinct personas.
    More personality depth = more nuanced trait differentiation in debate.
    """
    base = max(_SWARM_MIN_PERSONAS, min(_SWARM_MAX_PERSONAS, total_stars))
    depth_bonus = round(personality_depth * _SWARM_DEPTH_BONUS_MAX)
    return min(_SWARM_MAX_PERSONAS, base + depth_bonus)


# ---------------------------------------------------------------------------
# NourishmentState — the companion's felt sense of its constellation
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class NourishmentState:
    hunger_level: float = 0.5               # 0.0 satiated → 1.0 starving
    total_stars: int = 0
    integrated_stars: int = 0               # stars at "integrated" stage
    faculty_nourishment: list[FacultyNourishment] = field(default_factory=list)
    faculty_gaps: list[str] = field(default_factory=list)   # faculty_ids with gaps
    recent_events: list[StarEvent] = field(default_factory=list)
    lightning_eligible: bool = False
    topology: TopologySignal = field(default_factory=TopologySignal)
    personality: PersonalityEvolution = field(default_factory=PersonalityEvolution)
    last_fed_at: str = ""                   # ISO timestamp of last star_added
    last_starved_at: str = ""               # ISO timestamp when hunger hit > 0.90
    computed_at: str = ""

    @property
    def hunger_name(self) -> str:
        return hunger_label(self.hunger_level)

    @property
    def gap_count(self) -> int:
        return len(self.faculty_gaps)

    @property
    def is_starving(self) -> bool:
        return self.hunger_level >= 0.90

    @property
    def has_recent_loss(self) -> bool:
        return any(e.event_type == "star_removed" for e in self.recent_events[-5:])

    @property
    def integration_loops(self) -> int:
        return self.topology.betti_1

    @property
    def is_fragmented(self) -> bool:
        return self.topology.betti_0 > 1

    @property
    def personality_depth(self) -> float:
        return self.personality.personality_depth

    @property
    def swarm_personas(self) -> int:
        """Optimal swarm persona count based on stars + personality depth."""
        return swarm_persona_count(self.total_stars, self.personality_depth)

    @property
    def has_been_baked(self) -> bool:
        """Whether at least one abliteration has occurred."""
        return self.personality.abliteration_count > 0

    def to_payload(self) -> dict[str, Any]:
        d = asdict(self)
        d["hunger_name"] = self.hunger_name
        d["gap_count"] = self.gap_count
        d["is_starving"] = self.is_starving
        d["has_recent_loss"] = self.has_recent_loss
        d["integration_loops"] = self.integration_loops
        d["is_fragmented"] = self.is_fragmented
        d["personality_depth"] = self.personality_depth
        d["swarm_personas"] = self.swarm_personas
        d["has_been_baked"] = self.has_been_baked
        return d

    @classmethod
    def from_payload(cls, data: dict[str, Any] | None) -> "NourishmentState":
        if not data:
            return cls(computed_at=assistant_now_iso())
        return cls(
            hunger_level=max(0.0, min(1.0, _coerce_float(data.get("hunger_level"), 0.5))),
            total_stars=max(0, _coerce_int(data.get("total_stars"), 0)),
            integrated_stars=max(0, _coerce_int(data.get("integrated_stars"), 0)),
            faculty_nourishment=[
                FacultyNourishment(**fn) if isinstance(fn, dict) else fn
                for fn in (data.get("faculty_nourishment") or [])
            ],
            faculty_gaps=list(data.get("faculty_gaps") or []),
            recent_events=[
                StarEvent.from_payload(e) if isinstance(e, dict) else e
                for e in (data.get("recent_events") or [])
            ],
            lightning_eligible=bool(data.get("lightning_eligible", False)),
            topology=TopologySignal.from_payload(data.get("topology")),
            personality=PersonalityEvolution.from_payload(data.get("personality")),
            last_fed_at=str(data.get("last_fed_at") or ""),
            last_starved_at=str(data.get("last_starved_at") or ""),
            computed_at=str(data.get("computed_at") or assistant_now_iso()),
        )


# ---------------------------------------------------------------------------
# Compute nourishment from raw star data
# ---------------------------------------------------------------------------

def compute_nourishment(
    stars: list[dict[str, Any]],
    faculties: list[dict[str, str]],
    previous: NourishmentState | None = None,
    events: list[StarEvent] | None = None,
    topology: TopologySignal | None = None,
    personality: PersonalityEvolution | None = None,
) -> NourishmentState:
    """Derive a NourishmentState from the current constellation.

    Parameters
    ----------
    stars : list of star dicts (from settings["landing_constellation_user_stars"])
    faculties : list of {id, name} dicts (the 11 constellation faculties)
    previous : optional prior state for temporal hunger computation
    events : optional new star events to append
    topology : optional scaffold topology signal for topology-aware hunger
    personality : optional personality evolution state (Wave 3)
    """
    now = assistant_now_iso()
    total = len(stars)
    integrated = sum(1 for s in stars if (s.get("stage") or "seed") == "integrated")

    # Per-faculty nourishment
    faculty_star_counts: dict[str, int] = {}
    for star in stars:
        fid = star.get("primaryDomainId") or star.get("faculty_id") or ""
        if fid:
            faculty_star_counts[fid] = faculty_star_counts.get(fid, 0) + 1

    faculty_nourishment: list[FacultyNourishment] = []
    faculty_gaps: list[str] = []
    for fac in faculties:
        fid = fac["id"]
        fname = fac["name"]
        count = faculty_star_counts.get(fid, 0)
        sat = min(1.0, count / max(1, FACULTY_GAP_THRESHOLD * 2))
        is_gap = count < FACULTY_GAP_THRESHOLD
        faculty_nourishment.append(FacultyNourishment(
            faculty_id=fid,
            faculty_name=fname,
            star_count=count,
            satiation=sat,
            is_gap=is_gap,
        ))
        if is_gap:
            faculty_gaps.append(fid)

    # Topology signal — use provided or fallback to empty
    topo = topology or TopologySignal()

    # Hunger computation — based on star density + temporal decay + topology
    if total == 0:
        hunger = 1.0
    else:
        # Base hunger from star density (more stars → less hungry)
        density_hunger = max(0.0, 1.0 - (total / 30.0))
        # Gap pressure: each gap faculty adds hunger
        gap_pressure = min(0.3, len(faculty_gaps) * 0.05)
        # Temporal decay since last feeding
        time_hunger = 0.0
        if previous and previous.last_fed_at:
            try:
                last_fed = datetime.fromisoformat(previous.last_fed_at)
                hours_since = (datetime.now(timezone.utc) - last_fed).total_seconds() / 3600
                time_hunger = min(0.3, hours_since * HUNGER_DECAY_RATE_PER_HOUR)
            except (ValueError, TypeError):
                pass
        # Topology pressure: few integration loops + isolated faculties → more hunger
        topo_pressure = 0.0
        if total >= 3:  # Only apply topology pressure when enough stars exist
            if topo.betti_1 < MIN_INTEGRATION_LOOPS:
                topo_pressure += 0.08 * (MIN_INTEGRATION_LOOPS - topo.betti_1)
            topo_pressure += min(0.2, len(topo.isolated_faculties) * ISOLATION_PENALTY_PER_FACULTY)
        hunger = min(1.0, density_hunger + gap_pressure + time_hunger + topo_pressure)

    # Personality depth reduces hunger slightly — baked identity = more settled
    evo = personality or (previous.personality if previous else None) or PersonalityEvolution()
    if evo.personality_depth > 0:
        depth_calm = min(0.1, evo.personality_depth * 0.1)
        hunger = max(0.0, hunger - depth_calm)

    # Merge events
    recent = list((previous.recent_events if previous else []))
    if events:
        recent.extend(events)
    recent = recent[-MAX_RECENT_EVENTS:]

    # Determine last_fed_at
    last_fed = (previous.last_fed_at if previous else "") or ""
    for evt in (events or []):
        if evt.event_type == "star_added":
            last_fed = evt.timestamp

    lightning = total >= LIGHTNING_STAR_THRESHOLD

    last_starved = (previous.last_starved_at if previous else "") or ""
    if hunger >= 0.90 and not last_starved:
        last_starved = now

    return NourishmentState(
        hunger_level=round(hunger, 3),
        total_stars=total,
        integrated_stars=integrated,
        faculty_nourishment=faculty_nourishment,
        faculty_gaps=faculty_gaps,
        recent_events=recent,
        lightning_eligible=lightning,
        topology=topo,
        personality=evo,
        last_fed_at=last_fed,
        last_starved_at=last_starved,
        computed_at=now,
    )
