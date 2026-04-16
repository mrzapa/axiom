"""METIS Litestar ASGI application.

This is the production API implementation. FastAPI was retired in favour of
Litestar (see docs/experiments/deprecated/litestar_api.md for the migration
history).
"""

from .app import create_app

__all__ = ["create_app"]
