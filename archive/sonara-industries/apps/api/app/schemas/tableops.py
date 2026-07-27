from pydantic import BaseModel

class TableopsSchema(BaseModel):
    id: str | None = None

