"""The loop: ask the model, run what it asked for, ask again.

## Delegation is a tool, and it is checked like one

A coordinator delegates by calling `transfer_to_agent`, which this adds
automatically to any agent that has sub-agents. Two properties matter and both
are enforced here rather than trusted:

**A transfer to an agent that does not exist fails loudly.** The failure comes
back to the model as a tool error naming every agent that does exist, and it is
recorded in the event log as a failed transfer. The alternative -- ignoring it
and letting the coordinator carry on -- produces a run where the work was never
done and nothing says so, which is this codebase's signature defect wearing a
different hat.

**A transfer sticks.** The sub-agent stays the active agent for the rest of the
session, so a follow-up question goes to the specialist rather than back to a
coordinator that has already handed the topic over.

## Hitting the step limit is not an answer

A run that runs out of steps returns `stop_reason="step_limit"` and
`finished == False`. It still carries text, because the last thing the model
said is worth showing -- but a caller that renders `result.text` without
looking at `finished` shows a truncated run as a complete one. `RunResult`
documents that at the property, and the dev UI marks it in red.

## Native tools are checked before anything is spent

Every native tool on every agent in the tree is checked against the provider
when the runner is built. A provider that cannot run `google_search` makes the
runner refuse to exist rather than quietly produce an agent that answers from
memory.
"""

from __future__ import annotations

import uuid

from .agents import Agent
from .errors import NotConfigured, ProviderError
from .events import RunResult, Session
from .models import FunctionCall, FunctionResponse, Message, Text
from .tools import ToolContext, ToolResult

TRANSFER = "transfer_to_agent"

DEFAULT_MAX_STEPS = 12


class Runner:
    """Runs one agent tree against one provider."""

    def __init__(self, agent: Agent, *, client, max_steps: int = DEFAULT_MAX_STEPS) -> None:
        self.agent = agent
        self.client = client
        self.max_steps = max_steps
        self._check_natives()

    def _check_natives(self) -> None:
        for node in self.agent.walk():
            for tool in node.native_tools:
                if not self.client.supports_native(tool.key):
                    raise NotConfigured(
                        f"{node.name} uses {tool.human_name}, which the {self.client.name} provider does not run. "
                        f"It is not dropped, because an agent that quietly loses its {tool.human_name} "
                        "answers from memory and sounds exactly as certain"
                    )

    # --- sessions ---------------------------------------------------------

    def new_session(self, session_id: str | None = None) -> Session:
        return Session(id=session_id or uuid.uuid4().hex, active_agent=self.agent.name)

    # --- the loop ---------------------------------------------------------

    def run(self, message: str, *, session: Session | None = None) -> RunResult:
        session = session or self.new_session()
        if not session.active_agent:
            session.active_agent = self.agent.name

        session.messages.append(Message("user", [Text(message)]))
        session.record("user", session.active_agent, message)

        steps = 0
        usage: dict = {}
        grounding = None
        last_text = ""

        while steps < self.max_steps:
            steps += 1
            active = self.agent.find(session.active_agent) or self.agent
            declarations = [tool.declaration() for tool in active.function_tools]
            if active.sub_agents:
                declarations.append(_transfer_declaration(active))

            try:
                answer = self.client.generate(
                    model=active.model,
                    system_instruction=_instruction_for(active),
                    messages=list(session.messages),
                    function_declarations=declarations,
                    native_tools=[tool.declaration() for tool in active.native_tools],
                    temperature=active.temperature,
                )
            except ProviderError as error:
                # Recorded and raised. The event log is the debugging story, and
                # a run that died with nothing in the log is the hardest kind to
                # read back.
                session.record("error", active.name, str(error), status=error.status, retryable=error.retryable)
                raise

            usage = _add_usage(usage, answer.usage)
            if answer.grounding:
                grounding = answer.grounding

            if answer.text:
                last_text = answer.text
                session.record("model_text", active.name, answer.text)

            if not answer.calls:
                session.messages.append(Message("model", [Text(answer.text)]))
                return RunResult(
                    text=answer.text,
                    session=session,
                    stop_reason="final",
                    steps=steps,
                    agent=active.name,
                    grounding=grounding,
                    usage=usage,
                )

            # The model's own turn goes into history exactly as it came back,
            # calls included: leaving the call out and sending only its result
            # gives the model a result to a question it has no record of asking.
            model_parts = ([Text(answer.text)] if answer.text else []) + list(answer.calls)
            session.messages.append(Message("model", model_parts))

            responses: list = []
            transferred_to: str | None = None
            for call in answer.calls:
                session.record("tool_call", active.name, call.name, arguments=call.arguments)
                if call.name == TRANSFER:
                    result, target = self._transfer(active, call, session)
                    if target:
                        transferred_to = target
                else:
                    result = self._call_tool(active, call, session, steps)
                session.record(
                    "tool_result",
                    active.name,
                    call.name,
                    ok=result.ok,
                    value=_readable(result.value),
                    error=result.error,
                )
                responses.append(FunctionResponse(name=call.name, response=result.for_model(), call_id=call.call_id))

            session.messages.append(Message("function", responses))
            if transferred_to:
                session.active_agent = transferred_to

        session.record("limit", session.active_agent, f"stopped after {self.max_steps} steps")
        return RunResult(
            text=last_text,
            session=session,
            stop_reason="step_limit",
            steps=steps,
            agent=session.active_agent,
            grounding=grounding,
            usage=usage,
        )

    # --- the two kinds of call -------------------------------------------

    def _call_tool(self, active: Agent, call: FunctionCall, session: Session, step: int) -> ToolResult:
        tool = next((candidate for candidate in active.function_tools if candidate.name == call.name), None)
        if tool is None:
            # Models call tools that are not there, usually ones a sibling agent
            # has. Naming what this agent does have is what lets it recover.
            available = sorted(candidate.name for candidate in active.function_tools)
            return ToolResult(
                call.name,
                ok=False,
                error=f"{active.name} has no tool called {call.name!r}. It has {available or 'no tools'}.",
            )
        context = ToolContext(agent_name=active.name, session_id=session.id, state=session.state, step=step)
        return tool.run(call.arguments, context)

    def _transfer(self, active: Agent, call: FunctionCall, session: Session):
        wanted = str(call.arguments.get("agent_name") or "")
        target = next((sub for sub in active.sub_agents if sub.name == wanted), None)
        if target is None:
            names = sorted(sub.name for sub in active.sub_agents)
            session.record("transfer", active.name, wanted, ok=False, available=names)
            return (
                ToolResult(
                    TRANSFER,
                    ok=False,
                    error=f"There is no sub-agent called {wanted!r}. {active.name} can transfer to {names}.",
                ),
                None,
            )
        session.record("transfer", active.name, target.name, ok=True, reason=str(call.arguments.get("reason") or ""))
        return (
            ToolResult(TRANSFER, ok=True, value=f"{target.name} is now handling this. {target.description}"),
            target.name,
        )


def _transfer_declaration(agent: Agent) -> dict:
    """The delegation tool, built from this agent's actual team.

    The sub-agent names are an `enum`, so the model is choosing from a list
    rather than typing a name from memory -- which is the difference between a
    transfer that works and one that has to be recovered from. Their
    descriptions are in the tool description, because that is the only place the
    model gets to read what each one is for.
    """
    lines = "\n".join(f"- {sub.name}: {sub.description}" for sub in agent.sub_agents)
    return {
        "name": TRANSFER,
        "description": (
            "Hand this conversation to the team member best suited to it, and stop working on it yourself. "
            "Transfer when the request is squarely in one member's area; answer it yourself when it is not. "
            f"The team is:\n{lines}"
        ),
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "agent_name": {
                    "type": "STRING",
                    "description": "Which team member takes it from here.",
                    "enum": [sub.name for sub in agent.sub_agents],
                },
                "reason": {
                    "type": "STRING",
                    "description": "One line on why this is theirs, for whoever reads the trace later.",
                },
            },
            "required": ["agent_name"],
        },
    }


def _instruction_for(agent: Agent) -> str:
    """The agent's own instruction, plus who it is.

    The name is included because a transferred-to agent otherwise has no way of
    knowing it is now the one answering, and will sometimes reply as though it
    were still the coordinator.
    """
    parts = [f"You are {agent.name}."]
    if agent.description:
        parts.append(agent.description)
    parts.append(agent.instruction.strip())
    if agent.sub_agents:
        parts.append(
            "You lead a team. Use transfer_to_agent to hand over work that clearly belongs to one of them, "
            "and answer the rest yourself rather than transferring for the sake of it."
        )
    return "\n\n".join(parts)


def _add_usage(total: dict, more: dict) -> dict:
    """Token counts summed across the turns of one run.

    Only numbers are summed. A provider that reports something non-numeric has
    it carried through unchanged rather than coerced -- `int("high")` failing
    mid-run would be an odd way to lose an answer.
    """
    out = dict(total)
    for key, value in (more or {}).items():
        if isinstance(value, (int, float)) and isinstance(out.get(key, 0), (int, float)):
            out[key] = out.get(key, 0) + value
        else:
            out[key] = value
    return out


def _readable(value):
    """Tool results go in the log; the log becomes JSON for the UI."""
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, dict):
        return {str(key): _readable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_readable(item) for item in value]
    return repr(value)
