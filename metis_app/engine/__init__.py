"""Public engine entrypoints."""

from metis_app.engine.indexing import IndexBuildRequest, IndexBuildResult, build_index
from metis_app.engine.index_registry import delete_index, get_index, list_indexes
from metis_app.engine.forecasting import (
    ForecastQueryRequest,
    ForecastSchemaRequest,
    forecast_preflight,
    inspect_forecast_schema,
    query_forecast,
    stream_forecast,
)
from metis_app.engine.querying import (
    DirectQueryRequest,
    DirectQueryResult,
    KnowledgeSearchRequest,
    KnowledgeSearchResult,
    RagQueryRequest,
    RagQueryResult,
    SwarmQueryRequest,
    SwarmQueryResult,
    knowledge_search,
    query_direct,
    query_rag,
    query_swarm,
)
from metis_app.engine.streaming import stream_rag_answer

__all__ = [
    "DirectQueryRequest",
    "DirectQueryResult",
    "ForecastQueryRequest",
    "ForecastSchemaRequest",
    "IndexBuildRequest",
    "IndexBuildResult",
    "KnowledgeSearchRequest",
    "KnowledgeSearchResult",
    "RagQueryRequest",
    "RagQueryResult",
    "SwarmQueryRequest",
    "SwarmQueryResult",
    "build_index",
    "delete_index",
    "forecast_preflight",
    "get_index",
    "inspect_forecast_schema",
    "knowledge_search",
    "list_indexes",
    "query_forecast",
    "query_direct",
    "query_rag",
    "query_swarm",
    "stream_forecast",
    "stream_rag_answer",
]
