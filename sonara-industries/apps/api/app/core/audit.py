from app.services.audit_service import create_app_access_event

async def audit_access(**kwargs):
    await create_app_access_event(**kwargs)

