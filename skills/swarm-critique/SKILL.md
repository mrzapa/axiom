---
id: swarm-critique
name: Swarm Critique
description: Multi-voice adversarial critique — generate diverse personas and simulate their reactions to the indexed content.
enabled_by_default: false
priority: 90
triggers:
  keywords:
    - swarm critique
    - simulate reactions
    - stakeholder analysis
    - adversarial review
    - public reaction
    - impact simulation
    - persona critique
    - who would object
    - stress test
  modes:
    - Simulation
    - Research
  file_types:
    - .pdf
    - .docx
    - .md
    - .txt
    - .html
  output_styles:
    - Structured report
    - Detailed answer
runtime_overrides:
  selected_mode: Simulation
  retrieval_k: 30
  top_k: 8
  mmr_lambda: 0.45
  retrieval_mode: hierarchical
  agentic_mode: false
  swarm_n_personas: 8
  swarm_n_rounds: 4
  output_style: Structured report
  system_instructions_append: >
    Generate 8 diverse personas from the document context (mix of supporters,
    skeptics, experts, affected parties, institutional actors). Run 4 rounds of
    simulation where each persona posts a reaction. Track how beliefs shift.
    Report: which topics reached consensus, which remained contested, and what
    the strongest arguments on each side were.
  citation_policy_append: Every claim attributed to a persona must trace back to document evidence or be marked as simulated inference.
---
Use this skill when you need adversarial stress-testing, stakeholder impact modelling, or multi-perspective critique of a document.

The skill generates realistic AI personas grounded in the document's named entities and context, then simulates their public reactions over multiple rounds — showing who agrees, who objects, and how arguments evolve.

**Best for:**
- Policy drafts (simulate constituent reactions)
- Press releases (simulate journalist/critic/supporter responses)
- Financial reports (simulate investor/analyst/regulator perspectives)
- Research papers (simulate peer reviewers from different schools of thought)
