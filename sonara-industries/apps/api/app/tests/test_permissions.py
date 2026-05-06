from app.services.permission_service import has_role_permission

def test_permission_guard_denies_invalid_app():
    assert has_role_permission("alertos", "viewer", "music:project:create") is False

def test_permission_guard_allows_valid_app():
    assert has_role_permission("soundos", "manager", "music:project:create") is True
