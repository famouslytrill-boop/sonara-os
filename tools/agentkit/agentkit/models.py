"""Talking to a model.

## Why there is no SDK here

This package imports nothing outside the standard library. `urllib.request`
makes the call, `json` builds the body. That is a deliberate cost: an SDK would
handle retries and streaming for free, and it would also be a dependency, a
licence, a version to keep current and a layer between what is written here and
what goes on the wire. For a toolkit whose whole job is to be readable and
embeddable, the wire being visible is worth more.

## The wire shape is copied, not remembered

The Gemini request and response shapes below are taken from Google's own REST
cookbook -- `contents` with roles `user`, `model` and **`function`**, tools as
`{"functionDeclarations": [...]}`, a call arriving as a `functionCall` part and
its result going back as a `functionResponse` part whose `response` is an
object. The parameter types are spelled in upper case (`OBJECT`, `STRING`)
because that is the form the fuller cookbook example uses.

**One thing is worth knowing and is stated rather than glossed over.** Google
now documents a newer `interactions` API and labels `generateContent` legacy.
This targets `generateContent`, because that is the contract whose exact wire
shape could be read from where this was written -- `ai.google.dev` is blocked by
this environment's egress proxy, so the newer contract could only have been
guessed at. `base_url` and `api_version` are constructor arguments so moving is
an argument change rather than a rewrite.
"""

from __future__ import annotations

import dataclasses
import json
import os
import typing
import urllib.error
import urllib.request

from .errors import NotConfigured, ProviderError

# --- the provider-neutral conversation -----------------------------------
#
# Kept deliberately small. Anything a provider does that does not fit these
# three part types is carried in `raw` rather than flattened into them, so a
# client can show it without this file having to know about it.


@dataclasses.dataclass
class Text:
    text: str


@dataclasses.dataclass
class FunctionCall:
    name: str
    arguments: dict
    call_id: str = ""


@dataclasses.dataclass
class FunctionResponse:
    name: str
    response: dict
    call_id: str = ""


Part = typing.Union[Text, FunctionCall, FunctionResponse]


@dataclasses.dataclass
class Message:
    #: "user", "model", or "function". The third is what a tool result is sent as.
    role: str
    parts: list


@dataclasses.dataclass
class LlmResponse:
    """One turn back from a model."""

    text: str = ""
    calls: list = dataclasses.field(default_factory=list)
    finish_reason: str = ""
    #: What the provider said about its own searching, when it searched. `None`
    #: means it did not search or did not say -- which is not the same as "it
    #: searched and found nothing", so it is not an empty dict.
    grounding: dict | None = None
    usage: dict = dataclasses.field(default_factory=dict)
    raw: dict = dataclasses.field(default_factory=dict)


class LlmClient(typing.Protocol):
    """What the runner needs from a provider."""

    name: str

    def supports_native(self, key: str) -> bool:
        """Whether this provider runs a native tool such as `google_search`."""

    def generate(
        self,
        *,
        model: str,
        system_instruction: str,
        messages: list,
        function_declarations: list,
        native_tools: list,
        temperature: float | None = None,
    ) -> LlmResponse:
        ...


# --- Gemini ---------------------------------------------------------------


class GeminiClient:
    """Google's Generative Language API over plain HTTPS."""

    name = "gemini"

    #: Native tools this provider actually runs. A key not in here is refused
    #: by name rather than dropped -- see `tools.GoogleSearch`.
    NATIVE = frozenset({"google_search", "url_context", "code_execution"})

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str = "https://generativelanguage.googleapis.com",
        api_version: str = "v1beta",
        timeout: float = 120.0,
        opener: typing.Callable | None = None,
    ) -> None:
        self.api_key = api_key if api_key is not None else os.environ.get("GEMINI_API_KEY", "")
        self.base_url = base_url.rstrip("/")
        self.api_version = api_version
        self.timeout = timeout
        # Injectable so a test can drive this without the network. It takes the
        # same (url, body, headers) a real call would and returns bytes.
        self._opener = opener or _https_post

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    def supports_native(self, key: str) -> bool:
        return key in self.NATIVE

    def generate(
        self,
        *,
        model: str,
        system_instruction: str = "",
        messages: list,
        function_declarations: list | None = None,
        native_tools: list | None = None,
        temperature: float | None = None,
    ) -> LlmResponse:
        if not self.configured:
            raise NotConfigured("The Gemini provider", set_these=["GEMINI_API_KEY"])

        body: dict = {"contents": [_to_gemini(message) for message in messages]}
        if system_instruction:
            body["systemInstruction"] = {"parts": [{"text": system_instruction}]}

        tools: list = []
        if function_declarations:
            tools.append({"functionDeclarations": list(function_declarations)})
        for native in native_tools or []:
            tools.append(native)
        if tools:
            body["tools"] = tools
        if temperature is not None:
            body["generationConfig"] = {"temperature": temperature}

        url = f"{self.base_url}/{self.api_version}/models/{model}:generateContent?key={self.api_key}"
        payload = self._opener(url, json.dumps(body).encode("utf-8"), {"Content-Type": "application/json"}, self.timeout)
        try:
            answer = json.loads(payload.decode("utf-8"))
        except json.JSONDecodeError as error:
            raise ProviderError(f"Gemini answered with something that is not JSON: {error}", body=payload[:400].decode("utf-8", "replace"))
        return _from_gemini(answer)


def _to_gemini(message: Message) -> dict:
    parts: list[dict] = []
    for part in message.parts:
        if isinstance(part, Text):
            parts.append({"text": part.text})
        elif isinstance(part, FunctionCall):
            parts.append({"functionCall": {"name": part.name, "args": part.arguments}})
        elif isinstance(part, FunctionResponse):
            # `response` is an object, and the cookbook nests the tool's name
            # inside it as well as beside it. Both are sent, because that is
            # what the documented example does.
            parts.append({"functionResponse": {"name": part.name, "response": {"name": part.name, **part.response}}})
        else:  # pragma: no cover - the union is closed
            raise TypeError(f"cannot send a {type(part).__name__} to Gemini")
    return {"role": message.role, "parts": parts}


def _from_gemini(answer: dict) -> LlmResponse:
    candidates = answer.get("candidates") or []
    if not candidates:
        # A response with no candidate is usually a prompt that was blocked.
        # Saying so beats returning an empty string, which reads as the model
        # having nothing to say.
        feedback = answer.get("promptFeedback") or {}
        blocked = feedback.get("blockReason")
        raise ProviderError(
            f"Gemini returned no candidates{f' (blockReason: {blocked})' if blocked else ''}.",
            body=json.dumps(answer)[:400],
        )

    candidate = candidates[0]
    content = candidate.get("content") or {}
    texts: list[str] = []
    calls: list[FunctionCall] = []
    for part in content.get("parts") or []:
        if "text" in part and part["text"]:
            texts.append(part["text"])
        call = part.get("functionCall")
        if call:
            calls.append(FunctionCall(name=call.get("name", ""), arguments=dict(call.get("args") or {})))

    return LlmResponse(
        text="".join(texts),
        calls=calls,
        finish_reason=candidate.get("finishReason", ""),
        # None, not {}: "did not search" and "searched and found nothing" are
        # different facts and the UI shows them differently.
        grounding=candidate.get("groundingMetadata"),
        usage=answer.get("usageMetadata") or {},
        raw=answer,
    )


def _https_post(url: str, body: bytes, headers: dict, timeout: float) -> bytes:
    request = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")
        raise ProviderError(f"the model provider answered {error.code}", status=error.code, body=detail[:800]) from None
    except urllib.error.URLError as error:
        # Unreachable is not the same as refused, and a caller deciding whether
        # to retry needs to know which happened.
        raise ProviderError(f"could not reach the model provider: {error.reason}") from None


# --- an OpenAI-shaped provider -------------------------------------------


class OpenAICompatibleClient:
    """Any endpoint speaking OpenAI's `/chat/completions`.

    Here so "optimised for Gemini, not locked to it" is a property of the code
    rather than a sentence in a README. llama.cpp, vLLM and Ollama's compatible
    route all answer this shape, so an agent written against this toolkit can be
    run entirely on your own hardware.

    It reports **no** native tools. `GoogleSearch()` on an agent pointed here
    raises rather than being dropped, because an agent that quietly loses its
    search is an agent that answers from memory and sounds just as sure.
    """

    name = "openai-compatible"

    def __init__(
        self,
        *,
        base_url: str | None = None,
        api_key: str | None = None,
        timeout: float = 120.0,
        opener: typing.Callable | None = None,
    ) -> None:
        self.base_url = (base_url or os.environ.get("AGENTKIT_OPENAI_BASE_URL", "")).rstrip("/")
        self.api_key = api_key if api_key is not None else os.environ.get("AGENTKIT_OPENAI_API_KEY", "")
        self.timeout = timeout
        self._opener = opener or _https_post

    @property
    def configured(self) -> bool:
        # A key is not required: a local llama.cpp has none, and demanding one
        # would rule out the setup this exists to support.
        return bool(self.base_url)

    def supports_native(self, key: str) -> bool:
        return False

    def generate(
        self,
        *,
        model: str,
        system_instruction: str = "",
        messages: list,
        function_declarations: list | None = None,
        native_tools: list | None = None,
        temperature: float | None = None,
    ) -> LlmResponse:
        if not self.configured:
            raise NotConfigured("The OpenAI-compatible provider", set_these=["AGENTKIT_OPENAI_BASE_URL"])

        payload: dict = {"model": model, "messages": _to_openai(messages, system_instruction)}
        if function_declarations:
            payload["tools"] = [
                {"type": "function", "function": _to_openai_function(declaration)}
                for declaration in function_declarations
            ]
        if temperature is not None:
            payload["temperature"] = temperature

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        raw = self._opener(f"{self.base_url}/chat/completions", json.dumps(payload).encode("utf-8"), headers, self.timeout)
        answer = json.loads(raw.decode("utf-8"))

        choice = (answer.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        calls = []
        for call in message.get("tool_calls") or []:
            function = call.get("function") or {}
            try:
                arguments = json.loads(function.get("arguments") or "{}")
            except json.JSONDecodeError:
                # Models do emit unparseable argument strings. Carrying the raw
                # text through as an error beats crashing the run.
                arguments = {"__unparsed__": function.get("arguments", "")}
            calls.append(FunctionCall(name=function.get("name", ""), arguments=arguments, call_id=call.get("id", "")))

        return LlmResponse(
            text=message.get("content") or "",
            calls=calls,
            finish_reason=choice.get("finish_reason", ""),
            grounding=None,
            usage=answer.get("usage") or {},
            raw=answer,
        )


def _to_openai(messages: list, system_instruction: str) -> list:
    out: list[dict] = []
    if system_instruction:
        out.append({"role": "system", "content": system_instruction})
    for message in messages:
        for part in message.parts:
            if isinstance(part, Text):
                out.append({"role": "assistant" if message.role == "model" else "user", "content": part.text})
            elif isinstance(part, FunctionCall):
                out.append({
                    "role": "assistant",
                    "tool_calls": [{
                        "id": part.call_id or part.name,
                        "type": "function",
                        "function": {"name": part.name, "arguments": json.dumps(part.arguments)},
                    }],
                })
            elif isinstance(part, FunctionResponse):
                out.append({
                    "role": "tool",
                    "tool_call_id": part.call_id or part.name,
                    "content": json.dumps(part.response),
                })
    return out


_OPENAI_TYPES = {"OBJECT": "object", "STRING": "string", "INTEGER": "integer", "NUMBER": "number", "BOOLEAN": "boolean", "ARRAY": "array"}


def _to_openai_function(declaration: dict) -> dict:
    """Gemini's upper-case OpenAPI subset down to JSON Schema's lower case."""

    def convert(node: dict) -> dict:
        out = dict(node)
        if "type" in out:
            out["type"] = _OPENAI_TYPES.get(out["type"], str(out["type"]).lower())
        if "properties" in out:
            out["properties"] = {key: convert(value) for key, value in out["properties"].items()}
        if "items" in out:
            out["items"] = convert(out["items"])
        return out

    out = {"name": declaration["name"], "description": declaration.get("description", "")}
    if "parameters" in declaration:
        out["parameters"] = convert(declaration["parameters"])
    return out


# --- a test double, named so nobody mistakes it for a provider ------------


class ScriptedClient:
    """Answers from a list written by whoever is testing.

    Named `Scripted` rather than `Mock` or `Local` so it cannot be mistaken in a
    stack trace for something that talks to a model. It records every request it
    was given, which is how the tests assert what actually went on the wire
    rather than only what came back.
    """

    name = "scripted"

    def __init__(self, answers: list, *, natives: "frozenset[str]" = frozenset({"google_search"})) -> None:
        self.answers = list(answers)
        self.requests: list[dict] = []
        self._natives = natives

    def supports_native(self, key: str) -> bool:
        return key in self._natives

    def generate(self, **kwargs) -> LlmResponse:
        self.requests.append(kwargs)
        if not self.answers:
            raise AssertionError(
                "the scripted client ran out of answers -- the agent asked for more turns than the test wrote"
            )
        answer = self.answers.pop(0)
        return answer if isinstance(answer, LlmResponse) else LlmResponse(text=str(answer))
