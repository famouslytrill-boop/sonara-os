async def create_audit_log(**kwargs) -> dict:
    # TODO: persist to audit_logs with a DB session.
    return {"recorded": True, **kwargs}

async def create_app_access_event(**kwargs) -> dict:
    # TODO: persist to app_access_events with a DB session.
    return {"recorded": True, **kwargs}

