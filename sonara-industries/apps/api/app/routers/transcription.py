from fastapi import APIRouter
from app.services.transcription_service import transcribe_audio

router = APIRouter(prefix="/transcripts", tags=["transcription"])

@router.get("/{asset_id}")
def get_transcript(asset_id: str):
    return transcribe_audio(asset_id)

@router.post("/{asset_id}/refresh")
def refresh(asset_id: str):
    return transcribe_audio(asset_id)

