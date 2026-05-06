def calculate_margin(cost: float, price: float) -> float:
    if price <= 0:
        return 0
    return round((price - cost) / price * 100, 2)

def calculate_food_cost(recipe: dict) -> dict:
    cost = float(recipe.get("food_cost_estimate") or 0)
    price = float(recipe.get("sell_price_estimate") or 0)
    return {"food_cost": cost, "sell_price": price, "margin": calculate_margin(cost, price)}

def create_prep_items(recipe: dict) -> list[dict]:
    return [{"name": f"Prep {recipe.get('name', 'recipe')}", "quantity": recipe.get("yield_amount", 1), "unit": recipe.get("yield_unit", "batch"), "status": "open"}]

def generate_recipe_score(recipe: dict) -> dict:
    checks = [bool(recipe.get("name")), bool(recipe.get("instructions")), bool(recipe.get("food_cost_estimate")), bool(recipe.get("sell_price_estimate"))]
    return {"score": round(sum(checks) / len(checks) * 100)}

