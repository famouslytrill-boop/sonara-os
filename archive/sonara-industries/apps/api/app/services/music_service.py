from app.formulas import readiness_score


def calculate_release_readiness(project: dict) -> dict:
    checks = {
        "metadata": 100 if project.get("metadata") or (project.get("title") and project.get("artist_name")) else 35,
        "rights": 100 if project.get("rights_status") == "cleared" else 60,
        "assets": 100 if project.get("transcript_reference") or project.get("upload_count") else 55,
        "strategy": 100 if project.get("genre") and project.get("release_goal") else 65,
        "quality": 100 if project.get("bpm") and project.get("key_signature") else 60,
        "approval": 0 if project.get("anti_repetition_status") == "blocked" else 85,
    }
    score = round(readiness_score(checks))
    return {"score": score, "checks": checks}

def anti_repetition_check(projects: list[dict]) -> dict:
    warnings = []
    seen = set()
    for project in projects:
        signature = (project.get("bpm"), project.get("key_signature"), project.get("genre"), project.get("metadata", {}).get("rhythmic_feel"), project.get("metadata", {}).get("vocal_mode"))
        if signature in seen:
            warnings.append({"project": project.get("title"), "warning": "duplicate musical signature"})
        seen.add(signature)
    return {"warnings": warnings}

def generate_artist_genome_summary(payload: dict) -> dict:
    return {"summary": "Starter Artist Genome summary", "signals": payload}

def create_music_export(project_id: str, export_type: str) -> dict:
    return {"project_id": project_id, "export_type": export_type, "payload": {"status": "placeholder"}}
