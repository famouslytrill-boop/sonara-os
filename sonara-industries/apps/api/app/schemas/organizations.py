from pydantic import BaseModel

class OrganizationsSchema(BaseModel):
    id: str | None = None

