"""What can go wrong, named.

Every error here exists so a caller can tell *which* thing failed. The one
distinction that matters most is between "this is not configured" and "this
failed": the first is a setup problem the person can fix in a minute, and the
second is a runtime problem they cannot. Collapsing them into one exception
type is how a missing API key ends up looking like a broken model.
"""


class AgentkitError(Exception):
    """Base for everything raised here."""


class NotConfigured(AgentkitError):
    """A provider or tool that needs credentials does not have them.

    Carries the name of what to set, because "not configured" without that is
    a message the reader has to go and search the source for.
    """

    def __init__(self, what: str, *, set_these: "list[str] | None" = None) -> None:
        self.what = what
        self.set_these = list(set_these or [])
        detail = f" Set {' and '.join(self.set_these)}." if self.set_these else ""
        super().__init__(f"{what} is not configured.{detail}")


class ProviderError(AgentkitError):
    """The model provider answered, and what it said was not usable.

    `status` is the HTTP status when there was one. `retryable` is set from the
    status rather than guessed: 429 and 5xx are worth trying again, and a 400 is
    the request being wrong, which retrying will not fix.
    """

    def __init__(self, message: str, *, status: "int | None" = None, body: str = "") -> None:
        self.status = status
        self.body = body
        self.retryable = status is not None and (status == 429 or status >= 500)
        super().__init__(message)


class ToolError(AgentkitError):
    """A tool refused or failed.

    This is not raised through the runner: a tool that fails hands its failure
    back to the model as a result, because a model that is told "that tool
    failed and here is why" can often do something sensible, and one that never
    hears about it cannot.
    """


class UnknownAgent(AgentkitError):
    """A transfer named an agent that does not exist."""
