from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "SONARA"
    environment: str = "development"
    allowed_model_licenses: str = "MIT,Apache-2.0,BSD,ISC,MPL-2.0,Commercial-Approved"
    qdrant_url: str = "http://localhost:6333"
    redis_url: str = "redis://localhost:6379/0"
    litellm_base_url: str = "http://localhost:4000"
    sonara_ai_provider: str = "local_rules"
    sonara_provider_timeout_ms: int = 6000
    openai_api_key: str | None = None
    openai_model: str = "gpt-5.5"
    openai_fast_model: str = "gpt-5.4-mini"
    openai_reasoning_effort: str = "medium"
    openai_max_output_tokens: int = 700
    openai_store_responses: bool = False
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "llama3.1"
    lm_studio_base_url: str = "http://127.0.0.1:1234"
    lm_studio_model: str = "local-model"
    evolution_min_confidence: float = 0.72
    max_public_modules: int = 5

settings = Settings()
