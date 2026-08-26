"""Turning a Python function into a declaration a model can call.

The whole point of a code-first toolkit is that the Python signature *is* the
contract. Writing the schema by hand beside the function gives you two things
that drift apart silently, and the drift is invisible: the model is told the
tool takes `query` while the function takes `q`, every call fails with a
TypeError, and nothing in the declaration looks wrong.

So the declaration is derived, and `check_declaration_matches` asserts the
agreement **in both directions** -- every declared parameter is one the
function accepts, and every parameter the function requires is declared. The
reverse is the direction nobody checks, and it is the one that produces a tool
the model can never call correctly.

## Types

Gemini's schema is a subset of OpenAPI. The canonical examples in Google's own
cookbook spell the types in upper case (`OBJECT`, `STRING`), so that is what is
emitted here; lower case is also accepted by the API, and emitting the form the
documentation uses is the one less likely to meet an edge.

An unannotated parameter is refused rather than guessed at as a string. A tool
whose parameter types were invented is a tool that fails at the point where it
is least obvious why.
"""

from __future__ import annotations

import inspect
import typing

# Gemini's OpenAPI subset. Anything not in here has to be spelled out by the
# tool author rather than approximated.
_SIMPLE = {
    str: "STRING",
    bool: "BOOLEAN",
    int: "INTEGER",
    float: "NUMBER",
}


def _unwrap_optional(annotation: typing.Any) -> "tuple[typing.Any, bool]":
    """`Optional[T]` -> `(T, True)`. Anything else -> `(annotation, False)`."""
    origin = typing.get_origin(annotation)
    if origin is typing.Union or str(origin) == "typing.Union" or origin is getattr(__import__("types"), "UnionType", None):
        args = [arg for arg in typing.get_args(annotation) if arg is not type(None)]
        if len(args) == 1:
            return args[0], True
    return annotation, False


def type_of(annotation: typing.Any, *, where: str) -> dict:
    """One parameter's schema.

    Raises rather than falling back to STRING. A guessed type is the quiet kind
    of wrong: everything looks declared, and the model sends `"3"` where the
    function wanted `3`.
    """
    annotation, _ = _unwrap_optional(annotation)

    if annotation in _SIMPLE:
        return {"type": _SIMPLE[annotation]}

    # A bare `list` or `dict` annotation has no origin, so it reaches here
    # before the parameterised branches below and needs saying explicitly.
    if annotation is list:
        raise TypeError(f"{where}: a bare `list` does not say what is in it; use `list[str]` or similar")
    if annotation is dict:
        return {"type": "OBJECT"}

    origin = typing.get_origin(annotation)
    if origin in (list, typing.List):
        args = typing.get_args(annotation)
        if not args:
            raise TypeError(f"{where}: a bare `list` does not say what is in it; use `list[str]` or similar")
        return {"type": "ARRAY", "items": type_of(args[0], where=f"{where}[]")}

    if origin in (dict, typing.Dict):
        # An object with no declared properties. Gemini accepts it, and it is
        # the honest declaration for "a bag of values this tool will validate
        # itself" -- unlike inventing property names that are not real.
        return {"type": "OBJECT"}

    if annotation is inspect.Parameter.empty:
        raise TypeError(
            f"{where}: no type annotation. This toolkit will not guess a parameter type -- "
            "annotate it, so the model is told what the function actually takes."
        )

    if isinstance(annotation, type) and issubclass(annotation, str):
        # str subclasses, including enums that inherit from str.
        return {"type": "STRING"}

    raise TypeError(
        f"{where}: {annotation!r} is not a type this can declare to a model. "
        "Use str, bool, int, float, list[...] or dict, or pass an explicit `parameters=` schema."
    )


def _doc_first_line(function: typing.Callable) -> str:
    doc = inspect.getdoc(function) or ""
    for line in doc.splitlines():
        if line.strip():
            return line.strip()
    return ""


def _doc_params(function: typing.Callable) -> "dict[str, str]":
    """Per-parameter descriptions from a plain `name: text` block in the docstring.

    Deliberately simple: a line of the form `name: description` under any
    heading. It reads Google-style `Args:` sections without pretending to be a
    docstring parser, and a description it does not find is simply absent
    rather than invented.
    """
    doc = inspect.getdoc(function) or ""
    found: dict[str, str] = {}
    names = set(inspect.signature(function).parameters)
    current: str | None = None
    for raw in doc.splitlines():
        line = raw.strip()
        if not line:
            current = None
            continue
        if ":" in line:
            head, _, tail = line.partition(":")
            candidate = head.strip().split(" ")[0].strip("*")
            if candidate in names:
                found[candidate] = tail.strip()
                current = candidate
                continue
        if current and line:
            found[current] = f"{found[current]} {line}".strip()
    return found


def declaration_for(
    function: typing.Callable,
    *,
    name: str | None = None,
    description: str | None = None,
) -> dict:
    """The `functionDeclarations` entry for a Python callable.

    Shape taken from Google's REST cookbook rather than from memory:
    `{"name", "description", "parameters": {"type": "OBJECT", "properties", "required"}}`.
    """
    signature = inspect.signature(function)
    tool_name = name or function.__name__
    properties: dict[str, dict] = {}
    required: list[str] = []
    described = _doc_params(function)

    for parameter_name, parameter in signature.parameters.items():
        if parameter_name in ("self", "cls"):
            continue
        if parameter.kind in (inspect.Parameter.VAR_POSITIONAL, inspect.Parameter.VAR_KEYWORD):
            # *args and **kwargs cannot be declared: there is no name for the
            # model to send. Refusing is better than declaring a tool whose
            # real interface is wider than what was published.
            raise TypeError(
                f"{tool_name}: *{parameter_name} cannot be declared to a model. "
                "Give the tool named parameters."
            )
        schema = type_of(parameter.annotation, where=f"{tool_name}.{parameter_name}")
        text = described.get(parameter_name, "")
        if text:
            schema = {**schema, "description": text}
        properties[parameter_name] = schema
        if parameter.default is inspect.Parameter.empty:
            required.append(parameter_name)

    text = description if description is not None else _doc_first_line(function)
    if not text:
        raise ValueError(
            f"{tool_name}: a tool needs a description. It is the only thing the model reads to "
            "decide whether to call it, so an undescribed tool is one that never gets used, or "
            "gets used for the wrong thing."
        )

    declaration: dict = {"name": tool_name, "description": text}
    # An object with no properties is omitted entirely rather than sent empty:
    # some providers reject `{"type": "OBJECT", "properties": {}}`, and a tool
    # that takes nothing is a real and common thing.
    if properties:
        declaration["parameters"] = {"type": "OBJECT", "properties": properties, "required": required}
    return declaration


def check_declaration_matches(function: typing.Callable, declaration: dict) -> None:
    """Assert that a declaration and a function agree, in both directions.

    Raises `ValueError` naming the mismatch. This is the guard against the
    failure this module exists to prevent, and it is checked both ways because
    the reverse direction -- a parameter the function requires and the
    declaration never mentions -- is the one that produces a tool the model can
    never call successfully, with nothing in the declaration looking wrong.
    """
    signature = inspect.signature(function)
    accepted = {
        name
        for name, parameter in signature.parameters.items()
        if name not in ("self", "cls")
        and parameter.kind not in (inspect.Parameter.VAR_POSITIONAL, inspect.Parameter.VAR_KEYWORD)
    }
    needed = {
        name
        for name, parameter in signature.parameters.items()
        if name in accepted and parameter.default is inspect.Parameter.empty
    }

    parameters = declaration.get("parameters") or {}
    declared = set((parameters.get("properties") or {}).keys())
    declared_required = set(parameters.get("required") or [])

    unknown = declared - accepted
    if unknown:
        raise ValueError(
            f"{declaration.get('name')} declares {sorted(unknown)}, which {function.__name__} does not accept. "
            "The model would be told to send an argument the function rejects."
        )

    missing = needed - declared
    if missing:
        raise ValueError(
            f"{declaration.get('name')} never declares {sorted(missing)}, which {function.__name__} requires. "
            "The model has no way to know to send it, so every call would fail."
        )

    over_required = declared_required - needed
    if over_required:
        raise ValueError(
            f"{declaration.get('name')} marks {sorted(over_required)} required, but {function.__name__} "
            "has defaults for them. The model would be forced to invent values it was not asked for."
        )
