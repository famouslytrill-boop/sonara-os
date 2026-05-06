from pydantic import BaseModel

class CivicSchema(BaseModel):
    id: str | None = None

