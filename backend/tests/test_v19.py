from app.services.product_evolution_engine import ProductEvolutionEngine
from app.services.prompt_compiler import compile_master_prompt
from app.core.product_surface import get_public_navigation
from app.services.model_gateway import ModelGateway
import asyncio


def test_public_navigation_is_five_modules():
    assert get_public_navigation() == ["Home", "Create", "Library", "Export", "Settings"]


def test_prompt_compiler_hard_caps_1000_chars():
    prompt = compile_master_prompt("x" * 5000, "artist")
    assert len(prompt) <= 1000


def test_evolution_engine_flags_complexity():
    engine = ProductEvolutionEngine()
    signals = engine.audit({"public_feature_count": 12, "activation_rate": .6, "day7_retention": .4, "error_rate": .01})
    assert any(s.action == "remove_or_merge" for s in signals)


def test_model_gateway_routes_to_local_rules_default():
    gateway = ModelGateway(api_key=None, default_model="gpt-5.5", fast_model="gpt-5.4-mini")
    route = gateway.choose("song")
    assert route.provider == "local_rules"
    assert route.model == "local-rules-v1"


def test_model_gateway_openai_is_byok_opt_in():
    gateway = ModelGateway(api_key="", default_model="gpt-5.5", fast_model="gpt-5.4-mini", provider="openai")
    route = gateway.choose("song")
    assert route.provider == "openai_byok"
    assert route.model == "gpt-5.5"


def test_model_gateway_falls_back_without_key():
    gateway = ModelGateway(api_key="", default_model="gpt-5.5", fast_model="gpt-5.4-mini", provider="openai")
    result = asyncio.run(gateway.complete("song", "Goal: write a better hook."))
    assert result["status"] == "openai_byok_missing"
    assert "output" in result
