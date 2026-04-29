from dataclasses import dataclass
from app.core.config import settings

@dataclass
class Technology:
    name: str
    category: str
    license: str
    production_enabled: bool = False
    notes: str = ""

class LicenseFirewall:
    def __init__(self) -> None:
        self.allowed = {x.strip() for x in settings.allowed_model_licenses.split(",")}

    def can_ship(self, tech: Technology) -> bool:
        return tech.license in self.allowed and tech.production_enabled

    def require_ship_safe(self, tech: Technology) -> None:
        if not self.can_ship(tech):
            raise ValueError(f"{tech.name} blocked by license firewall: {tech.license}")

APPROVED_TECH = [
    Technology("LiteLLM", "model_gateway", "MIT", True, "Unified model gateway"),
    Technology("Qdrant", "vector_db", "Apache-2.0", True, "Vector memory and recommendations"),
    Technology("LlamaIndex", "rag", "MIT", True, "Retrieval orchestration"),
    Technology("Prefect", "workflow", "Apache-2.0", True, "Automation workflows"),
    Technology("OpenTelemetry", "observability", "Apache-2.0", True, "Traces and metrics"),
    Technology("GrowthBook", "feature_flags", "MIT", True, "Experiments and flags"),
    Technology("Demucs", "audio", "MIT", True, "Stem separation"),
    Technology("Basic Pitch", "audio", "Apache-2.0", True, "Pitch to MIDI"),
    Technology("MeloTTS", "voice", "MIT", True, "Commercial-safe TTS candidate"),
]
