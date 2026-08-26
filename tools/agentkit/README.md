# agentkit

A code-first Python toolkit for building agents. An agent is a dataclass, its
tools are Python functions, and its team is a list of other agents. There is no
YAML, no registry file and no build step — the definition is the thing that
runs.

**No dependencies.** `urllib` makes the calls, `json` builds the bodies,
`http.server` serves the dev UI. A test reads every import in the package and
fails if one of them is not standard library, so that claim cannot rot.

```python
from agentkit import Agent, GoogleSearch, GeminiClient, Runner

def open_ticket(summary: str, priority: str = "normal") -> str:
    """Open a support ticket.

    Args:
        summary: One line describing the problem.
        priority: low, normal or urgent.
    """
    return f"TICKET-{abs(hash(summary)) % 10000}"

researcher = Agent(
    name="researcher",
    description="Looks things up on the web. Use for anything current or factual.",
    instruction="Search before answering. Say where each fact came from.",
    tools=[GoogleSearch()],
)

desk = Agent(
    name="coordinator",
    instruction="Help the customer. Research what you do not know; raise a ticket when something is broken.",
    tools=[open_ticket],
    sub_agents=[researcher],
)

runner = Runner(desk, client=GeminiClient())
print(runner.run("Has our CDN had an outage today?").text)
```

```
export GEMINI_API_KEY=...
python -m agentkit.devui examples/research_team.py
```

## The dev UI

Three panes: the team on the left, the conversation in the middle, and **the
trace on the right**. The trace is half the screen because reading a final
answer tells you almost nothing about a multi-agent run — the question is
nearly always *why did that agent get the work*, and only the trace answers it.
Every transfer, every tool call with the arguments the model actually sent,
every result, and the search queries and sources when the model searched.

It binds to `127.0.0.1` and has **no authentication**; the startup banner says
so every time, because anybody who reaches the port can spend your API credit.

## Tools

A tool is a function. The declaration sent to the model is derived from the
signature and the docstring, and then **checked against the signature in both
directions**: every declared parameter must be one the function accepts, and
every parameter the function requires must be declared. The second direction is
the one nobody checks, and it is the one that produces a tool the model can
never call successfully with nothing in the declaration looking wrong.

An unannotated parameter is refused rather than defaulted to a string, because a
guessed type is the quiet kind of wrong: everything looks declared, and the
model sends `"3"` where the function wanted `3`.

A tool that wants to know about the call it is part of takes a `ToolContext`
parameter. It is filled in by the runner and never declared, so nothing on the
other end of the API can forge its own agent name or session id.

```python
def note(fact: str, source: str, context: ToolContext) -> str:
    """Write down something worth keeping, with where it came from.

    Args:
        fact: The thing to remember.
        source: Where it came from.
    """
    context.state.setdefault("notes", []).append({"fact": fact, "source": source})
    return "Noted."
```

### Google Search

`GoogleSearch()` is a **native** tool: Gemini runs the searches itself and
answers already grounded, returning the queries it ran and the pages it read.
There is no search API key here because there is no search call here.

On a provider that cannot run it, the `Runner` **refuses to be built**. It is
not dropped, because an agent that quietly loses its search answers from memory
and sounds exactly as certain.

Some Gemini model versions refuse a request carrying both `google_search` and
`functionDeclarations`. This toolkit does not claim to know which — the page
that would settle it is not reachable from where this was written — so it sends
what you asked for and lets the provider's own words come back if it objects.
The structural answer is the one it is built for anyway: give the search to a
specialist sub-agent with no function tools, and let the coordinator delegate.
`examples/research_team.py` does that.

## Multi-agent systems

Give an agent `sub_agents` and it gets a `transfer_to_agent` tool built from its
actual team — the names as an `enum`, so the model chooses from a list rather
than typing one from memory, and each sub-agent's description in the tool
description, because that is the only thing the coordinator reads when deciding.

A sub-agent with no description is refused at definition, for that reason.

Three things hold at run time:

- **A transfer sticks.** The sub-agent stays active for the rest of the session,
  so a follow-up goes to the specialist rather than back to a coordinator that
  has already handed the topic over.
- **A transfer to an agent that does not exist fails loudly** — back to the
  model, naming every agent that does exist, and into the trace as a failed
  transfer. A coordinator carrying on as though it had delegated is a run where
  the work was never done and nothing says so.
- **A cycle is refused at definition**, by object identity, because that is what
  actually loops.

## Running out of steps is not an answer

```python
result = runner.run("...")
if not result.finished:
    print(f"stopped after {result.steps} steps — this is not a finished answer")
```

A run that hits `max_steps` comes back with `stop_reason="step_limit"` and
`finished == False`. It still carries text, because the last thing the model
said is worth showing — and rendering it without checking `finished` is how a
truncated run looks like a complete one. The dev UI draws it in the colour it
uses for problems.

## Other models

`OpenAICompatibleClient` speaks `/chat/completions`, so llama.cpp, vLLM and
Ollama's compatible route all work and an agent can run entirely on your own
hardware. The same derived declaration is spelled `OBJECT`/`STRING` for Gemini
and `object`/`string` for OpenAI. It reports no native tools, which is why a
`GoogleSearch()` agent pointed at it refuses rather than silently losing its
search.

Writing a third provider means implementing two methods: `supports_native(key)`
and `generate(...)`.

## The wire

The Gemini shapes are copied from Google's own REST cookbook rather than
recalled — `contents` with roles `user`, `model` and **`function`**, tools as
`{"functionDeclarations": [...]}`, a call arriving as a `functionCall` part and
its result going back as a `functionResponse` part whose `response` is an
object, parameter types in upper case. `tests/test_gemini_wire.py` asserts each
of those against a recorded request, because a body that looks plausible and is
not fails on the first real call.

**One thing worth knowing.** Google now documents a newer `interactions` API and
labels `generateContent` legacy. This targets `generateContent`, because that is
the contract whose exact wire shape could be read from where this was written —
`ai.google.dev` is blocked by this environment's egress proxy, so the newer one
could only have been guessed at. `base_url` and `api_version` are constructor
arguments, so moving is an argument change rather than a rewrite.

## Tests

```
python -m unittest discover -s tests -t .
```

69 tests, no test dependencies. Every guarantee in this README was broken on
purpose and the test that names it was watched failing before the guarantee was
put back.

## Inspiration and independence

The shape — code-first agents, tools from Python functions, a coordinator with
sub-agents, a dev UI — follows Google's Agent Development Kit, and `root_agent`
is the same name ADK uses so a file written for one loads in the other. None of
ADK's code is used or vendored here; this is an independent implementation
against the public Gemini REST API.
