from dataclasses import dataclass
from fastapi import Header, HTTPException
from uuid import UUID, uuid4

@dataclass
class CurrentUser:
    id: UUID
    email: str
    is_superuser: bool = False

async def get_current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    if not authorization:
        raise HTTPException(status_code=401, detail="authentication_required")
    token = authorization.replace("Bearer ", "")
    if token == "dev-superuser":
        return CurrentUser(id=uuid4(), email="admin@sonaraindustries.local", is_superuser=True)
    if token.startswith("dev-"):
        return CurrentUser(id=uuid4(), email="user@sonaraindustries.local")
    raise HTTPException(status_code=401, detail="invalid_token")

