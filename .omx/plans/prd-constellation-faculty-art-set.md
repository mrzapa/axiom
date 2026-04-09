# PRD: Constellation Faculty Art Set

## Goal
Ship a complete set of faculty images for the METIS landing constellation so the main orbit and faculty detail dialog feel mythic, legible, and visually distinctive.

## User stories

### US-001 Faculty artwork exists
As a user exploring the constellation, I want every faculty to have its own representative art so the orbit feels like a coherent mythic system instead of abstract nodes alone.

Acceptance criteria:
- One asset exists for each faculty id.
- Assets share a consistent celestial/Skyrim-like visual language.
- Assets are stored in the web app and referenced by the faculty art manifest.

### US-002 Landing page uses artwork
As a user on the landing page, I want the faculty art to appear by default behind each faculty scaffold so the constellation feels alive before interaction.

Acceptance criteria:
- Landing canvas renders faculty art behind existing edges/stars/labels.
- Hover/selection/RAG states increase visibility without harming readability.
- Missing assets degrade gracefully to the shape-only state.

### US-003 Detail panel surfaces faculty art
As a user inspecting a faculty or star, I want the selected faculty art to be visible in the details panel so the artwork is readable outside the crowded orbit view.

Acceptance criteria:
- The details dialog shows the selected faculty art in a dedicated panel.
- The active faculty is resolved from explicit faculty id first, then orbital inference.

### US-004 Verification is reproducible
As a maintainer, I want a deterministic check that faculty-art assets and manifest entries remain complete so future edits do not silently break the feature.

Acceptance criteria:
- Automated test checks manifest coverage and file existence.
- Frontend capture is possible on the running app for manual verification.
