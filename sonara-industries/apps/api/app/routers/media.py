from fastapi import APIRouter, HTTPException
from app.services.media_service import validate_media_file, queue_transcription, create_export_bundle

router = APIRouter(prefix="/media", tags=["media"])

@router.post("/upload")
def upload(payload: dict):
    if not validate_media_file(payload.get("asset_type", ""), payload.get("size_bytes")):
        raise HTTPException(status_code=400, detail="invalid_media_file")
    return {"status": "accepted", "asset": payload}

@router.get("/assets")
def assets():
    return []

@router.get("/assets/{id}")
def asset(id: str):
    return {"id": id}

@router.delete("/assets/{id}")
def delete_asset(id: str):
    return {"id": id, "status": "permission_required"}

@router.post("/assets/{id}/transcribe")
def transcribe(id: str):
    return queue_transcription(id)

@router.post("/assets/{id}/export")
def export(id: str):
    return create_export_bundle(id)

