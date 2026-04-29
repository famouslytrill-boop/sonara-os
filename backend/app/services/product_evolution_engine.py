from dataclasses import dataclass
from typing import Any

@dataclass
class EvolutionSignal:
    name: str
    score: float
    action: str
    reason: str

class ProductEvolutionEngine:
    """Autonomous audit engine for removing, upgrading, or shipping features."""

    def __init__(self, min_confidence: float = 0.72) -> None:
        self.min_confidence = min_confidence

    def audit(self, metrics: dict[str, Any]) -> list[EvolutionSignal]:
        signals: list[EvolutionSignal] = []
        activation = float(metrics.get("activation_rate", 0))
        retention = float(metrics.get("day7_retention", 0))
        errors = float(metrics.get("error_rate", 0))
        feature_count = int(metrics.get("public_feature_count", 5))
        model_cost = float(metrics.get("model_cost_per_user", 0))

        if feature_count > 5:
            signals.append(EvolutionSignal("surface_complexity", .92, "remove_or_merge", "Public modules exceed the 5-module rule."))
        if activation < .45:
            signals.append(EvolutionSignal("activation", .88, "upgrade_magic_flow", "First value is too slow or unclear."))
        if retention < .25:
            signals.append(EvolutionSignal("retention", .84, "increase_recommendations", "Users need stronger next-action loops."))
        if errors > .03:
            signals.append(EvolutionSignal("reliability", .95, "stabilize_release", "Error rate is too high for launch quality."))
        if model_cost > .18:
            signals.append(EvolutionSignal("ai_cost", .82, "route_cheaper_models", "Model cost per user is creeping into margin danger."))

        if not signals:
            signals.append(EvolutionSignal("system_health", .77, "continue", "No major blockers detected."))
        return [s for s in signals if s.score >= self.min_confidence]

    def summarize(self, signals: list[EvolutionSignal]) -> dict[str, Any]:
        return {
            "recommended_actions": [s.__dict__ for s in signals],
            "ship_status": "hold" if any(s.action in {"stabilize_release", "remove_or_merge"} for s in signals) else "ship",
        }
