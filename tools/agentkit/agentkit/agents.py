"""Defining an agent in Python.

Code-first means the definition is the thing that runs. There is no YAML, no
registry file and no decorator magic: an `Agent` is a dataclass, its tools are
Python functions, and its team is a list of other `Agent`s.

## What is checked when you define one, and why then

Everything checkable is checked in `__post_init__` -- before a single token is
spent. A name that cannot be a function name, a sub-agent with no description, a
team with two agents called the same thing, a cycle: all of these produce an
agent that behaves oddly at run time in ways that are hard to read back from a
transcript. Refusing at definition turns each into a stack trace pointing at the
line that is wrong.

The description rule is the one that looks fussy and is not. A coordinator
chooses which sub-agent to hand work to by reading their descriptions and
nothing else. A sub-agent with no description is one the coordinator can only
pick by guessing at its name -- so it is refused, with that reason.
"""

from __future__ import annotations

import dataclasses
import re

from .tools import FunctionTool, Tool

#: Agent names become the values of an enum in the transfer tool, so they have
#: to be things a model can reproduce exactly. Identifiers are the safe set.
NAME = re.compile(r"^[A-Za-z][A-Za-z0-9_]{0,62}$")

#: Sensible for the common case and easily overridden. Flash rather than Pro
#: because a coordinator makes many small routing decisions, and paying Pro
#: prices to choose between three sub-agents is the wrong default.
DEFAULT_MODEL = "gemini-2.5-flash"


@dataclasses.dataclass
class Agent:
    """One agent: a name, an instruction, some tools, and maybe a team."""

    name: str
    instruction: str
    #: What this agent is for, in one line, written for *another agent to read*.
    #: Required on any agent that is somebody's sub-agent.
    description: str = ""
    model: str = DEFAULT_MODEL
    tools: list = dataclasses.field(default_factory=list)
    sub_agents: list = dataclasses.field(default_factory=list)
    temperature: float | None = None

    def __post_init__(self) -> None:
        if not NAME.match(self.name or ""):
            raise ValueError(
                f"{self.name!r} is not a usable agent name. A coordinator delegates by naming an agent "
                "back to the model, so names must be letters, digits and underscores, starting with a letter."
            )
        if not (self.instruction or "").strip():
            raise ValueError(f"{self.name}: an agent with no instruction is a model with a name.")

        # Plain callables are wrapped here, so `tools=[my_function]` works and
        # the signature check still runs at definition time.
        self.tools = [tool if isinstance(tool, Tool) else FunctionTool(tool) for tool in self.tools]

        seen: set[str] = set()
        for tool in self.tools:
            if tool.name in seen:
                raise ValueError(f"{self.name}: two tools are both called {tool.name!r}; the model could not tell them apart.")
            seen.add(tool.name)

        for sub in self.sub_agents:
            if not isinstance(sub, Agent):
                raise TypeError(f"{self.name}: sub_agents must be Agents, not {type(sub).__name__}")
            if not (sub.description or "").strip():
                raise ValueError(
                    f"{sub.name} has no description, so {self.name} would have nothing to read when deciding "
                    "whether to hand it the work. Give it one line saying what it is for."
                )

        names = [sub.name for sub in self.sub_agents]
        duplicates = {name for name in names if names.count(name) > 1}
        if duplicates:
            raise ValueError(f"{self.name}: more than one sub-agent is called {sorted(duplicates)}.")

        _refuse_cycles(self)

    # --- reading the tree ------------------------------------------------

    @property
    def function_tools(self) -> list:
        return [tool for tool in self.tools if not tool.native]

    @property
    def native_tools(self) -> list:
        return [tool for tool in self.tools if tool.native]

    def find(self, name: str) -> "Agent | None":
        """This agent or any agent beneath it, by name."""
        if self.name == name:
            return self
        for sub in self.sub_agents:
            found = sub.find(name)
            if found:
                return found
        return None

    def walk(self) -> list:
        """Every agent in the tree, this one first."""
        out = [self]
        for sub in self.sub_agents:
            out.extend(sub.walk())
        return out


def _refuse_cycles(root: Agent) -> None:
    """A team that contains itself would delegate for ever.

    Checked by object identity rather than by name: two different agents may
    legitimately share a name in separate trees, and the thing that actually
    loops is the same object appearing twice on one path.
    """

    def walk(agent: Agent, path: list) -> None:
        if any(node is agent for node in path):
            names = " -> ".join(node.name for node in path + [agent])
            raise ValueError(f"the team contains a cycle: {names}. Delegation would never end.")
        for sub in agent.sub_agents:
            walk(sub, path + [agent])

    walk(root, [])
