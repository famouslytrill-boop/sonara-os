from pydantic import BaseModel

class BillingSchema(BaseModel):
    id: str | None = None

