from pydantic import BaseModel

class MediaSchema(BaseModel):
    id: str | None = None

