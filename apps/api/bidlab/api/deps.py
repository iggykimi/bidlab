"""Shared route dependencies: DB session + local-client guard."""

from collections.abc import Iterator

from fastapi import Header, Request
from sqlalchemy.orm import Session

from bidlab.api.errors import ApiError
from bidlab.db.session import get_session

LOCAL_CLIENT = "local-ui"
ALLOWED_ORIGINS = frozenset(
    {
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    }
)


def get_db() -> Iterator[Session]:
    yield from get_session()


async def require_local_client(
    request: Request,
    x_bidlab_client: str | None = Header(default=None),
) -> None:
    """Mutations require X-BidLab-Client: local-ui plus a loopback Origin.

    Loopback + header is not multi-user auth; public deploy needs real auth.
    """
    if x_bidlab_client != LOCAL_CLIENT:
        raise ApiError(403, "forbidden", "missing or invalid X-BidLab-Client")
    origin = request.headers.get("origin")
    if origin is not None and origin not in ALLOWED_ORIGINS:
        raise ApiError(403, "forbidden", "untrusted origin")
