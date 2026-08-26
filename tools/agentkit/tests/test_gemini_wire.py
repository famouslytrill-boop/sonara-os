"""What actually goes on the wire to Gemini.

The shapes asserted here are copied from Google's REST cookbook rather than
recalled, and that is the point of the file: a toolkit whose request looks
plausible and is not is a toolkit that fails on the first real call, and every
one of these fields is easy to get subtly wrong from memory.
"""

import json
import unittest

from agentkit import Agent, GeminiClient, GoogleSearch, NotConfigured, Runner
from agentkit.errors import ProviderError
from agentkit.models import FunctionResponse, Message, Text


class Recorder:
    """Stands in for the HTTPS call and keeps what it was handed."""

    def __init__(self, answer: dict):
        self.answer = answer
        self.url = ""
        self.body = {}
        self.headers = {}

    def __call__(self, url, body, headers, timeout):
        self.url = url
        self.body = json.loads(body.decode("utf-8"))
        self.headers = headers
        return json.dumps(self.answer).encode("utf-8")


ANSWERED = {
    "candidates": [{"content": {"role": "model", "parts": [{"text": "Hello."}]}, "finishReason": "STOP"}],
    "usageMetadata": {"totalTokenCount": 12},
}


def look_up(city: str) -> str:
    """Look a city up.

    Args:
        city: which city
    """
    return city


class TheRequest(unittest.TestCase):
    def test_the_endpoint_and_key_are_where_google_documents_them(self):
        recorder = Recorder(ANSWERED)
        client = GeminiClient(api_key="k-123", opener=recorder)
        client.generate(model="gemini-2.5-flash", messages=[Message("user", [Text("hi")])])
        self.assertEqual(
            recorder.url,
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=k-123",
        )
        self.assertEqual(recorder.headers["Content-Type"], "application/json")

    def test_contents_carry_roles_and_parts(self):
        recorder = Recorder(ANSWERED)
        GeminiClient(api_key="k", opener=recorder).generate(
            model="m", messages=[Message("user", [Text("hi")])], system_instruction="Be brief."
        )
        self.assertEqual(recorder.body["contents"], [{"role": "user", "parts": [{"text": "hi"}]}])
        self.assertEqual(recorder.body["systemInstruction"], {"parts": [{"text": "Be brief."}]})

    def test_a_tool_result_is_sent_with_role_function(self):
        # The field that is easiest to get wrong and hardest to notice: the
        # role for a tool result is "function", not "tool" and not "user".
        recorder = Recorder(ANSWERED)
        GeminiClient(api_key="k", opener=recorder).generate(
            model="m",
            messages=[Message("function", [FunctionResponse("look_up", {"result": "Bristol"})])],
        )
        sent = recorder.body["contents"][0]
        self.assertEqual(sent["role"], "function")
        self.assertEqual(
            sent["parts"][0],
            {"functionResponse": {"name": "look_up", "response": {"name": "look_up", "result": "Bristol"}}},
        )

    def test_function_declarations_go_under_their_own_key(self):
        recorder = Recorder(ANSWERED)
        agent = Agent(name="clerk", instruction="Look things up.", tools=[look_up])
        Runner(agent, client=GeminiClient(api_key="k", opener=recorder)).run("hi")
        self.assertEqual(list(recorder.body["tools"][0]), ["functionDeclarations"])
        declaration = recorder.body["tools"][0]["functionDeclarations"][0]
        self.assertEqual(declaration["name"], "look_up")
        # Upper case, as in the cookbook's fuller example.
        self.assertEqual(declaration["parameters"]["type"], "OBJECT")
        self.assertEqual(declaration["parameters"]["properties"]["city"]["type"], "STRING")

    def test_google_search_is_a_sibling_of_function_declarations(self):
        recorder = Recorder(ANSWERED)
        agent = Agent(name="searcher", description="Searches.", instruction="Search.", tools=[GoogleSearch()])
        Runner(agent, client=GeminiClient(api_key="k", opener=recorder)).run("news")
        self.assertEqual(recorder.body["tools"], [{"google_search": {}}])

    def test_temperature_travels_in_generation_config(self):
        recorder = Recorder(ANSWERED)
        GeminiClient(api_key="k", opener=recorder).generate(
            model="m", messages=[Message("user", [Text("hi")])], temperature=0.2
        )
        self.assertEqual(recorder.body["generationConfig"], {"temperature": 0.2})


class TheResponse(unittest.TestCase):
    def test_text_and_usage_are_read_out(self):
        answer = GeminiClient(api_key="k", opener=Recorder(ANSWERED)).generate(
            model="m", messages=[Message("user", [Text("hi")])]
        )
        self.assertEqual(answer.text, "Hello.")
        self.assertEqual(answer.finish_reason, "STOP")
        self.assertEqual(answer.usage["totalTokenCount"], 12)

    def test_a_function_call_comes_back_with_its_arguments(self):
        recorder = Recorder({
            "candidates": [{
                "content": {"parts": [{"functionCall": {"name": "look_up", "args": {"city": "Bristol"}}}]},
                "finishReason": "STOP",
            }],
        })
        answer = GeminiClient(api_key="k", opener=recorder).generate(model="m", messages=[])
        self.assertEqual(len(answer.calls), 1)
        self.assertEqual(answer.calls[0].name, "look_up")
        self.assertEqual(answer.calls[0].arguments, {"city": "Bristol"})

    def test_grounding_metadata_is_carried_through_intact(self):
        grounded = {
            "candidates": [{
                "content": {"parts": [{"text": "It rained."}]},
                "groundingMetadata": {
                    "webSearchQueries": ["bristol weather today"],
                    "groundingChunks": [{"web": {"uri": "https://example.com/x", "title": "Weather"}}],
                },
            }],
        }
        answer = GeminiClient(api_key="k", opener=Recorder(grounded)).generate(model="m", messages=[])
        self.assertEqual(answer.grounding["webSearchQueries"], ["bristol weather today"])

    def test_no_search_is_none_rather_than_an_empty_dict(self):
        answer = GeminiClient(api_key="k", opener=Recorder(ANSWERED)).generate(model="m", messages=[])
        # "did not search" and "searched and found nothing" are different facts.
        self.assertIsNone(answer.grounding)

    def test_a_blocked_prompt_says_so_rather_than_answering_with_nothing(self):
        blocked = {"promptFeedback": {"blockReason": "SAFETY"}}
        with self.assertRaises(ProviderError) as raised:
            GeminiClient(api_key="k", opener=Recorder(blocked)).generate(model="m", messages=[])
        self.assertIn("SAFETY", str(raised.exception))

    def test_no_api_key_is_a_named_setup_problem(self):
        with self.assertRaises(NotConfigured) as raised:
            GeminiClient(api_key="").generate(model="m", messages=[])
        self.assertIn("GEMINI_API_KEY", str(raised.exception))


class TheOpenAiShapedProvider(unittest.TestCase):
    def test_declarations_are_translated_down_to_json_schema(self):
        from agentkit import OpenAICompatibleClient

        recorder = Recorder({"choices": [{"message": {"content": "hi"}, "finish_reason": "stop"}]})
        client = OpenAICompatibleClient(base_url="http://localhost:8080/v1", opener=recorder)
        Runner(Agent(name="clerk", instruction="Look up.", tools=[look_up]), client=client).run("hi")

        tool = recorder.body["tools"][0]
        self.assertEqual(tool["type"], "function")
        # Lower case here, upper case for Gemini -- the same declaration,
        # spelled the way each provider expects.
        self.assertEqual(tool["function"]["parameters"]["type"], "object")
        self.assertEqual(tool["function"]["parameters"]["properties"]["city"]["type"], "string")

    def test_it_reports_no_native_tools_at_all(self):
        from agentkit import OpenAICompatibleClient

        client = OpenAICompatibleClient(base_url="http://localhost:8080/v1")
        self.assertFalse(client.supports_native("google_search"))


if __name__ == "__main__":
    unittest.main()
