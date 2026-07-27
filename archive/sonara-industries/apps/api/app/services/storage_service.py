from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import uuid4

import httpx

from app.core.config import settings

BUCKETS_BY_COMPANY = {
    "soundos": "soundos-media",
    "tableos": "tableos-documents",
    "alertos": "alertos-imports",
    "parent_admin": "public-assets",
}

PROFILE_BUCKET = "profile-images"

ALLOWED_MIME_PREFIXES = {
    "soundos": ("audio/", "video/", "image/", "application/pdf", "text/plain"),
    "tableos": ("image/", "application/pdf", "text/csv", "application/json", "text/plain"),
    "alertos": ("text/csv", "application/json", "application/pdf", "text/xml", "application/xml", "image/"),
    "parent_admin": ("image/", "application/pdf", "text/plain"),
}

MAX_SIZE_BYTES = {
    "soundos": 1024 * 1024 * 1024,
    "tableos": 100 * 1024 * 1024,
    "alertos": 100 * 1024 * 1024,
    "parent_admin": 20 * 1024 * 1024,
}


@dataclass(frozen=True)
class SignedUploadRequest:
    org_id: str
    company_key: str
    filename: str
    mime_type: str
    size_bytes: int
    created_by: str
    purpose: str = "asset_upload"


def validate_upload_request(request: SignedUploadRequest) -> list[str]:
    warnings: list[str] = []
    if request.company_key not in BUCKETS_BY_COMPANY:
        warnings.append("unknown_company_key")
    max_size = MAX_SIZE_BYTES.get(request.company_key, 10 * 1024 * 1024)
    if request.size_bytes > max_size:
        warnings.append("file_too_large")
    allowed = ALLOWED_MIME_PREFIXES.get(request.company_key, ())
    if not any(request.mime_type == prefix or request.mime_type.startswith(prefix) for prefix in allowed):
        warnings.append("mime_type_not_allowed")
    return warnings


async def create_signed_upload_url(request: SignedUploadRequest) -> dict[str, Any]:
    warnings = validate_upload_request(request)
    if warnings:
        return {"ok": False, "error": "invalid_upload_request", "warnings": warnings}
    bucket = PROFILE_BUCKET if request.purpose == "profile_image" else BUCKETS_BY_COMPANY[request.company_key]
    object_path = f"{request.org_id}/{request.created_by}/{uuid4()}-{request.filename}"
    if not settings.next_public_supabase_url or not settings.supabase_service_role_key:
        return {
            "ok": False,
            "error": "storage_setup_required",
            "bucket": bucket,
            "path": object_path,
            "metadata": upload_metadata_record(request, bucket, object_path),
        }
    endpoint = f"{settings.next_public_supabase_url.rstrip('/')}/storage/v1/object/upload/sign/{bucket}/{object_path}"
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            endpoint,
            headers={"Authorization": f"Bearer {settings.supabase_service_role_key}"},
            json={"expiresIn": 3600},
        )
    if response.status_code >= 400:
        return {"ok": False, "error": "signed_upload_failed", "status_code": response.status_code}
    data = response.json()
    return {
        "ok": True,
        "bucket": bucket,
        "path": object_path,
        "signed_url": data.get("signedURL") or data.get("url"),
        "metadata": upload_metadata_record(request, bucket, object_path),
    }


def upload_metadata_record(request: SignedUploadRequest, bucket: str, object_path: str) -> dict[str, Any]:
    return {
        "org_id": request.org_id,
        "company_key": request.company_key,
        "bucket": bucket,
        "storage_path": object_path,
        "original_filename": request.filename,
        "mime_type": request.mime_type,
        "size_bytes": request.size_bytes,
        "created_by": request.created_by,
        "status": "signed_url_created",
    }
