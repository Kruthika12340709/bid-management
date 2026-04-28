"""
Lightweight role enforcement for MVP.

This is NOT real auth — there's no signing, no session, no rotation. The frontend
sends 'X-User-Role: director|manager' and the backend trusts it. A real deployment
needs proper auth (e.g. JWT with the role claim signed by an OIDC provider).

For MVP it's enough to demonstrate:
  - Director-only actions reject Manager calls
  - Manager-only actions reject Director calls
  - Errors surface as 403 with a clear message
"""
from fastapi import Header, HTTPException
from typing import Annotated, Literal


Role = Literal["director", "manager", "system"]


async def get_user_role(
    x_user_role: Annotated[str | None, Header()] = None,
) -> str:
    """Read the active role from the X-User-Role header. Defaults to 'director'
    for compatibility (so older clients keep working until they send the header)."""
    role = (x_user_role or "director").lower()
    if role not in ("director", "manager", "system"):
        raise HTTPException(status_code=400, detail=f"Unknown role '{role}'")
    return role


def require_director(role: str):
    if role != "director":
        raise HTTPException(status_code=403, detail="This action requires the Bid Director role")


def require_manager(role: str):
    if role != "manager":
        raise HTTPException(status_code=403, detail="This action requires the Bid Manager role")
