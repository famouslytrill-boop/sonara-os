from fastapi import APIRouter, Depends, HTTPException, Request
from app.core.security import CurrentUser, get_current_user
from app.services.media_service import validate_media_file, queue_transcription, create_export_bundle
from app.services.storage_service import SignedUploadRequest, create_signed_upload_url

router = APIRouter(prefix="/media", tags=["media"])

@router.post("/upload")
async def upload(payload: dict, request: Request, user: CurrentUser = Depends(get_current_user)):
    if not validate_media_file(payload.get("asset_type", ""), payload.get("size_bytes")):
        raise HTTPException(status_code=400, detail="invalid_media_file")
    org_id = payload.get("org_id") or request.headers.get("x-sonara-organization-id")
    company_key = payload.get("company_key") or request.headers.get("x-sonara-company-key")
    if not org_id or not company_key:
        raise HTTPException(status_code=400, detail="org_id_and_company_key_required")
    signed_request = SignedUploadRequest(
        org_id=str(org_id),
        company_key=str(company_key),
        filename=str(payload.get("filename") or "upload.bin"),
        mime_type=str(payload.get("mime_type") or "application/octet-stream"),
        size_bytes=int(payload.get("size_bytes") or 0),
        created_by=str(user.id),
        purpose=str(payload.get("purpose") or "asset_upload"),
    )
    return await create_signed_upload_url(signed_request)

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
