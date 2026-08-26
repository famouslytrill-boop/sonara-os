"""Delegation: the thing that is hard to see going wrong.

A coordinator that thinks it delegated and did not produces a run where the
work was never done and the transcript reads normally. Every test here is about
making that state impossible or visible.
"""

import unittest

from agentkit import Agent, FunctionCall, GoogleSearch, LlmResponse, NotConfigured, Runner, ScriptedClient


def convert(amount: float, rate: float) -> float:
    """Convert an amount at a rate.

    Args:
        amount: how much
        rate: the rate
    """
    return round(amount * rate, 2)


def team() -> Agent:
    money = Agent(
        name="money",
        description="Converts currency and does arithmetic on figures already given.",
        instruction="Do the sums.",
        tools=[convert],
    )
    words = Agent(
        name="words",
        description="Writes and edits prose.",
        instruction="Write well.",
    )
    return Agent(name="desk", instruction="Route the work.", sub_agents=[money, words])


class DefiningATeam(unittest.TestCase):
    def test_a_sub_agent_must_say_what_it_is_for(self):
        with self.assertRaises(ValueError) as raised:
            Agent(
                name="desk",
                instruction="Route.",
                sub_agents=[Agent(name="mystery", instruction="Do things.")],
            )
        # The coordinator reads descriptions and nothing else when choosing.
        self.assertIn("nothing to read when deciding", str(raised.exception))

    def test_a_cycle_is_refused_at_definition(self):
        first = Agent(name="first", description="One.", instruction="Do.")
        second = Agent(name="second", description="Two.", instruction="Do.", sub_agents=[first])
        first.sub_agents = [second]
        with self.assertRaises(ValueError) as raised:
            Agent(name="top", instruction="Route.", sub_agents=[second])
        self.assertIn("cycle", str(raised.exception))

    def test_two_sub_agents_cannot_share_a_name(self):
        with self.assertRaises(ValueError):
            Agent(
                name="desk",
                instruction="Route.",
                sub_agents=[
                    Agent(name="same", description="A.", instruction="A"),
                    Agent(name="same", description="B.", instruction="B"),
                ],
            )

    def test_a_name_a_model_could_not_reproduce_is_refused(self):
        for bad in ["", "has spaces", "2fast", "no-hyphens", "x" * 80]:
            with self.assertRaises(ValueError):
                Agent(name=bad, instruction="Do.")


class TheTransferTool(unittest.TestCase):
    def test_the_team_is_an_enum_rather_than_a_name_typed_from_memory(self):
        client = ScriptedClient([LlmResponse(text="ok")])
        Runner(team(), client=client).run("hi")
        transfer = next(d for d in client.requests[0]["function_declarations"] if d["name"] == "transfer_to_agent")
        self.assertEqual(transfer["parameters"]["properties"]["agent_name"]["enum"], ["money", "words"])

    def test_every_sub_agents_description_reaches_the_model(self):
        client = ScriptedClient([LlmResponse(text="ok")])
        Runner(team(), client=client).run("hi")
        transfer = next(d for d in client.requests[0]["function_declarations"] if d["name"] == "transfer_to_agent")
        self.assertIn("Converts currency", transfer["description"])
        self.assertIn("Writes and edits prose", transfer["description"])

    def test_an_agent_with_no_team_is_not_given_a_transfer_tool(self):
        client = ScriptedClient([LlmResponse(text="ok")])
        alone = Agent(name="alone", instruction="Work.")
        Runner(alone, client=client).run("hi")
        self.assertEqual([d["name"] for d in client.requests[0]["function_declarations"]], [])


class TransferringWork(unittest.TestCase):
    def test_the_sub_agents_own_instruction_and_tools_take_over(self):
        client = ScriptedClient([
            LlmResponse(calls=[FunctionCall("transfer_to_agent", {"agent_name": "money", "reason": "a conversion"})]),
            LlmResponse(calls=[FunctionCall("convert", {"amount": 10, "rate": 1.5})]),
            LlmResponse(text="That is 15.00."),
        ])
        result = Runner(team(), client=client).run("convert 10 at 1.5")

        self.assertEqual(result.text, "That is 15.00.")
        self.assertEqual(result.agent, "money")
        # The second turn is asked as the sub-agent, with the sub-agent's tools.
        self.assertIn("You are money.", client.requests[1]["system_instruction"])
        self.assertIn("convert", [d["name"] for d in client.requests[1]["function_declarations"]])

    def test_a_transfer_sticks_for_the_rest_of_the_session(self):
        client = ScriptedClient([
            LlmResponse(calls=[FunctionCall("transfer_to_agent", {"agent_name": "words"})]),
            LlmResponse(text="Here is your paragraph."),
            LlmResponse(text="And here is another."),
        ])
        runner = Runner(team(), client=client)
        session = runner.new_session()
        runner.run("write me a paragraph", session=session)
        second = runner.run("another please", session=session)

        # A follow-up goes to the specialist, not back to a coordinator that
        # has already handed the topic over.
        self.assertEqual(second.agent, "words")
        self.assertIn("You are words.", client.requests[2]["system_instruction"])

    def test_the_reason_for_a_transfer_is_in_the_trace(self):
        client = ScriptedClient([
            LlmResponse(calls=[FunctionCall("transfer_to_agent", {"agent_name": "money", "reason": "currency"})]),
            LlmResponse(text="done"),
        ])
        result = Runner(team(), client=client).run("go")
        transfer = next(event for event in result.session.events if event.kind == "transfer")
        self.assertEqual(transfer.agent, "desk")
        self.assertEqual(transfer.text, "money")
        self.assertEqual(transfer.data["reason"], "currency")


class ATransferThatCannotHappen(unittest.TestCase):
    def test_naming_an_agent_that_does_not_exist_fails_loudly(self):
        client = ScriptedClient([
            LlmResponse(calls=[FunctionCall("transfer_to_agent", {"agent_name": "lawyer"})]),
            LlmResponse(text="I will handle it myself."),
        ])
        result = Runner(team(), client=client).run("sue somebody")

        # Told to the model, naming what does exist, so it can recover.
        error = client.requests[1]["messages"][-1].parts[0].response["error"]
        self.assertIn("lawyer", error)
        self.assertIn("money", error)

        # And on the record, marked failed. A coordinator carrying on as though
        # it had delegated is the state this whole test exists to prevent.
        transfer = next(event for event in result.session.events if event.kind == "transfer")
        self.assertFalse(transfer.data["ok"])
        self.assertEqual(result.agent, "desk", "the work stayed put, and the trace says so")

    def test_the_active_agent_does_not_change_on_a_failed_transfer(self):
        client = ScriptedClient([
            LlmResponse(calls=[FunctionCall("transfer_to_agent", {"agent_name": "nobody"})]),
            LlmResponse(text="ok"),
        ])
        runner = Runner(team(), client=client)
        session = runner.new_session()
        runner.run("go", session=session)
        self.assertEqual(session.active_agent, "desk")


class NativeToolsAreNotQuietlyDropped(unittest.TestCase):
    def test_a_provider_that_cannot_search_refuses_to_build_the_runner(self):
        searcher = Agent(
            name="searcher",
            description="Searches.",
            instruction="Search.",
            tools=[GoogleSearch()],
        )
        # A provider reporting no native tools at all -- an OpenAI-compatible
        # endpoint, say.
        client = ScriptedClient([], natives=frozenset())
        with self.assertRaises(NotConfigured) as raised:
            Runner(searcher, client=client)
        self.assertIn("Google Search", str(raised.exception))
        self.assertIn("answers from memory", str(raised.exception))

    def test_the_check_reaches_agents_deep_in_the_team(self):
        buried = Agent(name="buried", description="Searches.", instruction="Search.", tools=[GoogleSearch()])
        middle = Agent(name="middle", description="Middles.", instruction="Route.", sub_agents=[buried])
        top = Agent(name="top", instruction="Route.", sub_agents=[middle])
        with self.assertRaises(NotConfigured):
            Runner(top, client=ScriptedClient([], natives=frozenset()))

    def test_a_native_tool_is_sent_beside_the_function_declarations_not_inside_them(self):
        searcher = Agent(name="searcher", description="Searches.", instruction="Search.", tools=[GoogleSearch()])
        client = ScriptedClient([LlmResponse(text="ok")])
        Runner(searcher, client=client).run("what happened today")
        self.assertEqual(client.requests[0]["native_tools"], [{"google_search": {}}])
        self.assertEqual(client.requests[0]["function_declarations"], [])

    def test_a_native_tool_is_never_executed_here(self):
        # If the runner ever tried to run it, this would raise rather than
        # coming back as a tool result -- there is nothing to call.
        searcher = Agent(name="searcher", description="Searches.", instruction="Search.", tools=[GoogleSearch()])
        client = ScriptedClient([
            LlmResponse(calls=[FunctionCall("google_search", {"q": "weather"})]),
            LlmResponse(text="ok"),
        ])
        result = Runner(searcher, client=client).run("weather")
        error = client.requests[1]["messages"][-1].parts[0].response["error"]
        self.assertIn("no tool called 'google_search'", error)
        self.assertTrue(result.finished)


if __name__ == "__main__":
    unittest.main()
