from fastapi import APIRouter
from app.services.tableops_service import calculate_food_cost, create_prep_items

router = APIRouter(prefix="/tableops", tags=["tableops"])

@router.get("/recipes")
def recipes():
    return []

@router.post("/recipes")
def create_recipe(payload: dict):
    return {"created": True, "recipe": payload}

@router.get("/recipes/{id}")
def get_recipe(id: str):
    return {"id": id}

@router.patch("/recipes/{id}")
def update_recipe(id: str, payload: dict):
    return {"id": id, "updated": payload}

@router.delete("/recipes/{id}")
def delete_recipe(id: str):
    return {"id": id, "status": "permission_required"}

@router.post("/recipes/{id}/cost")
def cost(id: str, payload: dict):
    return calculate_food_cost({"id": id, **payload})

@router.get("/prep")
def prep():
    return []

@router.post("/prep")
def create_prep(payload: dict):
    return create_prep_items(payload)

@router.get("/training")
def training():
    return []

