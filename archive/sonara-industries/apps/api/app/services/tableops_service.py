from app.formulas import labor_percentage, menu_target_price, recipe_cost


def calculate_margin(cost: float, price: float) -> float:
    if price <= 0:
        return 0
    return round((price - cost) / price * 100, 2)

def calculate_food_cost(recipe: dict) -> dict:
    ingredient_costs = recipe.get("ingredient_costs") or []
    servings = float(recipe.get("servings") or recipe.get("yield_amount") or 1)
    cost = recipe_cost([float(value) for value in ingredient_costs], servings) if ingredient_costs else float(recipe.get("food_cost_estimate") or 0)
    price = float(recipe.get("sell_price_estimate") or 0)
    target_price = menu_target_price(cost, float(recipe.get("target_food_cost_percent") or 28))
    return {"food_cost": cost, "sell_price": price, "target_price": target_price, "margin": calculate_margin(cost, price)}


def calculate_labor_projection(total_labor_cost: float, projected_sales: float) -> dict:
    return {"labor_percentage": labor_percentage(total_labor_cost, projected_sales)}

def create_prep_items(recipe: dict) -> list[dict]:
    return [{"name": f"Prep {recipe.get('name', 'recipe')}", "quantity": recipe.get("yield_amount", 1), "unit": recipe.get("yield_unit", "batch"), "status": "open"}]

def generate_recipe_score(recipe: dict) -> dict:
    checks = [bool(recipe.get("name")), bool(recipe.get("instructions")), bool(recipe.get("food_cost_estimate")), bool(recipe.get("sell_price_estimate"))]
    return {"score": round(sum(checks) / len(checks) * 100)}
