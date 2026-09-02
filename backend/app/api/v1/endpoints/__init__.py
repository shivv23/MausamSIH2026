# Expose endpoint submodules so ``from app.api.v1.endpoints import homepage`` works.
# NOTE: do NOT import ``app.api.v1.api`` here - it imports this package, causing a cycle.
from app.api.v1.endpoints import homepage  # noqa: F401

__all__ = ["homepage"]