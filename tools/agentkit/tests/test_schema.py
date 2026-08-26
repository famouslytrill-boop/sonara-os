"""The signature is the contract, so the contract is checked against it."""

import unittest

from agentkit.schema import check_declaration_matches, declaration_for


def search_records(query: str, limit: int = 10, exact: bool = False) -> list:
    """Find records matching a query.

    Args:
        query: What to look for.
        limit: How many to return at most.
        exact: Whether to match the whole phrase.
    """
    return []


class DerivingADeclaration(unittest.TestCase):
    def test_takes_names_types_and_descriptions_from_the_function(self):
        declaration = declaration_for(search_records)
        self.assertEqual(declaration["name"], "search_records")
        self.assertEqual(declaration["description"], "Find records matching a query.")
        properties = declaration["parameters"]["properties"]
        self.assertEqual(properties["query"], {"type": "STRING", "description": "What to look for."})
        self.assertEqual(properties["limit"]["type"], "INTEGER")
        self.assertEqual(properties["exact"]["type"], "BOOLEAN")

    def test_only_parameters_without_defaults_are_required(self):
        self.assertEqual(declaration_for(search_records)["parameters"]["required"], ["query"])

    def test_a_tool_that_takes_nothing_declares_no_parameters(self):
        def ping() -> str:
            """Say hello."""
            return "hi"

        # Not `{"type": "OBJECT", "properties": {}}`: some providers reject an
        # empty object, and a tool that takes nothing is common.
        self.assertNotIn("parameters", declaration_for(ping))

    def test_lists_say_what_is_in_them(self):
        def tag(names: list) -> str:
            """Tag things.

            Args:
                names: the tags
            """
            return ""

        with self.assertRaises(TypeError) as raised:
            declaration_for(tag)
        self.assertIn("does not say what is in it", str(raised.exception))

    def test_an_unannotated_parameter_is_refused_rather_than_guessed(self):
        def guess(anything) -> str:
            """Do a thing.

            Args:
                anything: whatever
            """
            return ""

        with self.assertRaises(TypeError) as raised:
            declaration_for(guess)
        # The refusal is the point. Defaulting to STRING would produce a tool
        # that looks declared and sends "3" where the function wanted 3.
        self.assertIn("will not guess", str(raised.exception))

    def test_a_tool_with_no_description_is_refused(self):
        def undescribed(x: str) -> str:
            return x

        with self.assertRaises(ValueError) as raised:
            declaration_for(undescribed)
        self.assertIn("never gets used", str(raised.exception))

    def test_star_args_cannot_be_declared(self):
        def wide(first: str, *rest) -> str:
            """Take anything."""
            return first

        with self.assertRaises(TypeError):
            declaration_for(wide)

    def test_optional_annotations_unwrap_to_the_inner_type(self):
        def maybe(name: "str | None" = None) -> str:
            """Greet somebody.

            Args:
                name: who
            """
            return ""

        import typing

        def maybe_typed(name: typing.Optional[str] = None) -> str:
            """Greet somebody.

            Args:
                name: who
            """
            return ""

        self.assertEqual(declaration_for(maybe_typed)["parameters"]["properties"]["name"]["type"], "STRING")


class TheAgreementIsCheckedBothWays(unittest.TestCase):
    """The reverse direction is the one nobody checks."""

    def test_a_derived_declaration_agrees_with_its_function(self):
        check_declaration_matches(search_records, declaration_for(search_records))

    def test_declaring_a_parameter_the_function_does_not_take_is_caught(self):
        broken = declaration_for(search_records)
        broken["parameters"]["properties"]["sort_by"] = {"type": "STRING"}
        with self.assertRaises(ValueError) as raised:
            check_declaration_matches(search_records, broken)
        self.assertIn("sort_by", str(raised.exception))

    def test_omitting_a_parameter_the_function_requires_is_caught(self):
        # The direction that produces a tool the model can never call
        # correctly, with nothing in the declaration looking wrong.
        broken = declaration_for(search_records)
        del broken["parameters"]["properties"]["query"]
        broken["parameters"]["required"] = []
        with self.assertRaises(ValueError) as raised:
            check_declaration_matches(search_records, broken)
        self.assertIn("every call would fail", str(raised.exception))

    def test_requiring_something_that_has_a_default_is_caught(self):
        broken = declaration_for(search_records)
        broken["parameters"]["required"] = ["query", "limit"]
        with self.assertRaises(ValueError) as raised:
            check_declaration_matches(search_records, broken)
        self.assertIn("invent values", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
