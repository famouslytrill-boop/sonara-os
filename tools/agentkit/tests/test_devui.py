"""The dev UI, driven over HTTP.

Route-level rather than function-level, because the questions worth asking here
are about what a *request* gets back -- particularly the one that matters most:
whether an unfinished run arrives labelled as unfinished.
"""

import json
import threading
import unittest
import urllib.request

from agentkit import Agent, FunctionCall, LlmResponse, Runner, ScriptedClient
from agentkit.devui import load_agent, serve


def convert(amount: float, rate: float) -> float:
    """Convert an amount.

    Args:
        amount: how much
        rate: the rate
    """
    return round(amount * rate, 2)


def team():
    money = Agent(name="money", description="Sums.", instruction="Do sums.", tools=[convert])
    return Agent(name="desk", instruction="Route.", sub_agents=[money])


class Serving:
    """A dev UI on a port the operating system chose."""

    def __init__(self, answers, max_steps=12):
        self.client = ScriptedClient(answers)
        self.server = serve(Runner(team(), client=self.client, max_steps=max_steps), host="127.0.0.1", port=0)
        self.port = self.server.server_address[1]
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def get(self, path):
        with urllib.request.urlopen(f"http://127.0.0.1:{self.port}{path}", timeout=10) as answer:
            return answer.status, answer.read(), dict(answer.headers)

    def post(self, path, payload):
        request = urllib.request.Request(
            f"http://127.0.0.1:{self.port}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=10) as answer:
            return json.loads(answer.read())

    def close(self):
        self.server.shutdown()
        self.server.server_close()


class ThePage(unittest.TestCase):
    def setUp(self):
        self.serving = Serving([LlmResponse(text="ok")])
        self.addCleanup(self.serving.close)

    def test_it_serves_a_page_with_no_inline_script(self):
        status, body, headers = self.serving.get("/")
        self.assertEqual(status, 200)
        text = body.decode("utf-8")
        self.assertIn("agentkit", text)
        # One script tag, and it points at a file. An inline script would mean
        # loosening the policy below to allow one.
        self.assertIn('<script src="/app.js" defer></script>', text)
        self.assertNotIn("onclick=", text)

    def test_the_policy_forbids_inline_script_and_framing(self):
        _, _, headers = self.serving.get("/")
        policy = headers["Content-Security-Policy"]
        self.assertIn("script-src 'self'", policy)
        self.assertNotIn("unsafe-inline", policy)
        self.assertIn("frame-ancestors 'none'", policy)

    def test_the_team_is_described_from_the_agent_rather_than_written_out(self):
        _, body, _ = self.serving.get("/api/agent")
        described = json.loads(body)
        self.assertEqual(described["name"], "desk")
        self.assertEqual([agent["name"] for agent in described["agents"]], ["desk", "money"])
        self.assertEqual(described["agents"][1]["tools"], [{"name": "convert", "native": False}])


class Chatting(unittest.TestCase):
    def test_a_finished_answer_comes_back_with_its_trace(self):
        serving = Serving([
            LlmResponse(calls=[FunctionCall("transfer_to_agent", {"agent_name": "money"})]),
            LlmResponse(calls=[FunctionCall("convert", {"amount": 10, "rate": 2})]),
            LlmResponse(text="That is 20.00."),
        ])
        self.addCleanup(serving.close)

        answer = serving.post("/api/chat", {"message": "convert 10 at 2"})
        self.assertEqual(answer["text"], "That is 20.00.")
        self.assertEqual(answer["agent"], "money")
        self.assertEqual(answer["stop_reason"], "final")

        kinds = [event["kind"] for event in answer["events"]]
        self.assertIn("transfer", kinds)
        self.assertIn("tool_call", kinds)
        self.assertIn("tool_result", kinds)

    def test_an_unfinished_run_arrives_labelled_unfinished(self):
        # The whole reason this endpoint returns stop_reason at all. The last
        # thing a model said before running out of turns looks exactly like an
        # answer, and the page draws this one in the colour used for problems.
        serving = Serving(
            [LlmResponse(text="thinking", calls=[FunctionCall("transfer_to_agent", {"agent_name": "money"})])] * 4,
            max_steps=2,
        )
        self.addCleanup(serving.close)

        answer = serving.post("/api/chat", {"message": "go"})
        self.assertEqual(answer["stop_reason"], "step_limit")
        self.assertEqual(answer["steps"], 2)

    def test_a_session_carries_on_where_it_left_off(self):
        serving = Serving([LlmResponse(text="one"), LlmResponse(text="two")])
        self.addCleanup(serving.close)

        first = serving.post("/api/chat", {"message": "hello"})
        second = serving.post("/api/chat", {"session": first["session"], "message": "again"})
        self.assertEqual(second["session"], first["session"])
        # The second request carries the first exchange, so the model is
        # answering a conversation rather than a fresh question each time.
        sent = serving.client.requests[1]["messages"]
        self.assertGreaterEqual(len(sent), 3)

    def test_only_this_turns_events_come_back(self):
        serving = Serving([LlmResponse(text="one"), LlmResponse(text="two")])
        self.addCleanup(serving.close)
        first = serving.post("/api/chat", {"message": "hello"})
        second = serving.post("/api/chat", {"session": first["session"], "message": "again"})
        # Otherwise the panel would redraw the whole session, growing without
        # bound, and the newest thing would be hardest to find.
        self.assertEqual([event["text"] for event in second["events"]], ["again", "two"])

    def test_a_provider_that_is_not_configured_is_a_message_rather_than_a_stack_trace(self):
        from agentkit import GeminiClient

        server = serve(Runner(team(), client=GeminiClient(api_key="")), host="127.0.0.1", port=0)
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(lambda: (server.shutdown(), server.server_close()))

        request = urllib.request.Request(
            f"http://127.0.0.1:{port}/api/chat",
            data=json.dumps({"message": "hi"}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=10) as answer:
            payload = json.loads(answer.read())
        self.assertIn("GEMINI_API_KEY", payload["problem"])


class LoadingAnAgentFile(unittest.TestCase):
    def test_the_shipped_example_loads_and_is_a_team(self):
        import pathlib

        example = pathlib.Path(__file__).resolve().parents[1] / "examples" / "research_team.py"
        agent = load_agent(str(example))
        self.assertEqual(agent.name, "coordinator")
        self.assertEqual(sorted(sub.name for sub in agent.sub_agents), ["analyst", "researcher"])

    def test_a_file_with_several_agents_and_no_root_is_refused_by_name(self):
        import pathlib
        import tempfile

        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "ambiguous.py"
            path.write_text(
                "from agentkit import Agent\n"
                "one = Agent(name='one', instruction='Do.')\n"
                "two = Agent(name='two', instruction='Do.')\n"
            )
            with self.assertRaises(ValueError) as raised:
                load_agent(str(path))
            # Naming them beats picking one, which would be a guess.
            self.assertIn("one", str(raised.exception))
            self.assertIn("two", str(raised.exception))


class TheBanner(unittest.TestCase):
    def test_it_says_there_is_no_authentication_every_time(self):
        from agentkit.devui import banner

        text = banner(Runner(team(), client=ScriptedClient([])), "127.0.0.1", 8900)
        self.assertIn("no authentication", text)
        self.assertIn("loopback", text)

    def test_binding_off_loopback_is_called_out(self):
        from agentkit.devui import banner

        text = banner(Runner(team(), client=ScriptedClient([])), "0.0.0.0", 8900)
        self.assertIn("WARNING", text)


if __name__ == "__main__":
    unittest.main()
