from pydantic import BaseModel

class IngestionSchema(BaseModel):
    id: str | None = None

