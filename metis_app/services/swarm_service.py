"""Swarm simulation service for METIS.

Implements multi-agent persona simulation inspired by MiroShark's swarm
intelligence engine.  Given indexed documents, it:

1. Extracts key entities and generates AI personas from them.
2. Runs a configurable number of simulation rounds where agents post
   reactions, shift beliefs, and interact.
3. Returns a structured SimulationReport with per-agent belief trajectories.

This is a pure Python service with no external infrastructure dependencies —
personas and simulation are driven entirely by the configured LLM.
"""

from __future__ import annotations

import json
import logging
import re
import statistics
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Iterator

from metis_app.utils.llm_providers import create_llm

_log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------


@dataclass
class BeliefState:
    """Per-agent belief tracking across topics."""

    topic_stance: dict[str, float] = field(default_factory=dict)
    topic_confidence: dict[str, float] = field(default_factory=dict)
    agent_trust: dict[str, float] = field(default_factory=dict)

    def update_stance(self, topic: str, delta: float) -> None:
        """Shift stance by delta, clamped to [-1, 1]."""
        current = self.topic_stance.get(topic, 0.0)
        self.topic_stance[topic] = max(-1.0, min(1.0, current + delta))

    def shift_confidence(self, topic: str, delta: float) -> None:
        """Shift confidence by delta, clamped to [0, 1]."""
        current = self.topic_confidence.get(topic, 0.5)
        self.topic_confidence[topic] = max(0.0, min(1.0, current + delta))

    def to_dict(self) -> dict[str, Any]:
        return {
            "topic_stance": dict(self.topic_stance),
            "topic_confidence": dict(self.topic_confidence),
            "agent_trust": dict(self.agent_trust),
        }


@dataclass
class SwarmAgent:
    """One simulated persona in the swarm."""

    agent_id: str
    name: str
    persona_type: str       # "individual" or "institutional"
    background: str         # Rich backstory (1–3 sentences)
    stance_summary: str     # How this agent initially views the topic (1 sentence)
    belief: BeliefState
    post_history: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "agent_id": self.agent_id,
            "name": self.name,
            "persona_type": self.persona_type,
            "background": self.background,
            "stance_summary": self.stance_summary,
            "belief": self.belief.to_dict(),
            "post_history": list(self.post_history),
        }


@dataclass
class SimulationRound:
    """Result of one simulation round."""

    round_num: int
    posts: list[dict[str, Any]] = field(default_factory=list)
    belief_snapshots: dict[str, dict[str, Any]] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "round_num": self.round_num,
            "posts": list(self.posts),
            "belief_snapshots": dict(self.belief_snapshots),
        }


@dataclass
class SimulationReport:
    """Full simulation output."""

    document_summary: str
    topics: list[str]
    agents: list[SwarmAgent]
    rounds: list[SimulationRound]
    final_beliefs: dict[str, dict[str, Any]]
    consensus_topics: list[str]
    contested_topics: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "document_summary": self.document_summary,
            "topics": list(self.topics),
            "agents": [a.to_dict() for a in self.agents],
            "rounds": [r.to_dict() for r in self.rounds],
            "final_beliefs": dict(self.final_beliefs),
            "consensus_topics": list(self.consensus_topics),
            "contested_topics": list(self.contested_topics),
        }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _invoke_llm(llm: Any, messages: list[dict[str, str]]) -> str:
    """Call the LLM and extract content as a string."""
    result = llm.invoke(messages)
    if hasattr(result, "content"):
        return str(result.content)
    return str(result)


def _extract_json(text: str) -> Any:
    """Extract the first JSON object or array from arbitrary LLM output."""
    # Try direct parse first
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    # Find the first [...] or {...} block
    for pattern in (r"\[.*?\]", r"\{.*?\}"):
        match = re.search(pattern, text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                continue

    raise ValueError(f"No JSON found in LLM output: {text[:200]!r}")


# Stance shift heuristics: regex → delta
_STANCE_PATTERNS: list[tuple[re.Pattern[str], float]] = [
    (re.compile(r"\b(convinced|strongly agree|fully support|endorse|wholeheartedly)\b", re.I), 0.2),
    (re.compile(r"\b(agree|support|believe|favour|favor)\b", re.I), 0.1),
    (re.compile(r"\b(somewhat agree|lean toward|inclined to agree)\b", re.I), 0.05),
    (re.compile(r"\b(skeptical|doubt|uncertain|less sure|not convince)\b", re.I), -0.1),
    (re.compile(r"\b(disagree|oppose|reject|refute|challenge)\b", re.I), -0.1),
    (re.compile(r"\b(strongly disagree|firmly oppose|completely reject)\b", re.I), -0.2),
]


def _heuristic_stance_delta(text: str) -> float:
    """Return a net stance delta from post text using regex heuristics."""
    delta = 0.0
    for pattern, shift in _STANCE_PATTERNS:
        if pattern.search(text):
            delta += shift
    # Clamp total per-post shift to reasonable range
    return max(-0.3, min(0.3, delta))


# ---------------------------------------------------------------------------
# PersonaGenerator
# ---------------------------------------------------------------------------


class PersonaGenerator:
    """Generates SwarmAgent instances from document context using an LLM."""

    def __init__(self, llm: Any) -> None:
        self._llm = llm

    def generate_personas(
        self,
        context_text: str,
        n_personas: int = 8,
        topics: list[str] | None = None,
    ) -> list[SwarmAgent]:
        """Generate N diverse personas from document context.

        Uses LLM to generate personas in JSON format. Falls back to 3
        minimal generic personas on any LLM failure.
        """
        topics_str = ", ".join(topics) if topics else "the key topics in the document"
        context_snippet = context_text[:2000]

        system_prompt = (
            "You are a social simulation expert. "
            "Your role is to create realistic, diverse personas who would have opinions "
            "on the topics discussed in a provided document. "
            "Rules: no duplicate names, all personas must be plausible real-world actors, "
            "each must have a realistic background tied to the document domain. "
            f"Generate exactly {n_personas} personas covering a mix of individual and "
            "institutional types, with a spread of pro, con, and neutral stances."
        )

        user_prompt = (
            f"Document context (excerpt):\n{context_snippet}\n\n"
            f"Topics to form opinions about: {topics_str}\n\n"
            f"Generate {n_personas} diverse personas as a JSON array. "
            "Each element must have exactly these keys:\n"
            '  "name": string (full name or org name)\n'
            '  "type": "individual" or "institutional"\n'
            '  "background": string (1–3 sentences of realistic backstory)\n'
            '  "stance_summary": string (1 sentence on their initial view)\n'
            '  "initial_stances": object mapping each topic to a float in [-1.0, 1.0]\n\n'
            "Output only valid JSON, no markdown fences."
        )

        try:
            raw = _invoke_llm(
                self._llm,
                [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
            persona_data = _extract_json(raw)
            if not isinstance(persona_data, list):
                raise ValueError("Expected a JSON array of personas")

            agents: list[SwarmAgent] = []
            seen_names: set[str] = set()
            for item in persona_data:
                name = str(item.get("name", f"Agent-{uuid.uuid4().hex[:6]}"))
                if name in seen_names:
                    name = f"{name} ({uuid.uuid4().hex[:4]})"
                seen_names.add(name)

                initial_stances: dict[str, float] = {}
                for t, v in (item.get("initial_stances") or {}).items():
                    try:
                        initial_stances[str(t)] = max(-1.0, min(1.0, float(v)))
                    except (TypeError, ValueError):
                        initial_stances[str(t)] = 0.0

                # Initialise confidence at 0.5 for all topics
                initial_confidence = {t: 0.5 for t in (topics or list(initial_stances))}

                belief = BeliefState(
                    topic_stance=initial_stances,
                    topic_confidence=initial_confidence,
                    agent_trust={},
                )
                agents.append(
                    SwarmAgent(
                        agent_id=uuid.uuid4().hex,
                        name=name,
                        persona_type=str(item.get("type", "individual")),
                        background=str(item.get("background", "")),
                        stance_summary=str(item.get("stance_summary", "")),
                        belief=belief,
                    )
                )

            if not agents:
                raise ValueError("Persona list was empty after parsing")

            return agents

        except Exception as exc:  # noqa: BLE001
            _log.warning("PersonaGenerator LLM call failed (%s); using fallback personas", exc)
            return self._fallback_personas(topics or ["main topic"])

    @staticmethod
    def _fallback_personas(topics: list[str]) -> list[SwarmAgent]:
        stances = [
            ("Advocate", "individual", "A long-time proponent of reform in this area.", "Strongly supports change.", 0.7),
            ("Skeptic", "individual", "A cautious observer who questions rapid change.", "Doubts the proposed approach.", -0.5),
            ("Policy Institute", "institutional", "A think-tank focused on evidence-based policy.", "Neutral; seeks more data.", 0.0),
        ]
        agents = []
        for name, ptype, bg, ss, stance_val in stances:
            belief = BeliefState(
                topic_stance={t: stance_val for t in topics},
                topic_confidence={t: 0.5 for t in topics},
                agent_trust={},
            )
            agents.append(
                SwarmAgent(
                    agent_id=uuid.uuid4().hex,
                    name=name,
                    persona_type=ptype,
                    background=bg,
                    stance_summary=ss,
                    belief=belief,
                )
            )
        return agents


# ---------------------------------------------------------------------------
# SwarmSimulator
# ---------------------------------------------------------------------------


class SwarmSimulator:
    """Orchestrates multi-agent swarm simulation rounds."""

    def __init__(self, llm: Any, topics: list[str]) -> None:
        self._llm = llm
        self._topics = topics

    def run_round(
        self,
        agents: list[SwarmAgent],
        context_text: str,
        round_num: int,
    ) -> tuple[SimulationRound, list[dict[str, Any]]]:
        """Run exactly one simulation round.

        Returns:
            (SimulationRound, belief_shifts) where belief_shifts contains one entry
            per (agent, topic) pair whose stance shifted by >= 0.1.
        """
        context_snippet = context_text[:1500]
        round_posts: list[dict[str, Any]] = []
        belief_shifts: list[dict[str, Any]] = []

        for agent in agents:
            other_recent = [
                f"[{ag.name}]: {ag.post_history[-1]}"
                for ag in agents
                if ag.agent_id != agent.agent_id and ag.post_history
            ][-3:]

            social_ctx = "\n".join(other_recent) if other_recent else "(no prior posts yet)"
            topics_str = ", ".join(self._topics)
            stances_str = "; ".join(
                f"{t}: {agent.belief.topic_stance.get(t, 0.0):+.2f}"
                for t in self._topics
            )

            system_prompt = (
                f"You are {agent.name}, a {agent.persona_type}. "
                f"Background: {agent.background} "
                f"Your current view: {agent.stance_summary} "
                "Write a short, in-character reaction post (2–3 sentences) responding to "
                "the document context and recent discussion. Be specific and opinionated."
            )

            user_prompt = (
                f"Document context:\n{context_snippet}\n\n"
                f"Topics under discussion: {topics_str}\n"
                f"Your current stances: {stances_str}\n\n"
                f"Recent posts from others:\n{social_ctx}\n\n"
                "Write your reaction post now (2–3 sentences, no preamble):"
            )

            post_text = ""
            try:
                post_text = _invoke_llm(
                    self._llm,
                    [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                ).strip()
            except Exception as exc:  # noqa: BLE001
                _log.warning(
                    "Agent %s LLM call failed in round %d: %s", agent.name, round_num, exc
                )
                post_text = (
                    f"[{agent.name} has no response this round due to a technical issue.]"
                )

            delta = _heuristic_stance_delta(post_text)
            for topic in self._topics:
                if topic in agent.belief.topic_stance:
                    prev_stance = agent.belief.topic_stance[topic]
                    agent.belief.update_stance(topic, delta)
                    agent.belief.shift_confidence(topic, abs(delta) * 0.5)
                    if abs(delta) >= 0.1:
                        belief_shifts.append({
                            "agent_id": agent.agent_id,
                            "agent_name": agent.name,
                            "topic": topic,
                            "delta": round(delta, 3),
                            "prev_stance": round(prev_stance, 3),
                            "new_stance": round(agent.belief.topic_stance[topic], 3),
                        })

            agent.post_history.append(post_text)
            round_posts.append({
                "agent_id": agent.agent_id,
                "agent_name": agent.name,
                "text": post_text,
                "stance_shift": delta,
            })

        belief_snapshots = {ag.agent_id: ag.belief.to_dict() for ag in agents}
        sim_round = SimulationRound(
            round_num=round_num,
            posts=round_posts,
            belief_snapshots=belief_snapshots,
        )
        return sim_round, belief_shifts

    def run_simulation(
        self,
        agents: list[SwarmAgent],
        context_text: str,
        n_rounds: int = 4,
        progress_cb: Callable[[dict[str, Any]], None] | None = None,
    ) -> list[SimulationRound]:
        """Run N rounds of multi-agent simulation synchronously."""
        rounds: list[SimulationRound] = []
        for round_num in range(1, n_rounds + 1):
            if progress_cb:
                try:
                    progress_cb({"phase": "round", "round": round_num, "total": n_rounds})
                except Exception:  # noqa: BLE001
                    pass
            sim_round, _ = self.run_round(agents, context_text, round_num)
            rounds.append(sim_round)
        return rounds

    def _analyze_beliefs(
        self,
        agents: list[SwarmAgent],
        topics: list[str],
    ) -> tuple[list[str], list[str]]:
        """Return (consensus_topics, contested_topics)."""
        consensus: list[str] = []
        contested: list[str] = []

        for topic in topics:
            stances = [
                ag.belief.topic_stance.get(topic, 0.0)
                for ag in agents
            ]
            if not stances:
                continue

            mean_stance = sum(stances) / len(stances)
            if abs(mean_stance) > 0.4:
                consensus.append(topic)

            if len(stances) >= 2:
                try:
                    std_dev = statistics.stdev(stances)
                    if std_dev > 0.3:
                        contested.append(topic)
                except statistics.StatisticsError:
                    pass

        return consensus, contested


# ---------------------------------------------------------------------------
# Top-level pipeline
# ---------------------------------------------------------------------------


def run_swarm_simulation(
    *,
    context_text: str,
    settings: dict[str, Any],
    n_personas: int = 8,
    n_rounds: int = 4,
    topics: list[str] | None = None,
    progress_cb: Callable[[dict[str, Any]], None] | None = None,
) -> SimulationReport:
    """Full pipeline: extract topics → generate personas → simulate → report.

    Args:
        context_text: The raw text extracted from indexed documents.
        settings: METIS settings dict (for LLM creation).
        n_personas: Number of agents to simulate.
        n_rounds: Number of simulation rounds.
        topics: Optional list of topics to simulate beliefs around.
                If None, the LLM extracts 3-5 key topics from context_text.
        progress_cb: Optional callback for progress events.

    Returns:
        SimulationReport with full agent histories and belief trajectories.
    """
    llm = create_llm(settings)
    context_snippet = context_text[:2000]

    # ── 1. Extract topics if not provided ──────────────────────────────────
    if topics is None:
        _log.info("Extracting topics from context text")
        try:
            raw = _invoke_llm(
                llm,
                [
                    {
                        "role": "system",
                        "content": (
                            "You are a research analyst. Extract 3–5 key topics from the "
                            "provided document excerpt. Output only a JSON array of short "
                            "topic strings, e.g. [\"climate policy\", \"renewable energy\"]."
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"Document excerpt:\n{context_snippet}\n\nOutput JSON array:",
                    },
                ],
            )
            parsed = _extract_json(raw)
            if isinstance(parsed, list) and parsed:
                topics = [str(t) for t in parsed[:5]]
            else:
                topics = ["main topic"]
        except Exception as exc:  # noqa: BLE001
            _log.warning("Topic extraction failed (%s); using fallback", exc)
            topics = ["main topic"]

    # ── 2. Generate personas ───────────────────────────────────────────────
    if progress_cb:
        try:
            progress_cb(
                {"phase": "persona_generation", "detail": f"Generating {n_personas} personas..."}
            )
        except Exception:  # noqa: BLE001
            pass

    generator = PersonaGenerator(llm)
    agents = generator.generate_personas(context_text, n_personas=n_personas, topics=topics)

    # ── 3. Run simulation ──────────────────────────────────────────────────
    if progress_cb:
        try:
            progress_cb(
                {"phase": "simulation_start", "detail": f"Starting {n_rounds} rounds..."}
            )
        except Exception:  # noqa: BLE001
            pass

    simulator = SwarmSimulator(llm, topics)
    rounds = simulator.run_simulation(agents, context_text, n_rounds=n_rounds, progress_cb=progress_cb)

    # ── 4. Generate document summary ───────────────────────────────────────
    document_summary = ""
    try:
        raw_summary = _invoke_llm(
            llm,
            [
                {
                    "role": "system",
                    "content": "Summarise the following document in exactly 2 sentences.",
                },
                {"role": "user", "content": context_snippet},
            ],
        )
        document_summary = raw_summary.strip()
    except Exception as exc:  # noqa: BLE001
        _log.warning("Document summary LLM call failed (%s)", exc)
        document_summary = "Summary unavailable."

    # ── 5. Analyse final beliefs ───────────────────────────────────────────
    consensus_topics, contested_topics = simulator._analyze_beliefs(agents, topics)
    final_beliefs = {ag.agent_id: ag.belief.to_dict() for ag in agents}

    return SimulationReport(
        document_summary=document_summary,
        topics=topics,
        agents=agents,
        rounds=rounds,
        final_beliefs=final_beliefs,
        consensus_topics=consensus_topics,
        contested_topics=contested_topics,
    )


def stream_swarm_simulation(
    *,
    context_text: str,
    settings: dict[str, Any],
    n_personas: int = 8,
    n_rounds: int = 4,
    topics: list[str] | None = None,
) -> Iterator[dict[str, Any]]:
    """Generator version of run_swarm_simulation — yields fine-grained progress events.

    Event shapes (inner ``event`` key distinguishes them):
      {"event": "topics_extracted",       "topics": [str, ...]}
      {"event": "persona_created",        "agent": dict}           # one per agent
      {"event": "simulation_round_start", "round": int, "total": int}
      {"event": "belief_shift",           "agent_id": str, "agent_name": str,
                                          "topic": str, "delta": float,
                                          "prev_stance": float, "new_stance": float}
      {"event": "simulation_round",       "round": dict}           # SimulationRound.to_dict()
      {"event": "simulation_complete",    "report": dict}          # SimulationReport.to_dict()
    """
    llm = create_llm(settings)
    context_snippet = context_text[:2000]

    # ── 1. Extract topics ──────────────────────────────────────────────────
    if topics is None:
        try:
            raw = _invoke_llm(
                llm,
                [
                    {
                        "role": "system",
                        "content": (
                            "You are a research analyst. Extract 3–5 key topics from the "
                            "provided document excerpt. Output only a JSON array of short "
                            'topic strings, e.g. ["climate policy", "renewable energy"].'
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"Document excerpt:\n{context_snippet}\n\nOutput JSON array:",
                    },
                ],
            )
            parsed = _extract_json(raw)
            topics = [str(t) for t in parsed[:5]] if isinstance(parsed, list) and parsed else ["main topic"]
        except Exception as exc:  # noqa: BLE001
            _log.warning("Topic extraction failed (%s); using fallback", exc)
            topics = ["main topic"]

    yield {"event": "topics_extracted", "topics": topics}

    # ── 2. Generate personas one by one ────────────────────────────────────
    generator = PersonaGenerator(llm)
    agents = generator.generate_personas(context_text, n_personas=n_personas, topics=topics)
    for agent in agents:
        yield {"event": "persona_created", "agent": agent.to_dict()}

    # ── 3. Simulate rounds one at a time ───────────────────────────────────
    simulator = SwarmSimulator(llm, topics)
    rounds: list[SimulationRound] = []

    for round_num in range(1, n_rounds + 1):
        yield {"event": "simulation_round_start", "round": round_num, "total": n_rounds}
        sim_round, belief_shifts = simulator.run_round(agents, context_text, round_num)
        rounds.append(sim_round)
        for shift in belief_shifts:
            yield {"event": "belief_shift", **shift}
        yield {"event": "simulation_round", "round": sim_round.to_dict()}

    # ── 4. Document summary ────────────────────────────────────────────────
    document_summary = "Summary unavailable."
    try:
        document_summary = _invoke_llm(
            llm,
            [
                {"role": "system", "content": "Summarise the following document in exactly 2 sentences."},
                {"role": "user", "content": context_snippet},
            ],
        ).strip()
    except Exception as exc:  # noqa: BLE001
        _log.warning("Document summary LLM call failed (%s)", exc)

    # ── 5. Analyse beliefs and emit final report ───────────────────────────
    consensus_topics, contested_topics = simulator._analyze_beliefs(agents, topics)
    final_beliefs = {ag.agent_id: ag.belief.to_dict() for ag in agents}

    report = SimulationReport(
        document_summary=document_summary,
        topics=topics,
        agents=agents,
        rounds=rounds,
        final_beliefs=final_beliefs,
        consensus_topics=consensus_topics,
        contested_topics=contested_topics,
    )
    yield {"event": "simulation_complete", "report": report.to_dict()}


__all__ = [
    "BeliefState",
    "PersonaGenerator",
    "SimulationReport",
    "SimulationRound",
    "SwarmAgent",
    "SwarmSimulator",
    "run_swarm_simulation",
    "stream_swarm_simulation",
]
