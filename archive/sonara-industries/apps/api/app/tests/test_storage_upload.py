import asyncio

from app.services.storage_service import SignedUploadRequest, create_signed_upload_url, validate_upload_request


def test_storage_upload_validation_blocks_wrong_mime():
    request = SignedUploadRequest(
        org_id="org_1",
        company_key="soundos",
        filename="recipe.csv",
        mime_type="text/csv",
        size_bytes=1024,
        created_by="user_1",
    )
    assert "mime_type_not_allowed" in validate_upload_request(request)


def test_storage_upload_returns_setup_required_without_credentials():
    request = SignedUploadRequest(
        org_id="org_1",
        company_key="tableos",
        filename="permit.pdf",
        mime_type="application/pdf",
        size_bytes=1024,
        created_by="user_1",
    )
    result = asyncio.run(create_signed_upload_url(request))
    assert result["ok"] is False
    assert result["error"] == "storage_setup_required"
    assert result["metadata"]["company_key"] == "tableos"
