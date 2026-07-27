from pydantic import BaseModel

class AuthSchema(BaseModel):
    id: str | None = None

