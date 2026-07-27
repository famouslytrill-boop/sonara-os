ALLOWED_TYPES = {"audio", "video", "image", "document", "dataset", "feed", "link"}
MAX_SIZE_BYTES = 1024 * 1024 * 1024

def validate_media_file(asset_type: str, size_bytes: int | None = None) -> bool:
    if asset_type not in ALLOWED_TYPES:
        return False
    if size_bytes is not None and size_bytes > MAX_SIZE_BYTES:
        return False
    return True

def extract_metadata(payload: dict) -> dict:
    return {"metadata": payload.get("metadata", {}), "status": "metadata_placeholder"}

def queue_transcription(asset_id: str) -> dict:
    return {"asset_id": asset_id, "queued": True}

def transcode_media(asset_id: str) -> dict:
    # TODO: call FFmpeg in a sandboxed worker.
    return {"asset_id": asset_id, "status": "transcode_placeholder"}

def generate_preview(asset_id: str) -> dict:
    return {"asset_id": asset_id, "status": "preview_placeholder"}

def create_export_bundle(asset_id: str) -> dict:
    return {"asset_id": asset_id, "formats": ["json", "txt", "csv", "zip"], "status": "bundle_placeholder"}

