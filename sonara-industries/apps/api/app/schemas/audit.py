from pydantic import BaseModel

class AuditSchema(BaseModel):
    id: str | None = None

