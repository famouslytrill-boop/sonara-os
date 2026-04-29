from typing import Any

class RecommendationMemory:
    """Qdrant/pgvector-ready recommendation adapter."""

    def recommend_next_actions(self, user_profile: dict[str, Any]) -> list[dict[str, str]]:
        role = user_profile.get("role", "artist")
        if role == "producer":
            return [
                {"title": "Turn your last beat into a sellable kit", "module": "Creator Market"},
                {"title": "Extract MIDI from your strongest melody", "module": "Song Engine"},
            ]
        if role == "label":
            return [
                {"title": "Review roster release readiness", "module": "Career Intelligence"},
                {"title": "Launch a private seller vault", "module": "Creator Market"},
            ]
        return [
            {"title": "Finish one hook in under 10 minutes", "module": "Song Engine"},
            {"title": "Improve your SONARA Score", "module": "Career Intelligence"},
        ]
