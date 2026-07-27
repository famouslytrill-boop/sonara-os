from fastapi import APIRouter
from app.services.music_service import calculate_release_readiness, anti_repetition_check, generate_artist_genome_summary, create_music_export

router = APIRouter(prefix="/music", tags=["music"])

@router.get("/projects")
def projects():
    return []

@router.post("/projects")
def create_project(payload: dict):
    return {"created": True, "project": payload}

@router.get("/projects/{id}")
def get_project(id: str):
    return {"id": id}

@router.patch("/projects/{id}")
def update_project(id: str, payload: dict):
    return {"id": id, "updated": payload}

@router.delete("/projects/{id}")
def delete_project(id: str):
    return {"id": id, "status": "permission_required"}

@router.post("/projects/{id}/readiness-score")
def readiness(id: str, payload: dict):
    return calculate_release_readiness({"id": id, **payload})

@router.post("/projects/{id}/export")
def export(id: str, payload: dict):
    return create_music_export(id, payload.get("export_type", "release_bundle"))

@router.post("/anti-repetition/check")
def anti_repetition(payload: dict):
    return anti_repetition_check(payload.get("projects", []))

@router.post("/artist-genome")
def artist_genome(payload: dict):
    return generate_artist_genome_summary(payload)

