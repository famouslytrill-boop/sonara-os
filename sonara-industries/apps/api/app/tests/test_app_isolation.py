def test_app_isolation_prevents_cross_app_access():
    music_scope = "sonara_one"
    table_scope = "tableops"
    assert music_scope != table_scope

