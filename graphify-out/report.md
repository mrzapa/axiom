# Graph Report - metis_app/  (2026-04-09)

## Corpus Check
- 132 files · ~129,742 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2511 nodes · 8321 edges · 115 communities detected
- Extraction: 30% EXTRACTED · 70% INFERRED · 0% AMBIGUOUS · INFERRED: 5859 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `EvidenceSource` - 196 edges
2. `SessionDetail` - 163 edges
3. `NyxCatalogComponentDetail` - 160 edges
4. `SessionSummary` - 157 edges
5. `NyxCatalogSearchResult` - 153 edges
6. `AppController` - 134 edges
7. `WorkspaceOrchestrator` - 127 edges
8. `SessionMessage` - 122 edges
9. `SessionFeedback` - 122 edges
10. `ForecastMapping` - 122 edges

## Surprising Connections (you probably didn't know these)
- `Log and metrics endpoints.` --uses--> `TraceStore`  [INFERRED]
  metis_app\api_litestar\routes\logs.py → metis_app\services\trace_store.py
- `Return the last 200 lines of metis.log with secrets redacted.      The log pat` --uses--> `TraceStore`  [INFERRED]
  metis_app\api\logs.py → metis_app\services\trace_store.py
- `Return aggregated trace-event metrics (counts by type, status, and duration).` --uses--> `TraceStore`  [INFERRED]
  metis_app\api\logs.py → metis_app\services\trace_store.py
- `Shared Litestar API helpers.` --uses--> `SessionRepository`  [INFERRED]
  metis_app\api_litestar\common.py → metis_app\services\session_repository.py
- `metis_app.models.app_model — Central application state.  AppModel is the singl` --uses--> `BrainGraph`  [INFERRED]
  metis_app\models\app_model.py → metis_app\models\brain_graph.py

## Hyperedges (group relationships)
- **Settings & Config Management Hub** — settings_store_module, config_constants, api_settings [EXTRACTED 1.00]
- **API Route Module Orchestration** — api_fastapi_app, api_sessions, api_settings, api_atlas, api_assistant [EXTRACTED 1.00]
- **Workspace-Aware Features** — api_atlas, api_assistant, api_autonomous, api_improvements [INFERRED 0.80]
- **Session Management API Surface** — route_list_sessions, route_create_session, route_get_session, route_submit_feedback, route_delete_session [EXTRACTED 0.95]
- **SSE Streaming Build Operations** — route_api_build_index_stream, route_api_build_web_graph_stream, route_trigger_autonomous_research_stream [EXTRACTED 0.90]
- **Query Orchestration API Surface** — route_api_query_rag, route_api_search_knowledge, route_api_query_direct [EXTRACTED 0.90]
- **GGUF Model Management API Surface** — route_list_catalog, route_get_hardware, route_list_installed, route_validate_model, route_refresh_catalog [EXTRACTED 0.85]
- **Assistant State & Memory Management** — route_get_assistant, route_update_assistant, route_get_assistant_status, route_reflect_assistant, route_list_assistant_memory, route_clear_assistant_memory [EXTRACTED 0.90]
- **Knowledge Artifact Management API** — route_get_atlas_candidate, route_save_atlas_entry, route_decide_atlas_candidate, route_list_atlas_entries, route_get_atlas_entry [EXTRACTED 0.85]
- **Autonomous Research Triggering** — route_get_autonomous_status, route_trigger_autonomous_research, route_trigger_autonomous_research_stream [EXTRACTED 0.90]
- **Settings & Feature Control API** — route_get_settings, route_post_settings, route_list_features, route_disable_feature, route_enable_feature [EXTRACTED 0.85]
- **Improvement & Artifact Tracking** — route_list_improvement_entries, route_get_improvement_entry, route_create_improvement_entry [EXTRACTED 0.80]
- **Observability & Trace Analysis** — route_get_discover, route_get_trace_feedback, route_get_run_semantic, route_post_trace_feedback, route_export_run_as_skill, route_export_run_as_eval [EXTRACTED 0.80]
- **RAG Query Pipeline** — indexing_IndexBuildRequest, indexing_IndexBuildResult, querying_RagQueryRequest, querying_RagQueryResult, streaming_stream_rag_answer, session_types_EvidenceSource [EXTRACTED 1.00]
- **METIS Companion Runtime** — assistant_types_AssistantIdentity, assistant_types_AssistantRuntime, assistant_types_AssistantPolicy, assistant_types_AssistantStatus [EXTRACTED 1.00]
- **Brain Graph Composite** — brain_graph_BrainGraph, brain_graph_BrainNode, brain_graph_BrainEdge [EXTRACTED 1.00]
- **Reflection & Introspection Pipeline** — assistant_companion_AssistantCompanionService, behavior_discovery_BehaviorDiscoveryService, trace_event_schema_EventType, artifact_converter_ArtifactConverter [INFERRED 0.85]
- **Document Indexing & Retrieval Pipeline** — index_service_orchestrator, brain_pass_placement, knowledge_cache_QueryResultCache, grep_retriever_GrepRetriever, hybrid_scorer_hybrid_rerank [INFERRED 0.90]
- **Autonomous Research & Constellation Growth** — autonomous_research_AutonomousResearchService, comet_decision_engine_CometDecisionEngine, index_service_orchestrator, artifact_converter_ArtifactConverter, atlas_repository_AtlasRepository [INFERRED 0.80]
- **RAG End-to-End Flow (Retrieval → Rerank → Response)** — retrieval_pipeline_RetrievalPlan, reranker_hybrid_rerank, response_pipeline_PipelineResult [EXTRACTED 0.95]
- **Stream Event Lifecycle (Emit → Normalize → Persist → Replay)** — stream_events_normalize_stream_event, stream_replay_StreamReplayEvent, trace_store_audit_log [EXTRACTED 0.90]
- **Evidence Augmentation & Sampling (Chunking → Sampling → Absorption)** — semantic_chunker_chunk_text_semantic, monte_carlo_sampler_mces, news_ingest_service_ingest [INFERRED 0.75]
- **Multi-Agent Response Synthesis (Swarm Simulation → Summary → Response)** — swarm_service_SwarmAgent, summary_service_generate_document_summary, response_pipeline_PipelineResult [INFERRED 0.70]
- **Nyx Intent & Artifact Flow (Runtime Detection → Catalog → Installation)** — nyx_runtime_NyxRuntime, nyx_catalog_NyxCatalogBroker, response_pipeline_PipelineResult [INFERRED 0.80]
- **LLM Provider Stack** — llm_providers_create_llm, llm_providers_PooledLLM, llm_providers_MockChatModel, llm_providers_LocalLlamaCppChatModel, llm_backends_LocalGGUFBackend, model_caps_get_capped_output_tokens [EXTRACTED 0.95]
- **Embedding Provider Stack** — embedding_providers_create_embeddings, embedding_providers_LocalSentenceTransformerEmbeddings, mock_embeddings_MockEmbeddings, vector_store_VectorStoreAdapter [EXTRACTED 0.92]
- **Vector Store Adapter Layer** — vector_store_VectorStoreAdapter, vector_store_JsonVectorStoreAdapter, vector_store_ChromaVectorStoreAdapter, vector_store_normalize_weaviate_settings [EXTRACTED 0.98]

## Communities

### Community 0 - "AssistantPolicy, .to_payload() +243 more"
Cohesion: 0.04
Nodes (115): AssistantPolicy, AtlasRepository, Persist Atlas candidate/save decisions in the shared session database., AtlasEntry, get_autonomous_status(), Autonomous research endpoints., Return current autonomous research configuration., Manually trigger one autonomous research cycle (dev/test use). (+107 more)

### Community 1 - "metis_app.controllers.app_controller — Top-level application controller.  AppC, Bind view widgets to controller callbacks. +203 more"
Cohesion: 0.03
Nodes (140): metis_app.controllers.app_controller — Top-level application controller.  AppC, Bind view widgets to controller callbacks., Keep runtime canonical chat mode state in the model settings., Synchronize profiles, indexes, local models, and startup mode., Mediates between AppModel and AppView.      Parameters     ----------     mo, Submit *fn* to the background runner., Signal the active background task to stop (cooperative)., Tear down the thread pool. (+132 more)

### Community 2 - "Experimental Litestar app factory.  This is a shadow port of the METIS FastAPI, Enforce Bearer-token auth when METIS_API_TOKEN is set.      When the environme +199 more"
Cohesion: 0.11
Nodes (177): Experimental Litestar app factory.  This is a shadow port of the METIS FastAPI, Enforce Bearer-token auth when METIS_API_TOKEN is set.      When the environme, Assistant companion endpoints., Get current nourishment state., Get the companion's personality evolution state., Report a star event to the companion.      This triggers the nourishment state, _StarEventBody, Atlas candidate and saved-entry routes. (+169 more)

### Community 3 - "ABC, AtlasEntry +199 more"
Cohesion: 0.02
Nodes (145): ABC, AtlasEntry, LocalSentenceTransformerEmbeddings, create_embeddings(), _create_google_embeddings(), _create_hf_embeddings(), _create_openai_embeddings(), _create_st_embeddings() (+137 more)

### Community 4 - "assistant.py, bootstrap_assistant() +183 more"
Cohesion: 0.03
Nodes (103): AssistantCompanionService, _parse_iso(), Companion bootstrap, reflection, and snapshot logic., Compute current nourishment state from settings star data., Inner implementation, called only when recursion guard allows., Own the local-first companion state and reflection loop., Save a successful agentic run as a skill candidate if it meets quality threshold, LLM-judge unreviewed skill candidates and promote generalizable ones to .md file (+95 more)

### Community 5 - "app_controller.py, AppController +131 more"
Cohesion: 0.05
Nodes (14): AppController, _chunk_text(), _configure_command(), _connect_signal(), _flatten_trace_events(), _import_plan_from_payload(), _latest_completed_assistant_run(), _loaded_skills_text() (+6 more)

### Community 6 - "artifact_converter.py, ArtifactConverter +92 more"
Cohesion: 0.04
Nodes (54): ArtifactConverter, Semantic Observability — convert human-labeled trace runs into durable artifacts, Package a run as a golden eval case and append to evals/golden_dataset.jsonl., Convert labeled trace runs into reusable METIS artifacts., Derive a SKILL.md from a reinforce-labeled run's behavioral profile., _utc_now(), BehaviorDiscoveryService, BehaviorProfile (+46 more)

### Community 7 - "llm_providers.py, LocalLlamaCppChatModel +83 more"
Cohesion: 0.04
Nodes (67): LocalLlamaCppChatModel, MockChatModel, PooledLLM, _ChatMessage, clear_llm_cache(), _create_anthropic(), _create_google(), create_llm() (+59 more)

### Community 8 - "comet_decision_engine.py, CometDecisionEngine +79 more"
Cohesion: 0.06
Nodes (60): CometDecisionEngine, Comet decision engine — scores news comets against faculty gaps and decides drif, Evaluate a batch of comet events and return them with decisions filled in., Score comet events and decide whether METIS should engage.      Decision thres, Return a 0-1 gap score per faculty.  Faculties with fewer indexed         stars, Compute a composite relevance score [0, 1] for a comet event.          Combine, Score and decide the outcome for a single comet event (in-place mutation)., CometEvent (+52 more)

### Community 9 - "nyx_catalog.py, _apply_curated_component_overrides() +79 more"
Cohesion: 0.06
Nodes (61): _apply_curated_component_overrides(), _configured_curated_catalog_path(), _curated_components_from_snapshot(), CuratedNyxComponent, _dedupe_strings(), get_default_nyx_catalog_broker(), _humanize_component_name(), _is_snapshot_payload() (+53 more)

### Community 10 - "App State KV Store, Assistant Companion Routes +68 more"
Cohesion: 0.04
Nodes (57): App State KV Store, Assistant Companion Routes, Atlas Entry Routes, Autonomous Research Endpoints, News Comet Features, FastAPI Surface, Feature Flag Kill-Switch, GGUF Model Management (+49 more)

### Community 11 - "monte_carlo_sampler.py, apply_mces() +59 more"
Cohesion: 0.05
Nodes (57): apply_mces(), _cosine_sim(), _gaussian_samples(), Monte Carlo Evidence Sampling (MCES), Lightweight Monte Carlo Evidence Sampling (MCES) for METIS.  Inspired by sirch, Phase 2 — Gaussian draws around anchors plus exploration., Phase 3 — score probe windows.      Uses embedding cosine similarity when embe, Return the best ROI window from *doc* for *query*.      For small documents ( (+49 more)

### Community 12 - "brain_pass.py, _aggregate_native_analyses() +52 more"
Cohesion: 0.08
Nodes (50): _aggregate_native_analyses(), _apply_keyword_scores(), _apply_modality_priors(), _apply_roi_scores(), _brain_pass_temp_dir(), BrainPassResult, _build_tribev2_transcript_loader(), detect_source_modality() (+42 more)

### Community 13 - "Enum, feature_flags.py +47 more"
Cohesion: 0.06
Nodes (45): Enum, clear_kill_switch(), disable_feature_for_duration(), FeatureStatus, _flag_overrides(), get_feature_statuses(), _is_kill_switch_active(), _kill_switches() (+37 more)

### Community 14 - "app_state.py, AppStateEntry +43 more"
Cohesion: 0.08
Nodes (35): AppStateEntry, AppStateSetRequest, AppStateSetResponse, delete_app_state(), get_app_state_service(), _get_service(), list_app_state(), poll() (+27 more)

### Community 15 - "swarm_service.py, BeliefState +41 more"
Cohesion: 0.08
Nodes (30): BeliefState, _extract_json(), _fallback_personas(), _heuristic_stance_delta(), _invoke_llm(), PersonaGenerator, Swarm simulation service for METIS.  Implements multi-agent persona simulation, Full simulation output. (+22 more)

### Community 16 - "parity_types.py, AgentProfile +40 more"
Cohesion: 0.07
Nodes (24): AgentProfile, create(), from_payload(), Typed records used by the MVC parity layer., Profile definition compatible with monolith JSON profile files., Monolith-compatible trace event persisted as JSON lines.      Trace events fol, TraceEvent, utc_now_iso() (+16 more)

### Community 17 - "knowledge_graph.py, KnowledgeGraph +29 more"
Cohesion: 0.11
Nodes (25): KnowledgeGraph, build_knowledge_graph(), canonicalize_entity(), chunk_text(), collect_graph_chunk_candidates(), extract_entities_and_relations(), _extract_entities_spacy(), extract_query_entities() (+17 more)

### Community 18 - "forecast_service.py, _downsample_points() +28 more"
Cohesion: 0.15
Nodes (14): _downsample_points(), ForecastService, _format_timestamp(), _format_value(), from_payload(), _LoadedTable, _module_available(), _PreparedDataset (+6 more)

### Community 19 - "stream_replay.py, _artifact_metadata_only() +27 more"
Cohesion: 0.12
Nodes (12): _artifact_metadata_only(), from_payload(), _loaded_state(), _normalize_json_value(), _normalize_stream_payload(), Canonical SSE event persistence and best-effort replay helpers., Persist canonical SSE events in per-run JSONL files., Coordinate live canonical SSE production with disk-backed replay. (+4 more)

### Community 20 - "learning_route_service.py, _build_fallback_objective() +23 more"
Cohesion: 0.17
Nodes (22): _build_fallback_objective(), _build_fallback_preview(), _build_fallback_rationale(), _build_fallback_step_title(), _build_fallback_tutor_prompt(), _build_llm_preview(), _build_manifest_candidates(), _extract_json_object() (+14 more)

### Community 21 - "nyx_catalog_refresh.py, _audit_registry_item() +23 more"
Cohesion: 0.18
Nodes (24): _audit_registry_item(), _audit_target_paths(), _build_local_registry_fetcher(), build_nyx_catalog_snapshot(), build_nyx_registry_fetcher(), _build_summary_lines(), _dedupe_strings(), _humanize_component_name() (+16 more)

### Community 22 - "settings_store.py, AppSettings +22 more"
Cohesion: 0.1
Nodes (23): AppSettings, AssistantIdentitySettings, AssistantPolicySettings, AssistantRuntimeSettings, _atomic_write(), load_settings(), _migrate_v1_to_current(), Non-UI helper for loading and saving METIS settings JSON files.  This module i (+15 more)

### Community 23 - "atlas_repository.py, ._ensure_ready() +22 more"
Cohesion: 0.16
Nodes (11): _build_markdown_document(), _connect(), _entry_from_row(), _entry_row(), _format_saved_at(), _json_dumps(), _json_load(), SQLite-backed persistence and markdown materialization for Atlas entries. (+3 more)

### Community 24 - "querying.py, arrow_artifacts_enabled() +21 more"
Cohesion: 0.18
Nodes (22): arrow_artifacts_enabled(), _encode_json_size(), extract_arrow_artifacts(), _is_nyx_artifact(), knowledge_search(), _knowledge_search_summary(), _normalize_arrow_artifact(), _normalize_json_value() (+14 more)

### Community 25 - "response_pipeline.py, apply_claim_level_grounding() +21 more"
Cohesion: 0.16
Nodes (19): apply_claim_level_grounding(), _best_source_label(), build_source_cards(), _claim_tokens(), _compose_pipeline_system_prompt(), extract_json_payload(), _extract_source_labels(), is_one_shot_learning_request() (+11 more)

### Community 26 - "core.py, api_brain_graph() +17 more"
Cohesion: 0.14
Nodes (9): api_brain_graph(), api_brain_scaffold(), api_run_action(), _append_nyx_install_action_event(), _brain_graph_cache_key(), _build_graph_payload(), _looks_like_nyx_action_reference(), _nyx_install_http_status() (+1 more)

### Community 27 - "runtime_resolution.py, _append_overrides() +17 more"
Cohesion: 0.18
Nodes (13): _append_overrides(), build_capability_index(), _build_nourishment_block(), build_system_prompt(), _file_type_score(), is_evidence_pack_query(), _keyword_score(), _list_intersection_score() (+5 more)

### Community 28 - "gguf_serialization.py, build_recommendation_summary() +16 more"
Cohesion: 0.14
Nodes (17): build_recommendation_summary(), extract_caveats(), GgufPathValidationResult, hardware_payload_from_recommender(), is_caveat(), Shared GGUF serialization logic for FastAPI and Litestar routes., Normalize a detected hardware profile into the GGUF hardware response contract., Detect hardware using the recommender and return normalized payload. (+9 more)

### Community 29 - "document_loader.py, batch_extract_pdfs() +16 more"
Cohesion: 0.13
Nodes (14): batch_extract_pdfs(), is_kreuzberg_available(), is_opendataloader_available(), load_document(), metis_app.utils.document_loader — Format-aware document text extraction.  Uses, Batch-extract PDFs with opendataloader-pdf using a single JVM startup.      Pa, Extract text from *path* using the best available method.      Parameters, Return ``True`` if kreuzberg is installed and importable. (+6 more)

### Community 30 - "cli.py, _build_parser() +15 more"
Cohesion: 0.33
Nodes (16): _build_parser(), _build_session_skill_state(), cmd_index(), cmd_query(), cmd_skills_disable(), cmd_skills_enable(), cmd_skills_lint(), cmd_skills_list() (+8 more)

### Community 31 - "grep_retriever.py, extract_keywords() +14 more"
Cohesion: 0.13
Nodes (15): extract_keywords(), is_rga_available(), map_hits_to_chunks(), _parse_rga_stdout(), rga (ripgrep-all) based supplementary retriever for METIS.  Implements ``GrepR, Run ``rga --json`` and return parsed match dicts.      ``FileNotFoundError`` (, Async wrapper around :func:`run_rga` using ``asyncio.to_thread``., Map rga matches to chunk indices via file_path proximity.      For each hit we (+7 more)

### Community 32 - "topo_scaffold.py, _build_tree_adjacency() +13 more"
Cohesion: 0.24
Nodes (10): _build_tree_adjacency(), _build_weight_lookup(), compute_scaffold(), _find_tree_path(), _norm_edge(), PersistencePair, Topological scaffold utilities for weighted BrainGraph structures.  This modul, Compute graph-topology scaffold metrics for a BrainGraph. (+2 more)

### Community 33 - "Web Research & Synthesis Pipeline, Brain-Inspired Faculty Placement +11 more"
Cohesion: 0.18
Nodes (12): Web Research & Synthesis Pipeline, Brain-Inspired Faculty Placement, Comet Relevance Scoring, rga-backed Keyword Retriever, BM25 + Vector Alpha-Blend Scorer, _minmax(), Hybrid BM25 + vector score blending for METIS retrieval.  Ported from Onyx's alp, Min-max normalise *values* to the [0, 1] range.      If all values are equal, re (+4 more)

### Community 34 - "star_archetype.py, _csv_column_consistency() +11 more"
Cohesion: 0.19
Nodes (12): _csv_column_consistency(), detect_archetypes(), get_archetype(), Star Archetype detection — recommends an indexing personality for uploaded conte, Return the first `max_bytes` of a file as a string. Never raises., Return a score per archetype ID for a single file., True if the first 5 non-empty lines have roughly the same comma count (≥3)., Analyse `file_paths` and return up to 4 ranked archetype candidates.      File (+4 more)

### Community 35 - "__main__.py, _acquire_lock() +9 more"
Cohesion: 0.24
Nodes (10): _acquire_lock(), _find_free_port(), main(), _port_from_settings(), CLI launcher for the local METIS FastAPI app.  Concurrency notes:   - Uses an, Bind to port 0 and let the OS assign a free port., Acquire single-instance lock using atomic O_EXCL file creation.      Returns T, Release the single-instance lock. (+2 more)

### Community 36 - "query.py, api_forecast_preflight() +9 more"
Cohesion: 0.18
Nodes (0): 

### Community 37 - "improvement_types.py, _coerce_json_object() +9 more"
Cohesion: 0.42
Nodes (10): _coerce_json_object(), _coerce_str_list(), create(), from_payload(), from_row(), improvement_now_iso(), _normalize_artifact_type(), _normalize_status() (+2 more)

### Community 38 - "features.py, disable_feature() +8 more"
Cohesion: 0.24
Nodes (9): disable_feature(), enable_feature(), FeatureEnableRequest, FeatureKillSwitchRequest, list_features(), Feature flag endpoints., Return effective status for all known feature flags., Disable a feature immediately, optionally for a fixed duration. (+1 more)

### Community 39 - "llm_backends.py, config() +8 more"
Cohesion: 0.2
Nodes (6): LocalGGUFBackend, LocalGGUFConfig, LLM backend adapters used by the controller.  This module intentionally keeps, Configuration for a local llama.cpp-style GGUF model., Thin adapter around ``llama_cpp.Llama`` for text completion., Run a non-chat completion and return rendered assistant text.

### Community 40 - "sessions.py, _action_identity() +7 more"
Cohesion: 0.39
Nodes (8): _action_identity(), _build_action_result(), delete_session(), get_session(), get_session_repo(), _hydrate_session_actions(), _list_string_values(), _session_run_ids()

### Community 41 - "settings.py, get_settings() +7 more"
Cohesion: 0.28
Nodes (8): get_settings(), post_settings(), GET /v1/settings and POST /v1/settings endpoints., Return active settings with api_key_* fields redacted., Accept partial settings updates and persist them., Return the active settings profile with ``api_key_*`` fields redacted., Accept a partial settings update and persist it to settings.json.      Securit, SettingsUpdateRequest

### Community 42 - "runs.py, make_run_id() +7 more"
Cohesion: 0.28
Nodes (4): _normalize_json_value(), _normalize_payload(), UI-neutral run event primitives., RunEvent

### Community 43 - "Session Repository (SQLite Persistence), stream_events.py +7 more"
Cohesion: 0.31
Nodes (8): Session Repository (SQLite Persistence), _deterministic_event_id(), Stream Event Normalization (AG-UI envelope), Helpers for additive normalization of streamed chat events.  The normalization, Return *event* with additive normalized envelope metadata.      Existing field, _utc_now_iso(), Stream Replay (SSE Event Persistence), Trace Store (Audit Log & Event Persistence)

### Community 44 - "Trace-to-Artifact Converter, Companion Reflection & State +7 more"
Cohesion: 0.22
Nodes (9): Trace-to-Artifact Converter, Companion Reflection & State, Companion SQLite Persistence, Semantic Observability & Behavior Discovery, GGUF Validation & Serialization, Heretic Abliteration Pipeline, Hardware-Aware GGUF Recommender, Local Model Registry Normalization (+1 more)

### Community 45 - "atlas_types.py, atlas_now_iso() +6 more"
Cohesion: 0.54
Nodes (7): atlas_now_iso(), _coerce_float(), _coerce_int(), create_candidate(), from_payload(), Typed records for companion-suggested Atlas entries., slugify_atlas_title()

### Community 46 - "sht.py, build_sht_tree() +6 more"
Cohesion: 0.29
Nodes (4): build_sht_tree(), metis_app.models.sht — Structure-Header Tree (SHT) builder.  Provides a pure-P, Build a structure-header tree (SHT) from headers + spans.      Rules applied:, SHTNode

### Community 47 - "logs.py, get_log_tail() +5 more"
Cohesion: 0.33
Nodes (6): get_log_tail(), get_trace_metrics(), Log and metrics endpoints., Return the last 200 lines of metis.log with secrets redacted.      The log pat, Return aggregated trace-event metrics (counts by type, status, and duration)., _redact()

### Community 48 - "audit.py, build_audit_command() +4 more"
Cohesion: 0.47
Nodes (5): build_audit_command(), build_audit_env(), main(), Parity audit entrypoint for the MVC runtime., Run the parity audit suite and return its exit code.

### Community 49 - "config.py, Config +4 more"
Cohesion: 0.33
Nodes (5): Config, _load_version(), metis_app.config — Application-wide configuration constants and Config dataclass, Load version from VERSION file, fallback to '0.0.0' if missing., Runtime configuration for the METIS application.      All fields are optional

### Community 50 - "atlas.py, decide_atlas_candidate() +4 more"
Cohesion: 0.33
Nodes (0): 

### Community 51 - "web_graph.py, api_build_web_graph() +4 more"
Cohesion: 0.33
Nodes (5): api_build_web_graph(), api_build_web_graph_stream(), Web graph index build endpoints., Build a wikilinked knowledge-graph index from web sources., Build a web-graph index and stream progress events over SSE.

### Community 52 - "model_presets.py, get_llm_model_presets() +4 more"
Cohesion: 0.4
Nodes (3): provider_requires_custom_model(), Shared LLM provider/model preset helpers for the GUI., uses_custom_model_value()

### Community 53 - "improvements.py, create_improvement_entry() +3 more"
Cohesion: 0.4
Nodes (1): Improvement-pipeline endpoints.

### Community 54 - "AppController, AppModel +3 more"
Cohesion: 0.4
Nodes (5): AppController, AppModel, BrainEdge, BrainGraph, BrainNode

### Community 55 - "healthz.py, healthz() +2 more"
Cohesion: 0.5
Nodes (3): healthz(), Health check endpoint., Health check endpoint.

### Community 56 - "dependency_bootstrap.py, install_packages() +2 more"
Cohesion: 0.5
Nodes (3): install_packages(), Helpers for explicit dependency installation flows., Install *packages* with pip and emit optional progress lines.

### Community 57 - "AssistantIdentity, AssistantPolicy +2 more"
Cohesion: 0.5
Nodes (4): AssistantIdentity, AssistantPolicy, AssistantRuntime, AssistantStatus

### Community 58 - "get_assistant, get_assistant_status +1 more"
Cohesion: 0.67
Nodes (3): get_assistant, get_assistant_status, get_autonomous_status

### Community 59 - "FacultyNourishment, StarEvent +1 more"
Cohesion: 0.67
Nodes (3): FacultyNourishment, StarEvent, TopologySignal

### Community 60 - "App State SQLite Store, Atlas Entry Persistence +1 more"
Cohesion: 0.67
Nodes (3): App State SQLite Store, Atlas Entry Persistence, Improvement Artifact Persistence

### Community 61 - "version.py, api_version()"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "list_catalog, list_installed"
Cohesion: 1.0
Nodes (2): list_catalog, list_installed

### Community 63 - "clear_assistant_memory, list_assistant_memory"
Cohesion: 1.0
Nodes (2): clear_assistant_memory, list_assistant_memory

### Community 64 - "decide_atlas_candidate, save_atlas_entry"
Cohesion: 1.0
Nodes (2): decide_atlas_candidate, save_atlas_entry

### Community 65 - "disable_feature, enable_feature"
Cohesion: 1.0
Nodes (2): disable_feature, enable_feature

### Community 66 - "get_improvement_entry, list_improvement_entries"
Cohesion: 1.0
Nodes (2): get_improvement_entry, list_improvement_entries

### Community 67 - "DirectQueryRequest, DirectQueryResult"
Cohesion: 1.0
Nodes (2): DirectQueryRequest, DirectQueryResult

### Community 68 - "KnowledgeSearchRequest, KnowledgeSearchResult"
Cohesion: 1.0
Nodes (2): KnowledgeSearchRequest, KnowledgeSearchResult

### Community 69 - "SwarmQueryRequest, SwarmQueryResult"
Cohesion: 1.0
Nodes (2): SwarmQueryRequest, SwarmQueryResult

### Community 70 - "ForecastQueryRequest, ForecastQueryResult"
Cohesion: 1.0
Nodes (2): ForecastQueryRequest, ForecastQueryResult

### Community 71 - "CometEvent, NewsItem"
Cohesion: 1.0
Nodes (2): CometEvent, NewsItem

### Community 72 - "ImprovementEntry, SessionSummary"
Cohesion: 1.0
Nodes (2): ImprovementEntry, SessionSummary

### Community 73 - "AgentProfile, SkillDefinition"
Cohesion: 1.0
Nodes (2): AgentProfile, SkillDefinition

### Community 74 - "Source Health Tracking (Failure backoff), News Ingestion Service (RSS/HN/Reddit)"
Cohesion: 1.0
Nodes (2): Source Health Tracking (Failure backoff), News Ingestion Service (RSS/HN/Reddit)

### Community 75 - "Nyx Catalog Broker (UI Component Registry), Nyx Runtime (Intent Detection & Artifact Assembly)"
Cohesion: 1.0
Nodes (2): Nyx Catalog Broker (UI Component Registry), Nyx Runtime (Intent Detection & Artifact Assembly)

### Community 76 - "LocalGGUFBackend, LocalGGUFConfig"
Cohesion: 1.0
Nodes (2): LocalGGUFBackend, LocalGGUFConfig

### Community 77 - "FeatureFlag, FeatureStatus"
Cohesion: 1.0
Nodes (2): FeatureFlag, FeatureStatus

### Community 78 - "BackgroundRunner, CancelToken"
Cohesion: 1.0
Nodes (2): BackgroundRunner, CancelToken

### Community 79 - "Optimal swarm persona count based on stars + personality depth."
Cohesion: 1.0
Nodes (1): Optimal swarm persona count based on stars + personality depth.

### Community 80 - "Whether at least one abliteration has occurred."
Cohesion: 1.0
Nodes (1): Whether at least one abliteration has occurred.

### Community 81 - "Explicit transaction context for multi-statement atomic operations."
Cohesion: 1.0
Nodes (1): Explicit transaction context for multi-statement atomic operations.

### Community 82 - "Create a cache instance from a METIS settings dict."
Cohesion: 1.0
Nodes (1): Create a cache instance from a METIS settings dict.

### Community 83 - "True once ``cancel()`` has been called."
Cohesion: 1.0
Nodes (1): True once ``cancel()`` has been called.

### Community 84 - "Reconstruct a graph from a serialised dictionary."
Cohesion: 1.0
Nodes (1): Reconstruct a graph from a serialised dictionary.

### Community 85 - "Config Dataclass"
Cohesion: 1.0
Nodes (1): Config Dataclass

### Community 86 - "Parity Audit Entrypoint"
Cohesion: 1.0
Nodes (1): Parity Audit Entrypoint

### Community 87 - "api_forecast_preflight"
Cohesion: 1.0
Nodes (1): api_forecast_preflight

### Community 88 - "api_forecast_schema"
Cohesion: 1.0
Nodes (1): api_forecast_schema

### Community 89 - "get_settings"
Cohesion: 1.0
Nodes (1): get_settings

### Community 90 - "post_settings"
Cohesion: 1.0
Nodes (1): post_settings

### Community 91 - "get_hardware"
Cohesion: 1.0
Nodes (1): get_hardware

### Community 92 - "validate_model"
Cohesion: 1.0
Nodes (1): validate_model

### Community 93 - "refresh_catalog"
Cohesion: 1.0
Nodes (1): refresh_catalog

### Community 94 - "update_assistant"
Cohesion: 1.0
Nodes (1): update_assistant

### Community 95 - "reflect_assistant"
Cohesion: 1.0
Nodes (1): reflect_assistant

### Community 96 - "bootstrap_assistant"
Cohesion: 1.0
Nodes (1): bootstrap_assistant

### Community 97 - "get_atlas_candidate"
Cohesion: 1.0
Nodes (1): get_atlas_candidate

### Community 98 - "list_atlas_entries"
Cohesion: 1.0
Nodes (1): list_atlas_entries

### Community 99 - "preflight"
Cohesion: 1.0
Nodes (1): preflight

### Community 100 - "list_features"
Cohesion: 1.0
Nodes (1): list_features

### Community 101 - "create_improvement_entry"
Cohesion: 1.0
Nodes (1): create_improvement_entry

### Community 102 - "get_log_tail"
Cohesion: 1.0
Nodes (1): get_log_tail

### Community 103 - "get_trace_metrics"
Cohesion: 1.0
Nodes (1): get_trace_metrics

### Community 104 - "get_discover"
Cohesion: 1.0
Nodes (1): get_discover

### Community 105 - "get_trace_feedback"
Cohesion: 1.0
Nodes (1): get_trace_feedback

### Community 106 - "get_run_semantic"
Cohesion: 1.0
Nodes (1): get_run_semantic

### Community 107 - "post_trace_feedback"
Cohesion: 1.0
Nodes (1): post_trace_feedback

### Community 108 - "export_run_as_skill"
Cohesion: 1.0
Nodes (1): export_run_as_skill

### Community 109 - "export_run_as_eval"
Cohesion: 1.0
Nodes (1): export_run_as_eval

### Community 110 - "list_app_state"
Cohesion: 1.0
Nodes (1): list_app_state

### Community 111 - "read_app_state"
Cohesion: 1.0
Nodes (1): read_app_state

### Community 112 - "SkillSessionState"
Cohesion: 1.0
Nodes (1): SkillSessionState

### Community 113 - "SHTNode"
Cohesion: 1.0
Nodes (1): SHTNode

### Community 114 - "Time-series Forecasting"
Cohesion: 1.0
Nodes (1): Time-series Forecasting

## Knowledge Gaps
- **400 isolated node(s):** `Best-effort Windows DPI awareness bootstrap.`, `Initialise logging and start the METIS API + web server.      The ASGI backend`, `Parity audit entrypoint for the MVC runtime.`, `Run the parity audit suite and return its exit code.`, `metis_app.config — Application-wide configuration constants and Config dataclass` (+395 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `version.py, api_version()`** (2 nodes): `version.py`, `api_version()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `list_catalog, list_installed`** (2 nodes): `list_catalog`, `list_installed`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `clear_assistant_memory, list_assistant_memory`** (2 nodes): `clear_assistant_memory`, `list_assistant_memory`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `decide_atlas_candidate, save_atlas_entry`** (2 nodes): `decide_atlas_candidate`, `save_atlas_entry`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `disable_feature, enable_feature`** (2 nodes): `disable_feature`, `enable_feature`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `get_improvement_entry, list_improvement_entries`** (2 nodes): `get_improvement_entry`, `list_improvement_entries`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DirectQueryRequest, DirectQueryResult`** (2 nodes): `DirectQueryRequest`, `DirectQueryResult`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `KnowledgeSearchRequest, KnowledgeSearchResult`** (2 nodes): `KnowledgeSearchRequest`, `KnowledgeSearchResult`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `SwarmQueryRequest, SwarmQueryResult`** (2 nodes): `SwarmQueryRequest`, `SwarmQueryResult`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ForecastQueryRequest, ForecastQueryResult`** (2 nodes): `ForecastQueryRequest`, `ForecastQueryResult`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `CometEvent, NewsItem`** (2 nodes): `CometEvent`, `NewsItem`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ImprovementEntry, SessionSummary`** (2 nodes): `ImprovementEntry`, `SessionSummary`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `AgentProfile, SkillDefinition`** (2 nodes): `AgentProfile`, `SkillDefinition`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Source Health Tracking (Failure backoff), News Ingestion Service (RSS/HN/Reddit)`** (2 nodes): `Source Health Tracking (Failure backoff)`, `News Ingestion Service (RSS/HN/Reddit)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Nyx Catalog Broker (UI Component Registry), Nyx Runtime (Intent Detection & Artifact Assembly)`** (2 nodes): `Nyx Catalog Broker (UI Component Registry)`, `Nyx Runtime (Intent Detection & Artifact Assembly)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `LocalGGUFBackend, LocalGGUFConfig`** (2 nodes): `LocalGGUFBackend`, `LocalGGUFConfig`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `FeatureFlag, FeatureStatus`** (2 nodes): `FeatureFlag`, `FeatureStatus`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `BackgroundRunner, CancelToken`** (2 nodes): `BackgroundRunner`, `CancelToken`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Optimal swarm persona count based on stars + personality depth.`** (1 nodes): `Optimal swarm persona count based on stars + personality depth.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Whether at least one abliteration has occurred.`** (1 nodes): `Whether at least one abliteration has occurred.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Explicit transaction context for multi-statement atomic operations.`** (1 nodes): `Explicit transaction context for multi-statement atomic operations.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Create a cache instance from a METIS settings dict.`** (1 nodes): `Create a cache instance from a METIS settings dict.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `True once ``cancel()`` has been called.`** (1 nodes): `True once ``cancel()`` has been called.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reconstruct a graph from a serialised dictionary.`** (1 nodes): `Reconstruct a graph from a serialised dictionary.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Config Dataclass`** (1 nodes): `Config Dataclass`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Parity Audit Entrypoint`** (1 nodes): `Parity Audit Entrypoint`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `api_forecast_preflight`** (1 nodes): `api_forecast_preflight`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `api_forecast_schema`** (1 nodes): `api_forecast_schema`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `get_settings`** (1 nodes): `get_settings`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `post_settings`** (1 nodes): `post_settings`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `get_hardware`** (1 nodes): `get_hardware`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `validate_model`** (1 nodes): `validate_model`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `refresh_catalog`** (1 nodes): `refresh_catalog`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `update_assistant`** (1 nodes): `update_assistant`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `reflect_assistant`** (1 nodes): `reflect_assistant`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `bootstrap_assistant`** (1 nodes): `bootstrap_assistant`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `get_atlas_candidate`** (1 nodes): `get_atlas_candidate`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `list_atlas_entries`** (1 nodes): `list_atlas_entries`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `preflight`** (1 nodes): `preflight`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `list_features`** (1 nodes): `list_features`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `create_improvement_entry`** (1 nodes): `create_improvement_entry`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `get_log_tail`** (1 nodes): `get_log_tail`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `get_trace_metrics`** (1 nodes): `get_trace_metrics`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `get_discover`** (1 nodes): `get_discover`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `get_trace_feedback`** (1 nodes): `get_trace_feedback`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `get_run_semantic`** (1 nodes): `get_run_semantic`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `post_trace_feedback`** (1 nodes): `post_trace_feedback`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `export_run_as_skill`** (1 nodes): `export_run_as_skill`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `export_run_as_eval`** (1 nodes): `export_run_as_eval`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `list_app_state`** (1 nodes): `list_app_state`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `read_app_state`** (1 nodes): `read_app_state`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `SkillSessionState`** (1 nodes): `SkillSessionState`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `SHTNode`** (1 nodes): `SHTNode`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Time-series Forecasting`** (1 nodes): `Time-series Forecasting`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `EvidenceSource` connect `Experimental Litestar app factory.  This is a shadow port of the METIS FastAPI, Enforce Bearer-token auth when METIS_API_TOKEN is set.      When the environme +199 more` to `AssistantPolicy, .to_payload() +243 more`, `metis_app.controllers.app_controller — Top-level application controller.  AppC, Bind view widgets to controller callbacks. +203 more`, `ABC, AtlasEntry +199 more`, `app_controller.py, AppController +131 more`, `artifact_converter.py, ArtifactConverter +92 more`, `response_pipeline.py, apply_claim_level_grounding() +21 more`?**
  _High betweenness centrality (0.144) - this node is a cross-community bridge._
- **Why does `WorkspaceOrchestrator` connect `AssistantPolicy, .to_payload() +243 more` to `Experimental Litestar app factory.  This is a shadow port of the METIS FastAPI, Enforce Bearer-token auth when METIS_API_TOKEN is set.      When the environme +199 more`, `assistant.py, bootstrap_assistant() +183 more`, `artifact_converter.py, ArtifactConverter +92 more`, `web_graph.py, api_build_web_graph() +4 more`, `improvements.py, create_improvement_entry() +3 more`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **Why does `AppController` connect `app_controller.py, AppController +131 more` to `AssistantPolicy, .to_payload() +243 more`, `metis_app.controllers.app_controller — Top-level application controller.  AppC, Bind view widgets to controller callbacks. +203 more`, `Experimental Litestar app factory.  This is a shadow port of the METIS FastAPI, Enforce Bearer-token auth when METIS_API_TOKEN is set.      When the environme +199 more`, `artifact_converter.py, ArtifactConverter +92 more`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Are the 193 inferred relationships involving `EvidenceSource` (e.g. with `SuggestArchetypesRequestModel` and `IndexBuildRequestModel`) actually correct?**
  _`EvidenceSource` has 193 INFERRED edges - model-reasoned connections that need verification._
- **Are the 162 inferred relationships involving `SessionDetail` (e.g. with `SuggestArchetypesRequestModel` and `IndexBuildRequestModel`) actually correct?**
  _`SessionDetail` has 162 INFERRED edges - model-reasoned connections that need verification._
- **Are the 158 inferred relationships involving `NyxCatalogComponentDetail` (e.g. with `_normalize_snapshot_component_detail()` and `_apply_curated_component_overrides()`) actually correct?**
  _`NyxCatalogComponentDetail` has 158 INFERRED edges - model-reasoned connections that need verification._
- **Are the 156 inferred relationships involving `SessionSummary` (e.g. with `SuggestArchetypesRequestModel` and `IndexBuildRequestModel`) actually correct?**
  _`SessionSummary` has 156 INFERRED edges - model-reasoned connections that need verification._