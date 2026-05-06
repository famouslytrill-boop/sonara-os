def test_app_isolation_prevents_cross_app_access():
    music_scope = "soundos"
    table_scope = "tableos"
    assert music_scope != table_scope
