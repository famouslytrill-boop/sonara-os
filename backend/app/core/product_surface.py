VISIBLE_MODULES = [
    "Home",
    "Create",
    "Library",
    "Export",
    "Settings",
]

PLATFORM_AREAS = [
    "SONARA Core",
    "Fingerprint Engine",
    "Release Planner",
    "Export Packager",
    "Research Core",
]

HERO_ENGINES = [
    "Song Fingerprint",
    "Sound Discovery",
    "Release Readiness",
    "Launch Plan",
]

BACKGROUND_ENGINES = {
    "Local Rules": "SONARA Core",
    "OpenAI BYOK": "SONARA Core",
    "Ollama Local": "SONARA Core",
    "LM Studio Local": "SONARA Core",
    "Structured Outputs": "Optional BYOK provider",
    "Prompt Compiler": "SONARA Core",
    "Release Planner": "Release Planner",
    "JSZip Export": "Export Packager",
    "Streaming Pack": "Export Packager",
    "Broadcast Kit": "Export Packager",
    "Breath Control": "SONARA Core",
    "Supabase Storage": "SONARA Core",
    "Adaptive Intelligence Loop": "SONARA Core",
}

FOUNDER_DOCTRINE = [
    "Day One Forever",
    "Compound Over Noise",
    "Creators First",
    "Two-Way Door Decisions",
    "Truth Over Ego",
    "Systems Over Heroics",
    "Build the Crown Jewel",
]

def get_public_navigation() -> list[str]:
    return VISIBLE_MODULES

def get_platform_areas() -> list[str]:
    return PLATFORM_AREAS

def explain_engine(engine: str) -> str:
    return BACKGROUND_ENGINES.get(engine, "hidden")
