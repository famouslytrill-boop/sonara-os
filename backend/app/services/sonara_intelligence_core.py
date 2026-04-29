from typing import Any

class SonaraIntelligenceCore:
    """Unified home for Artist DNA, Creator Genome, Opportunity Engine, Recommendations, and Career Intelligence."""

    def next_best_actions(self, user: dict[str, Any]) -> list[dict[str, str]]:
        role = user.get("role", "artist")
        if role == "producer":
            return [
                {"action": "Export a stem pack", "area": "Studio"},
                {"action": "List a producer kit in Vault", "area": "Market"},
            ]
        if role == "label":
            return [
                {"action": "Review roster readiness", "area": "Scale"},
                {"action": "Open an A&R feedback room", "area": "Grow"},
            ]
        return [
            {"action": "Create your first hook", "area": "Create"},
            {"action": "Build your Creative Genome", "area": "Grow"},
        ]

    def creator_score(self, signals: dict[str, float]) -> int:
        creative = signals.get("creative", 0.5)
        growth = signals.get("growth", 0.5)
        market = signals.get("market", 0.5)
        consistency = signals.get("consistency", 0.5)
        score = (creative * 0.30 + growth * 0.25 + market * 0.25 + consistency * 0.20) * 100
        return max(0, min(100, round(score)))
