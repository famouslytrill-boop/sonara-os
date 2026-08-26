"""A coordinator with two specialists.

    python -m agentkit.devui examples/research_team.py

## Why the search lives in its own agent

`GoogleSearch()` is run by Gemini itself, and some model versions refuse a
request carrying both `google_search` and `functionDeclarations`. Giving the
search to a specialist that has *no* function tools sidesteps that entirely --
and it is the better shape anyway. The coordinator's job is deciding who does
what; the researcher's job is finding things out and saying where they came
from. Each instruction is shorter and more specific than one agent's would be.

The descriptions are written for the coordinator to read. That is the only
thing it uses to choose, so they say what each agent is *for* rather than what
it is called.
"""

from agentkit import Agent, GoogleSearch, ToolContext

# --- a couple of ordinary Python functions, which is all a tool is --------


def note(fact: str, source: str, context: ToolContext) -> str:
    """Write down something worth keeping, with where it came from.

    Args:
        fact: The thing to remember, in one sentence.
        source: Where it came from -- a URL, or how it was worked out.
    """
    kept = context.state.setdefault("notes", [])
    kept.append({"fact": fact, "source": source, "by": context.agent_name})
    return f"Noted. {len(kept)} note(s) so far."


def read_notes(context: ToolContext) -> list:
    """List everything noted in this conversation so far."""
    # An empty list is returned as an empty list, and the instruction below
    # tells the agent to say so. "No notes yet" and "I could not read the
    # notes" are different facts, and a tool that returned "" for both would
    # make them the same sentence.
    return list(context.state.get("notes", []))


def compare(first: float, second: float, label: str = "difference") -> dict:
    """Work out the difference and the percentage change between two numbers.

    Args:
        first: The earlier or baseline number.
        second: The later or comparison number.
        label: What to call the result.
    """
    change = second - first
    return {
        "label": label,
        "difference": change,
        # None rather than 0: the percentage change from zero is undefined, and
        # reporting it as 0% would be a number nobody computed.
        "percent": None if first == 0 else round(change / first * 100, 2),
    }


# --- the team -------------------------------------------------------------

researcher = Agent(
    name="researcher",
    description="Looks things up on the web. Use for anything current, factual, or outside what you already know.",
    instruction=(
        "Search before you answer. Give the answer first and the sources under it. "
        "If the search did not turn up what was asked for, say that plainly -- do not fill the gap from memory. "
        "Note anything worth keeping with the note tool."
    ),
    tools=[GoogleSearch()],
)

analyst = Agent(
    name="analyst",
    description="Does arithmetic on figures already in the conversation and writes up what they mean.",
    instruction=(
        "Work with the numbers you were given. If you need a figure nobody has provided, say which one is missing "
        "rather than estimating it. Show the arithmetic."
    ),
    tools=[compare, note, read_notes],
)

root_agent = Agent(
    name="coordinator",
    instruction=(
        "You run a two-person desk. Hand anything needing current or external information to the researcher, "
        "and anything needing arithmetic over figures already established to the analyst. "
        "Answer directly when the question is neither. "
        "When you have no notes, say there are none rather than inventing a summary."
    ),
    tools=[read_notes],
    sub_agents=[researcher, analyst],
)
