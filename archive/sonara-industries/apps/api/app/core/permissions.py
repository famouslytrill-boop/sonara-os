from collections.abc import Callable
from fastapi import Depends, HTTPException, Request
from app.core.security import CurrentUser, get_current_user
from app.services.permission_service import has_role_permission
from app.services.audit_service import create_app_access_event

def require_app_permission(app_code: str, permission: str) -> Callable:
    async def dependency(request: Request, user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        role = request.headers.get("x-sonara-role", "viewer")
        organization_id = request.headers.get("x-sonara-organization-id")
        allowed = user.is_superuser or has_role_permission(app_code, role, permission)
        await create_app_access_event(
            user_id=str(user.id),
            organization_id=organization_id,
            app=app_code,
            action=permission,
            allowed=allowed,
            reason=None if allowed else "missing_permission",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        if not allowed:
            raise HTTPException(status_code=403, detail="permission_denied")
        return user
    return dependency

