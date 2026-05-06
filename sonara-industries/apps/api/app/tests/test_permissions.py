from app.services.permission_service import has_role_permission

def test_permission_guard_denies_invalid_app():
    assert has_role_permission("civic_signal", "viewer", "music:project:create") is False

def test_permission_guard_allows_valid_app():
    assert has_role_permission("sonara_one", "manager", "music:project:create") is True

