BASE_ROLE_PERMISSIONS = {
    "owner": {"*"},
    "admin": {"org:read", "org:update", "members:read", "members:create", "members:update", "billing:read", "assets:create", "assets:read", "assets:update", "assets:delete", "ingestion:create", "ingestion:read", "audit:read"},
    "manager": {"assets:create", "assets:read", "assets:update", "ingestion:create", "ingestion:read", "project:create", "project:read", "project:update"},
    "editor": {"assets:create", "assets:read", "assets:update", "project:create", "project:read", "project:update"},
    "viewer": {"assets:read", "project:read"},
    "billing": {"billing:read", "billing:update"},
    "security": {"audit:read", "security:read"},
}

APP_PERMISSIONS = {
    "soundos": {"soundos.read", "soundos.write", "music:project:create", "music:project:read", "music:project:update", "music:project:delete", "music:export:create", "music:genome:update", "music:readiness:run"},
    "tableos": {"tableos.read", "tableos.write", "tableos:recipe:create", "tableos:recipe:read", "tableos:recipe:update", "tableos:recipe:delete", "tableos:cost:run", "tableos:prep:create", "tableos:training:update"},
    "alertos": {"alertos.read", "alertos.write", "alertos:feed:create", "alertos:feed:read", "alertos:feed:update", "alertos:feed:delete", "alertos:broadcast:create", "alertos:organization:update", "alertos:transit:read"},
    "parent_admin": {"admin:read", "admin:update", "security:read", "audit:read", "billing:read"},
}

APP_SCOPES = {
    "soundos.read",
    "soundos.write",
    "tableos.read",
    "tableos.write",
    "alertos.read",
    "alertos.write",
    "billing.manage",
    "security.manage",
    "admin.all",
}

def has_role_permission(app: str, role: str, permission: str) -> bool:
    role_permissions = BASE_ROLE_PERMISSIONS.get(role, set())
    if "*" in role_permissions or permission in role_permissions:
        return True
    if role in {"owner", "admin", "manager", "editor"} and permission in APP_PERMISSIONS.get(app, set()):
        return True
    if role in {"owner", "admin"} and permission in APP_SCOPES:
        return True
    if role == "billing_admin" and permission == "billing.manage":
        return True
    if role == "security_admin" and permission == "security.manage":
        return True
    return False
