"""Public engine entrypoints."""

from axiom_app.engine.indexing import IndexBuildRequest, IndexBuildResult, build_index
from axiom_app.engine.index_registry import get_index, list_indexes
from axiom_app.engine.querying import (
    DirectQueryRequest,
    DirectQueryResult,
    RagQueryRequest,
    RagQueryResult,
    query_direct,
    query_rag,
)

__all__ = [
    "DirectQueryRequest",
    "DirectQueryResult",
    "IndexBuildRequest",
    "IndexBuildResult",
    "RagQueryRequest",
    "RagQueryResult",
    "build_index",
    "get_index",
    "list_indexes",
    "query_direct",
    "query_rag",
]
