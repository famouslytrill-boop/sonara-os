"""The loop, and the four ways it could report more than happened."""

import unittest

from agentkit import Agent, FunctionCall, LlmResponse, Runner, ScriptedClient, ToolContext, ToolError


def lookup(reference: str) -> str:
    """Look a reference up.

    Args:
        reference: the reference
    """
    if reference == "missing":
        raise ToolError("There is no record with that reference.")
    if reference == "broken":
        raise RuntimeError("the database is on fire")
    return f"record for {reference}"


def counter(context: ToolContext) -> int:
    """Count how many times this has been called."""
    context.state["calls"] = context.state.get("calls", 0) + 1
    return context.state["calls"]


def agent(**kwargs) -> Agent:
    return Agent(name="clerk", instruction="Look things up.", tools=[lookup, counter], **kwargs)


class TheLoop(unittest.TestCase):
    def test_a_plain_answer_comes_straight_back(self):
        client = ScriptedClient([LlmResponse(text="Hello.")])
        result = Runner(agent(), client=client).run("hi")
        self.assertEqual(result.text, "Hello.")
        self.assertEqual(result.steps, 1)
        self.assertTrue(result.finished)

    def test_a_tool_call_is_run_and_the_result_goes_back_to_the_model(self):
        client = ScriptedClient([
            LlmResponse(calls=[FunctionCall("lookup", {"reference": "A1"})]),
            LlmResponse(text="It is the A1 record."),
        ])
        result = Runner(agent(), client=client).run("look up A1")
        self.assertEqual(result.text, "It is the A1 record.")

        # What actually went on the wire on the second turn: the model's own
        # call, then the result. Sending the result without the call gives the
        # model an answer to a question it has no record of asking.
        second = client.requests[1]["messages"]
        self.assertEqual(second[-2].role, "model")
        self.assertEqual(second[-2].parts[0].name, "lookup")
        self.assertEqual(second[-1].role, "function")
        self.assertEqual(second[-1].parts[0].response, {"result": "record for A1"})

    def test_state_persists_across_calls_within_a_session(self):
        client = ScriptedClient([
            LlmResponse(calls=[FunctionCall("counter", {})]),
            LlmResponse(calls=[FunctionCall("counter", {})]),
            LlmResponse(text="twice"),
        ])
        result = Runner(agent(), client=client).run("count twice")
        results = [event for event in result.session.events if event.kind == "tool_result"]
        self.assertEqual([event.data["value"] for event in results], [1, 2])

    def test_the_tool_context_is_never_declared_to_the_model(self):
        client = ScriptedClient([LlmResponse(text="ok")])
        Runner(agent(), client=client).run("hi")
        declared = {
            declaration["name"]: set((declaration.get("parameters") or {}).get("properties", {}))
            for declaration in client.requests[0]["function_declarations"]
        }
        # Filled in by the runner. Declaring it would let whatever is on the
        # other end of the API choose its own agent name and session id.
        self.assertEqual(declared["counter"], set())


class AFailingToolIsNewsForTheModel(unittest.TestCase):
    def test_a_refusal_comes_back_as_an_error_the_model_can_act_on(self):
        client = ScriptedClient([
            LlmResponse(calls=[FunctionCall("lookup", {"reference": "missing"})]),
            LlmResponse(text="There is no such record."),
        ])
        result = Runner(agent(), client=client).run("look up missing")
        self.assertTrue(result.finished)
        sent = client.requests[1]["messages"][-1].parts[0].response
        self.assertEqual(sent, {"error": "There is no record with that reference."})

    def test_an_unexpected_exception_does_not_take_the_run_down(self):
        client = ScriptedClient([
            LlmResponse(calls=[FunctionCall("lookup", {"reference": "broken"})]),
            LlmResponse(text="Something went wrong looking that up."),
        ])
        result = Runner(agent(), client=client).run("look up broken")
        self.assertTrue(result.finished)
        error = client.requests[1]["messages"][-1].parts[0].response["error"]
        self.assertIn("RuntimeError", error)
        self.assertIn("on fire", error)

    def test_calling_a_tool_that_does_not_exist_names_the_ones_that_do(self):
        client = ScriptedClient([
            LlmResponse(calls=[FunctionCall("delete_everything", {})]),
            LlmResponse(text="I cannot do that."),
        ])
        Runner(agent(), client=client).run("delete it all")
        error = client.requests[1]["messages"][-1].parts[0].response["error"]
        self.assertIn("delete_everything", error)
        self.assertIn("lookup", error)

    def test_arguments_the_tool_does_not_take_are_named_rather_than_raised(self):
        client = ScriptedClient([
            LlmResponse(calls=[FunctionCall("lookup", {"reference": "A1", "colour": "red"})]),
            LlmResponse(text="done"),
        ])
        Runner(agent(), client=client).run("look up A1 in red")
        error = client.requests[1]["messages"][-1].parts[0].response["error"]
        self.assertIn("colour", error)


class RunningOutOfStepsIsNotAnAnswer(unittest.TestCase):
    def test_a_run_that_never_finishes_says_so(self):
        # A model that calls a tool for ever. Without a limit this is an
        # unbounded bill; with a limit that lies about it, it is worse.
        client = ScriptedClient([LlmResponse(calls=[FunctionCall("counter", {})]) for _ in range(10)])
        result = Runner(agent(), client=client, max_steps=3).run("go")

        self.assertFalse(result.finished)
        self.assertEqual(result.stop_reason, "step_limit")
        self.assertEqual(result.steps, 3)
        self.assertTrue(any(event.kind == "limit" for event in result.session.events))

    def test_the_last_thing_said_is_carried_but_not_called_final(self):
        client = ScriptedClient([
            LlmResponse(text="Working on it...", calls=[FunctionCall("counter", {})]),
            LlmResponse(text="Still going...", calls=[FunctionCall("counter", {})]),
        ])
        result = Runner(agent(), client=client, max_steps=2).run("go")
        self.assertEqual(result.text, "Still going...")
        self.assertFalse(result.finished, "text on an unfinished run is not the answer to the question")


class WhatTheProviderIsAsked(unittest.TestCase):
    def test_the_agents_own_instruction_and_name_are_sent(self):
        client = ScriptedClient([LlmResponse(text="ok")])
        Runner(agent(), client=client).run("hi")
        instruction = client.requests[0]["system_instruction"]
        self.assertIn("You are clerk.", instruction)
        self.assertIn("Look things up.", instruction)

    def test_usage_is_summed_across_the_turns_of_one_run(self):
        client = ScriptedClient([
            LlmResponse(calls=[FunctionCall("counter", {})], usage={"totalTokenCount": 100}),
            LlmResponse(text="done", usage={"totalTokenCount": 40}),
        ])
        result = Runner(agent(), client=client).run("go")
        self.assertEqual(result.usage["totalTokenCount"], 140)

    def test_a_provider_error_is_recorded_before_it_is_raised(self):
        from agentkit.errors import ProviderError

        class Failing(ScriptedClient):
            def generate(self, **kwargs):
                raise ProviderError("the model provider answered 503", status=503)

        client = Failing([])
        runner = Runner(agent(), client=client)
        session = runner.new_session()
        with self.assertRaises(ProviderError):
            runner.run("hi", session=session)
        errors = [event for event in session.events if event.kind == "error"]
        self.assertEqual(len(errors), 1)
        self.assertTrue(errors[0].data["retryable"], "503 is worth trying again; a 400 is not")


if __name__ == "__main__":
    unittest.main()
