"""What happened, in order.

The event log is the debugging story. A multi-agent run is hard to read from
its final answer alone -- the interesting question is almost always *why did
that agent get the work*, and that is only answerable if every transfer, tool
call and tool result is recorded with the agent that made it.

Every event carries `agent`, so a trace can be read as a conversation between
named participants rather than as one undifferentiated stream. That is what the
dev UI renders.
"""

from __future__ import annotations

import dataclasses
import time
import typing


@dataclasses.dataclass
class Event:
    #: One of: user, model_text, tool_call, tool_result, transfer, error, limit
    kind: str
    agent: str
    text: str = ""
    data: dict = dataclasses.field(default_factory=dict)
    at: float = dataclasses.field(default_factory=time.time)

    def as_dict(self) -> dict:
        return {"kind": self.kind, "agent": self.agent, "text": self.text, "data": self.data, "at": self.at}


@dataclasses.dataclass
class Session:
    """One conversation, and everything that happened inside it."""

    id: str
    #: Provider-neutral `Message`s -- what actually gets sent next turn.
    messages: list = dataclasses.field(default_factory=list)
    #: The readable log. Longer than `messages` on purpose: it holds the
    #: transfers and the failures, which are not part of what the model sees.
    events: list = dataclasses.field(default_factory=list)
    #: Whatever tools want to remember between calls.
    state: dict = dataclasses.field(default_factory=dict)
    #: Who is answering now. A transfer changes this and it stays changed, so a
    #: follow-up question goes to the specialist rather than back to the
    #: coordinator that has already handed the topic over.
    active_agent: str = ""

    def record(self, kind: str, agent: str, text: str = "", **data: typing.Any) -> Event:
        event = Event(kind=kind, agent=agent, text=text, data=data)
        self.events.append(event)
        return event


@dataclasses.dataclass
class RunResult:
    """What one `run()` produced."""

    text: str
    session: Session
    #: "final" when the model finished, "step_limit" when it was stopped.
    stop_reason: str = "final"
    steps: int = 0
    agent: str = ""
    #: Present only when the model said it searched.
    grounding: dict | None = None
    usage: dict = dataclasses.field(default_factory=dict)

    @property
    def finished(self) -> bool:
        """Whether this is an answer or an interruption.

        Read this before showing `text` to anybody. A run stopped at the step
        limit still has text on it -- the last thing the model said -- and
        presenting that as the answer is how a truncated run looks like a
        complete one.
        """
        return self.stop_reason == "final"
