from pydantic import BaseModel

class MembershipsSchema(BaseModel):
    id: str | None = None

