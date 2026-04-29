from dataclasses import dataclass
import os
from typing import Any


def normalize_provider(value: str | None) -> str:
    normalized = (value or "local").strip().lower().replace("_", "-")
    if normalized in {"openai", "openai-byok"}:
        return "openai_byok"
    if normalized in {"ollama", "ollama-local"}:
        return "ollama_local"
    if normalized in {"lmstudio", "lm-studio", "lmstudio-local", "lm-studio-local"}:
        return "lmstudio_local"
    return "local_rules"


@dataclass
class ModelChoice:
    provider: str
    model: str
    reason: str
    max_cost_rank: int


class ModelGateway:
    """Optional provider router for SONARA Core.

    SONARA launches with Local Rules. OpenAI, Ollama, and LM Studio are opt-in
    provider modes and must never be required for public launch.
    """

    responses_url = "https://api.openai.com/v1/responses"

    def __init__(
        self,
        api_key: str | None = None,
        default_model: str | None = None,
        fast_model: str | None = None,
        provider: str | None = None,
    ) -> None:
        self.provider = normalize_provider(provider if provider is not None else os.getenv("SONARA_AI_PROVIDER"))
        self.api_key = api_key if api_key is not None else os.getenv("OPENAI_API_KEY")
        self.default_model = default_model if default_model is not None else os.getenv("OPENAI_MODEL", "gpt-5.5")
        self.fast_model = fast_model if fast_model is not None else os.getenv("OPENAI_FAST_MODEL", "gpt-5.4-mini")
        self.ollama_model = os.getenv("OLLAMA_MODEL", "llama3.1")
        self.lm_studio_model = os.getenv("LM_STUDIO_MODEL", "local-model")
        self.reasoning_effort = os.getenv("OPENAI_REASONING_EFFORT", "medium")
        self.max_output_tokens = int(os.getenv("OPENAI_MAX_OUTPUT_TOKENS", "700"))
        self.store_responses = os.getenv("OPENAI_STORE_RESPONSES", "false").lower() == "true"

    def choose(self, task: str, locale: str = "en") -> ModelChoice:
        normalized_task = task.lower().strip()
        cost_rank = 1 if normalized_task in {"quick", "caption", "captions", "social", "hook"} else 2

        if self.provider == "openai_byok":
            if normalized_task in {"quick", "caption", "captions", "social", "hook"}:
                return ModelChoice("openai_byok", self.fast_model, "optional OpenAI BYOK low-latency route", 1)
            return ModelChoice("openai_byok", self.default_model, f"optional OpenAI BYOK route for {locale}", 3)

        if self.provider == "ollama_local":
            return ModelChoice("ollama_local", self.ollama_model, "optional Ollama local route", cost_rank)

        if self.provider == "lmstudio_local":
            return ModelChoice("lmstudio_local", self.lm_studio_model, "optional LM Studio local route", cost_rank)

        return ModelChoice("local_rules", "local-rules-v1", "default SONARA Local Rules route", 0)

    async def complete(self, task: str, prompt: str, locale: str = "en") -> dict[str, Any]:
        choice = self.choose(task, locale)
        instructions = (
            "You are SONARA Core, a music identity and release-readiness system. "
            "Give compact guidance for fingerprint, readiness, and release planning. "
            "Do not generate music, distribute music, or add extra product surfaces."
        )

        if choice.provider != "openai_byok":
            return self._local_rules(choice, prompt, "local_rules_complete")

        if not self.api_key:
            return self._local_rules(choice, prompt, "openai_byok_missing")

        try:
            import httpx

            payload: dict[str, Any] = {
                "model": choice.model,
                "instructions": instructions,
                "input": prompt,
                "max_output_tokens": self.max_output_tokens,
                "store": self.store_responses,
            }
            if choice.model.startswith("gpt-5"):
                payload["reasoning"] = {"effort": self.reasoning_effort}

            async with httpx.AsyncClient(timeout=45) as client:
                response = await client.post(
                    self.responses_url,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                response.raise_for_status()

            data = response.json()
            output = data.get("output_text") or self._extract_output_text(data)
            return {
                "choice": choice.__dict__,
                "output": output,
                "response_id": data.get("id"),
                "status": "openai_responses_complete",
            }
        except Exception as exc:
            fallback = self._local_rules(choice, prompt, "openai_byok_degraded")
            fallback["error"] = exc.__class__.__name__
            return fallback

    def _local_rules(self, choice: ModelChoice, prompt: str, status: str) -> dict[str, Any]:
        idea = prompt[:220].strip()
        return {
            "choice": choice.__dict__,
            "output": (
                "SONARA Local Rules: turn the idea into one clear song fingerprint, "
                "one audience signal, one release blocker, and one next launch action. "
                f"Seed: {idea}"
            ),
            "response_id": None,
            "status": status,
        }

    def _extract_output_text(self, response: dict[str, Any]) -> str:
        chunks: list[str] = []
        for item in response.get("output", []):
            for content in item.get("content", []):
                text = content.get("text")
                if content.get("type") == "output_text" and text:
                    chunks.append(text)
        return "\n".join(chunks).strip()
