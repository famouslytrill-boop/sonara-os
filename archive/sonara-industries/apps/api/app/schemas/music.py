from pydantic import BaseModel

class MusicSchema(BaseModel):
    id: str | None = None

