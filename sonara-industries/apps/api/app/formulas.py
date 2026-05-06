from __future__ import annotations

from math import prod

EPSILON = 1e-6


def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def geometric_weighted_score(scores: dict[str, float], weights: dict[str, float]) -> float:
    """Geometric weighted score, protected from zero collapse by EPSILON."""
    total_weight = sum(max(weight, 0.0) for weight in weights.values())
    if total_weight <= 0:
        return 0.0
    factors: list[float] = []
    for key, score in scores.items():
        weight = max(weights.get(key, 0.0), 0.0)
        if weight == 0:
            continue
        normalized = clamp(score, 0.0, 100.0) / 100.0
        factors.append((max(normalized, EPSILON)) ** (weight / total_weight))
    if not factors:
        return 0.0
    return round(clamp(prod(factors) * 100.0), 2)


def readiness_score(checks: dict[str, float]) -> float:
    weights = {
        "metadata": 1.2,
        "rights": 1.4,
        "assets": 1.0,
        "strategy": 0.9,
        "quality": 1.1,
        "approval": 1.5,
    }
    return geometric_weighted_score(checks, weights)


def labor_percentage(total_labor_cost: float, projected_sales: float) -> float:
    if projected_sales <= 0:
        return 0.0
    return round((total_labor_cost / projected_sales) * 100.0, 2)


def recipe_cost(ingredient_costs: list[float], servings: float) -> float:
    if servings <= 0:
        return 0.0
    return round(sum(max(cost, 0.0) for cost in ingredient_costs) / servings, 2)


def menu_target_price(cost_per_serving: float, target_food_cost_percent: float) -> float:
    if target_food_cost_percent <= 0:
        return 0.0
    return round(cost_per_serving / (target_food_cost_percent / 100.0), 2)


def alert_severity(hazard: float, proximity: float, urgency: float, source_trust: float) -> float:
    weights = {"hazard": 0.35, "proximity": 0.2, "urgency": 0.3, "source_trust": 0.15}
    return round(
        clamp(
            hazard * weights["hazard"]
            + proximity * weights["proximity"]
            + urgency * weights["urgency"]
            + source_trust * weights["source_trust"]
        ),
        2,
    )


def security_risk(sensitivity: float, exposure: float, automation_power: float, source_trust: float) -> float:
    trust_penalty = 100.0 - clamp(source_trust)
    return round(
        clamp(sensitivity * 0.3 + exposure * 0.25 + automation_power * 0.25 + trust_penalty * 0.2),
        2,
    )


def queue_utilization(arrival_rate: float, service_rate: float) -> float:
    if service_rate <= 0:
        return 1.0
    return round(arrival_rate / service_rate, 4)


def exponential_smoothing(previous_forecast: float, actual: float, alpha: float = 0.35) -> float:
    bounded_alpha = max(0.0, min(1.0, alpha))
    return round(bounded_alpha * actual + (1 - bounded_alpha) * previous_forecast, 4)


def moat_score(
    network_effects: float,
    switching_cost: float,
    proprietary_data: float,
    brand: float,
    compliance: float,
    execution_speed: float,
) -> float:
    weights = {
        "network_effects": 0.18,
        "switching_cost": 0.2,
        "proprietary_data": 0.2,
        "brand": 0.14,
        "compliance": 0.16,
        "execution_speed": 0.12,
    }
    return round(
        clamp(
            network_effects * weights["network_effects"]
            + switching_cost * weights["switching_cost"]
            + proprietary_data * weights["proprietary_data"]
            + brand * weights["brand"]
            + compliance * weights["compliance"]
            + execution_speed * weights["execution_speed"]
        ),
        2,
    )


def pricing_score(cost_savings: float, time_savings: float, urgency: float, segment_fit: float) -> float:
    return round(clamp(cost_savings * 0.3 + time_savings * 0.25 + urgency * 0.2 + segment_fit * 0.25), 2)
