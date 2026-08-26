"""agentkit -- a code-first toolkit for building agents in Python.

    from agentkit import Agent, GoogleSearch, GeminiClient, Runner

    researcher = Agent(
        name="researcher",
        description="Looks things up on the web and reports what it found.",
        instruction="Search before answering. Say where each fact came from.",
        tools=[GoogleSearch()],
    )

    def open_ticket(summary: str, priority: str = "normal") -> str:
        '''Open a support ticket.

        Args:
            summary: One line describing the problem.
            priority: low, normal or urgent.
        '''
        return f"TICKET-{abs(hash(summary)) % 10000}"

    desk = Agent(
        name="coordinator",
        instruction="Help the customer. Research what you do not know; raise a ticket when something is broken.",
        tools=[open_ticket],
        sub_agents=[researcher],
    )

    runner = Runner(desk, client=GeminiClient())
    print(runner.run("Has there been an outage at our CDN today?").text)

Nothing outside the standard library is imported anywhere in this package.
`python -m agentkit.devui` opens a browser UI for chatting with an agent and
reading exactly what it did.
"""

from .agents import DEFAULT_MODEL, Agent
from .errors import AgentkitError, NotConfigured, ProviderError, ToolError, UnknownAgent
from .events import Event, RunResult, Session
from .models import (
    FunctionCall,
    FunctionResponse,
    GeminiClient,
    LlmResponse,
    Message,
    OpenAICompatibleClient,
    ScriptedClient,
    Text,
)
from .runner import Runner
from .schema import check_declaration_matches, declaration_for
from .tools import FunctionTool, GoogleSearch, NativeTool, Tool, ToolContext, ToolResult, UrlContext

__version__ = "0.1.0"

__all__ = [
    "Agent", "DEFAULT_MODEL",
    "Runner",
    "GeminiClient", "OpenAICompatibleClient", "ScriptedClient",
    "GoogleSearch", "UrlContext", "FunctionTool", "NativeTool", "Tool", "ToolContext", "ToolResult",
    "Message", "Text", "FunctionCall", "FunctionResponse", "LlmResponse",
    "Session", "Event", "RunResult",
    "AgentkitError", "NotConfigured", "ProviderError", "ToolError", "UnknownAgent",
    "declaration_for", "check_declaration_matches",
    "__version__",
]
