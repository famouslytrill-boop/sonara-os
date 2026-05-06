from app.formulas import (
    alert_severity,
    exponential_smoothing,
    geometric_weighted_score,
    labor_percentage,
    menu_target_price,
    moat_score,
    pricing_score,
    queue_utilization,
    readiness_score,
    recipe_cost,
    security_risk,
)


def test_geometric_readiness_uses_epsilon_protection():
    result = geometric_weighted_score({"metadata": 100, "rights": 0}, {"metadata": 1, "rights": 1})
    assert 0 < result < 100


def test_required_business_formulas_return_expected_ranges():
    assert readiness_score({"metadata": 90, "rights": 80, "assets": 100, "strategy": 70, "quality": 80, "approval": 90}) > 70
    assert labor_percentage(250, 1000) == 25
    assert recipe_cost([2.5, 1.5, 6], 5) == 2
    assert menu_target_price(2, 25) == 8
    assert 0 <= alert_severity(80, 50, 90, 70) <= 100
    assert 0 <= security_risk(80, 50, 70, 40) <= 100
    assert queue_utilization(8, 10) == 0.8
    assert exponential_smoothing(100, 120, 0.5) == 110
    assert moat_score(80, 70, 60, 90, 75, 85) > 70
    assert pricing_score(80, 70, 60, 90) > 70
