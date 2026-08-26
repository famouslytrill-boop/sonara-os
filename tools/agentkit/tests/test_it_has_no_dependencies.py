"""The "no dependencies" claim, as a check rather than a sentence.

A README saying a package is dependency-free is a claim that rots the first
time somebody adds an import in a hurry. This reads the source.
"""

import ast
import pathlib
import sys
import unittest

PACKAGE = pathlib.Path(__file__).resolve().parents[1] / "agentkit"


class NothingOutsideTheStandardLibrary(unittest.TestCase):
    def test_every_import_is_stdlib_or_our_own(self):
        files = sorted(PACKAGE.glob("*.py"))
        # Guard against the check going blind: an empty glob would pass this
        # test while measuring nothing at all.
        self.assertGreaterEqual(len(files), 8, f"only {len(files)} modules found; this check has gone blind")

        standard = set(sys.stdlib_module_names)
        offenders = []
        for file in files:
            tree = ast.parse(file.read_text(), filename=str(file))
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    names = [alias.name for alias in node.names]
                elif isinstance(node, ast.ImportFrom):
                    if node.level:  # a relative import, our own
                        continue
                    names = [node.module or ""]
                else:
                    continue
                for name in names:
                    root = name.split(".")[0]
                    if root and root not in standard and root != "agentkit":
                        offenders.append(f"{file.name}: {name}")

        self.assertEqual(offenders, [], f"these are not standard library imports: {offenders}")

    def test_the_project_file_declares_no_dependencies(self):
        text = (PACKAGE.parent / "pyproject.toml").read_text()
        self.assertIn("dependencies = []", text)


if __name__ == "__main__":
    unittest.main()
