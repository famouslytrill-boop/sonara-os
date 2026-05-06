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
    "sonara_one": {"music:project:create", "music:project:read", "music:project:update", "music:project:delete", "music:export:create", "music:genome:update", "music:readiness:run"},
    "tableops": {"tableops:recipe:create", "tableops:recipe:read", "tableops:recipe:update", "tableops:recipe:delete", "tableops:cost:run", "tableops:prep:create", "tableops:training:update"},
    "civic_signal": {"civic:feed:create", "civic:feed:read", "civic:feed:update", "civic:feed:delete", "civic:broadcast:create", "civic:organization:update", "civic:transit:read"},
    "parent_admin": {"admin:read", "admin:update", "security:read", "audit:read", "billing:read"},
}

def has_role_permission(app: str, role: str, permission: str) -> bool:
    role_permissions = BASE_ROLE_PERMISSIONS.get(role, set())
    if "*" in role_permissions or permission in role_permissions:
        return True
    if role in {"owner", "admin", "manager", "editor"} and permission in APP_PERMISSIONS.get(app, set()):
        return True
    return False

