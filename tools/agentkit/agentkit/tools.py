"""Tools: the things an agent can do.

There are two kinds here and the difference is not cosmetic.

**Function tools** are Python callables. The runner executes them, hands the
result back to the model, and the model carries on. You write them; this
toolkit declares them and calls them.

**Native tools** are executed by the *provider*, not by this process.
`GoogleSearch()` is one: Gemini performs the search itself and returns an
answer already grounded, with the queries it ran and the pages it used attached
as grounding metadata. Nothing in this process ever sees a search API.

Keeping them apart matters because of what happens on a provider that does not
support a native tool. The tempting behaviour is to drop it and carry on, and
that produces **an agent that appears to have a capability it does not have**:
it answers from memory, confidently, about last week's news. So an unsupported
native tool raises by name. An agent that cannot search should fail to start,
not quietly become an agent that makes things up.
"""

from __future__ import annotations

import dataclasses
import inspect
import typing

from .errors import ToolError
from .schema import check_declaration_matches, declaration_for


@dataclasses.dataclass
class ToolContext:
    """What a tool is told about the call it is part of.

    Passed only to tools that ask for it -- a parameter annotated
    `ToolContext` is filled in by the runner and is never declared to the
    model, so it cannot be forged by whatever the model sends.
    """

    agent_name: str
    session_id: str
    state: dict
    step: int


@dataclasses.dataclass
class ToolResult:
    """What came back from running a tool.

    `ok` is separate from `value` on purpose. A tool that failed and a tool that
    returned nothing are different, and folding them together is how "no
    results" and "the search is broken" become the same sentence to a model.
    """

    name: str
    ok: bool
    value: typing.Any = None
    error: str = ""

    def for_model(self) -> dict:
        """The `functionResponse.response` payload.

        A failure is reported *to the model* rather than raised, because a model
        told "that failed, and here is why" can try something else, and one that
        never hears about it cannot.
        """
        if self.ok:
            return {"result": self.value}
        return {"error": self.error}


class Tool:
    """Base class. A tool is either declared-and-run here, or native."""

    #: Set on subclasses the provider executes rather than this process.
    native = False

    @property
    def name(self) -> str:  # pragma: no cover - overridden
        raise NotImplementedError

    def declaration(self) -> dict:  # pragma: no cover - overridden
        raise NotImplementedError


class FunctionTool(Tool):
    """A Python callable the model may call.

    The declaration is derived from the signature and then checked against it,
    so a tool cannot ship with a contract the function does not honour. The
    check runs at construction -- when the agent is defined -- rather than at
    the first call, because the point of a code-first toolkit is that a broken
    tool is a problem you have before you start paying for tokens.
    """

    def __init__(
        self,
        function: typing.Callable,
        *,
        name: str | None = None,
        description: str | None = None,
    ) -> None:
        self.function = function
        self._name = name or function.__name__
        self._context_parameter = _context_parameter(function)
        self._declaration = declaration_for(
            _without(function, self._context_parameter),
            name=self._name,
            description=description,
        )
        check_declaration_matches(_without(function, self._context_parameter), self._declaration)

    @property
    def name(self) -> str:
        return self._name

    def declaration(self) -> dict:
        return dict(self._declaration)

    def run(self, arguments: dict, context: ToolContext) -> ToolResult:
        """Call it, and turn anything it raises into a result the model can read."""
        given = dict(arguments or {})
        declared = set(((self._declaration.get("parameters") or {}).get("properties") or {}))
        unexpected = set(given) - declared
        if unexpected:
            # Models do invent arguments. Saying which ones were not asked for
            # is more useful than a TypeError from deep inside the function.
            return ToolResult(
                self.name,
                ok=False,
                error=f"{self.name} was called with {sorted(unexpected)}, which it does not take. "
                f"It takes {sorted(declared)}.",
            )
        if self._context_parameter:
            given[self._context_parameter] = context
        try:
            value = self.function(**given)
        except ToolError as error:
            return ToolResult(self.name, ok=False, error=str(error))
        except TypeError as error:
            return ToolResult(self.name, ok=False, error=f"{self.name} rejected those arguments: {error}")
        except Exception as error:  # noqa: BLE001 - a tool must not take the run down
            return ToolResult(self.name, ok=False, error=f"{self.name} raised {type(error).__name__}: {error}")
        return ToolResult(self.name, ok=True, value=value)


class NativeTool(Tool):
    """A tool the provider runs. This process never executes it."""

    native = True

    def __init__(self, key: str, *, config: dict | None = None, human_name: str = "") -> None:
        self.key = key
        self.config = dict(config or {})
        self.human_name = human_name or key

    @property
    def name(self) -> str:
        return self.key

    def declaration(self) -> dict:
        """The entry this contributes to the request's `tools` array.

        For Gemini that is `{"google_search": {}}` -- a sibling of
        `functionDeclarations`, not an entry inside it.
        """
        return {self.key: self.config}


def GoogleSearch() -> NativeTool:  # noqa: N802 - reads as a type at the call site
    """Google Search, performed by Gemini itself.

    The model runs the searches and answers from what it found; the queries it
    used and the pages it read come back as grounding metadata, which the dev UI
    shows. There is no search API key here because there is no search call here.

    **One limitation, and it is a real one.** Some Gemini model versions refuse
    a request that carries both `google_search` and `functionDeclarations`. This
    toolkit does not pretend to know which versions, because the documentation
    that would settle it is not reachable from where this was written -- so it
    does not silently drop either one. If the provider refuses the combination,
    the error comes back with the provider's own words.

    The structural answer is the one this toolkit is built for anyway: give the
    search to a specialist sub-agent, and let a coordinator with function tools
    delegate to it. `examples/research_team.py` does exactly that.
    """
    return NativeTool("google_search", human_name="Google Search")


def UrlContext() -> NativeTool:  # noqa: N802
    """Let the model read URLs mentioned in the prompt. Also provider-side."""
    return NativeTool("url_context", human_name="URL context")


def _context_parameter(function: typing.Callable) -> str | None:
    """The name of the `ToolContext` parameter, if the function wants one."""
    for name, parameter in inspect.signature(function).parameters.items():
        annotation = parameter.annotation
        if annotation is ToolContext or annotation == "ToolContext":
            return name
    return None


def _without(function: typing.Callable, parameter: str | None) -> typing.Callable:
    """A view of `function` with the context parameter hidden from the schema.

    The context is filled in by the runner, so declaring it would invite the
    model to send one -- which is the difference between a value this process
    controls and a value whatever is on the other end of the API controls.
    """
    if not parameter:
        return function

    signature = inspect.signature(function)
    kept = [value for name, value in signature.parameters.items() if name != parameter]

    def view(*args, **kwargs):  # pragma: no cover - never called
        return function(*args, **kwargs)

    view.__name__ = function.__name__
    view.__doc__ = function.__doc__
    view.__signature__ = signature.replace(parameters=kept)
    return view
