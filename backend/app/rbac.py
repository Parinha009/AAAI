"""RBAC guards — FastAPI dependencies to protect routes by role or permission.

Usage on an endpoint:

    from app.rbac import require_role, require_permission
    from app.roles import Role, Permission

    @router.get("/jobs", dependencies=[Depends(require_role(Role.RECRUITER, Role.ADMIN))])
    ...

    @router.post("/jobs", dependencies=[Depends(require_permission(Permission.MANAGE_JOBS))])
    ...
"""

from fastapi import Depends

from app.errors import api_error
from app.roles import Permission, Role, has_permission
from app.security import get_session


def _role_of(session: dict) -> Role:
    try:
        return Role(session.get("role"))
    except ValueError:
        raise api_error(403, "FORBIDDEN", "Unrecognized session role")


def current_role(session: dict = Depends(get_session)) -> Role:
    """Dependency that returns the caller's Role (401 if unauthenticated)."""
    return _role_of(session)


def require_role(*allowed: Role):
    """Allow only the given role(s). Returns the decoded session payload."""
    allowed_set = set(allowed)

    def dependency(session: dict = Depends(get_session)) -> dict:
        role = _role_of(session)
        if role not in allowed_set:
            names = ", ".join(r.value for r in allowed_set)
            raise api_error(403, "FORBIDDEN", f"Requires role: {names}")
        return session

    return dependency


def require_permission(*needed: Permission):
    """Allow only callers whose role grants ALL of the given permission(s)."""
    needed_set = set(needed)

    def dependency(session: dict = Depends(get_session)) -> dict:
        role = _role_of(session)
        missing = [p.value for p in needed_set if not has_permission(role, p)]
        if missing:
            raise api_error(403, "FORBIDDEN", f"Missing permission(s): {', '.join(missing)}")
        return session

    return dependency
