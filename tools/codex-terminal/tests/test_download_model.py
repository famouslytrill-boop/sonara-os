import contextlib
import importlib.util
import io
import pathlib
import unittest

MODULE_PATH = pathlib.Path(__file__).resolve().parents[1] / "download-model.py"
SPEC = importlib.util.spec_from_file_location("sonara_download_model", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class DownloadModelCliTests(unittest.TestCase):
    def capture(self, argv):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            code = MODULE.main(argv)
        return code, output.getvalue()

    def test_list_reports_governed_models_without_downloading(self):
        code, output = self.capture(["--list"])
        self.assertEqual(code, 0)
        self.assertIn("openai/gpt-oss-20b", output)
        self.assertIn("candidate", output)

    def test_unknown_model_is_refused(self):
        with self.assertRaisesRegex(SystemExit, "not in the governed manifest"):
            MODULE.main(["--model", "not/a-real-model"])

    def test_review_status_is_blocked_by_default(self):
        data = MODULE.load_manifest()
        blocked = next(model for model in data["models"] if model["status"] in MODULE.BLOCKED)
        with self.assertRaisesRegex(SystemExit, "review/accept current model terms first"):
            MODULE.main(["--model", blocked["id"]])

    def test_candidate_is_plan_only_without_execute(self):
        data = MODULE.load_manifest()
        candidate = next(model for model in data["models"] if model["status"] not in MODULE.BLOCKED)
        code, output = self.capture(["--model", candidate["id"]])
        self.assertEqual(code, 0)
        self.assertIn("PLAN ONLY", output)
        self.assertIn(candidate["id"], output)

    def test_review_status_can_be_inspected_without_execute_after_explicit_override(self):
        data = MODULE.load_manifest()
        blocked = next(model for model in data["models"] if model["status"] in MODULE.BLOCKED)
        code, output = self.capture([
            "--model", blocked["id"], "--allow-review-status"
        ])
        self.assertEqual(code, 0)
        self.assertIn("PLAN ONLY", output)
        self.assertIn(blocked["id"], output)


if __name__ == "__main__":
    unittest.main()
