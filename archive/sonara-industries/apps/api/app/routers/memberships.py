from fastapi import APIRouter

router = APIRouter(tags=["memberships"])

@router.get("/organizations/{org_id}/members")
def list_members(org_id: str):
    return {"organization_id": org_id, "members": []}

@router.post("/organizations/{org_id}/members")
def add_member(org_id: str, payload: dict):
    return {"organization_id": org_id, "member": payload}

@router.patch("/memberships/{id}")
def update_membership(id: str, payload: dict):
    return {"id": id, "updated": payload}

@router.delete("/memberships/{id}")
def delete_membership(id: str):
    return {"id": id, "deleted": True}

