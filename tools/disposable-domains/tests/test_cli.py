"""Tests for the command line, which had none.

`disposable_domains/cli.py` is 163 executable lines and was carried in
`scripts/verify-python-coverage-floor.py` as **0% covered**, with the reason:
"the suite tests the validator and the public-suffix logic underneath them
directly, and never through argv".

That reason was true and is not a good place to stop. The four subcommands are
where a person meets this tool, and `main()` takes an argv list, so there is
nothing standing in the way of driving them.

What is worth testing here is not that argparse works. It is the behaviour the
module's own docstrings claim:

* **a file `fix` produced always passes `check`** -- stated in the module
  docstring, and enforced by `cmd_fix` re-running `check` and returning 3 if it
  fails. That guarantee is the reason `check` can be trusted in CI.
* **shared options mean the same thing before and after the subcommand.**
  `_shared_parser` exists because the obvious argparse approach -- `parents=`
  on each subparser -- parses a shared option twice and lets the subcommand's
  default silently overwrite a value given earlier. A flag accepted, ignored
  and reported as absent is worse than one rejected, and only a test that
  passes it in *both* positions can tell the difference.
* **an unfixable problem writes nothing.** `fix` on a file containing a line no
  machine can correct must leave the file alone rather than do its best.
* **exit codes are the interface.** 0 clean, 1 problems, 2 no file, 3 fix is
  broken; `match` deliberately inverts 0 and 1 because a blocked address is the
  question being answered, not an error.

Every case drives `cli.main(argv)` and asserts on the exit code and the output
a person would see.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from disposable_domains import cli  # noqa: E402

# Every case passes this. Without a cached public suffix list the commands print
# a paragraph about whole-TLD entries and carry on; that path has its own test
# below, and leaving it on everywhere else would test the warning 12 times and
# the commands once.
UNCHECKED = "--allow-unchecked-suffixes"


@pytest.fixture()
def blocklist(tmp_path: Path) -> Path:
    path = tmp_path / "blocklist.txt"
    path.write_text("aaa.com\nbbb.net\nccc.org\n", encoding="utf-8")
    return path


def run(argv: list[str]) -> int:
    return cli.main(argv)


class TestCheck:
    def test_a_clean_file_is_clean(self, blocklist: Path, capsys) -> None:
        assert run([UNCHECKED, "--blocklist", str(blocklist), "check"]) == 0
        assert "The blocklist is clean." in capsys.readouterr().out

    def test_a_missing_file_is_not_a_clean_file(self, tmp_path: Path, capsys) -> None:
        # Exit 2 rather than 1: "there is nothing here" and "what is here is
        # wrong" are different answers, and a CI job that cannot tell them apart
        # reports a deleted blocklist as a passing one.
        missing = tmp_path / "nope.txt"
        assert run([UNCHECKED, "--blocklist", str(missing), "check"]) == 2
        assert "No blocklist at" in capsys.readouterr().err

    def test_a_fixable_problem_exits_one_and_says_it_is_fixable(self, blocklist: Path, capsys) -> None:
        blocklist.write_text("bbb.net\naaa.com\n", encoding="utf-8")
        assert run([UNCHECKED, "--blocklist", str(blocklist), "check"]) == 1
        assert "run `blocklist fix`" in capsys.readouterr().out

    def test_check_changes_nothing(self, blocklist: Path) -> None:
        blocklist.write_text("bbb.net\naaa.com\n", encoding="utf-8")
        before = blocklist.read_text(encoding="utf-8")
        run([UNCHECKED, "--blocklist", str(blocklist), "check"])
        assert blocklist.read_text(encoding="utf-8") == before


class TestFix:
    @pytest.mark.parametrize(
        ("content", "what"),
        [
            ("bbb.net\naaa.com\n", "unsorted"),
            ("aaa.com\naaa.com\nbbb.net\n", "a duplicate"),
            ("aaa.com\n\nbbb.net\n", "a blank line"),
            ("aaa.com\nBBB.NET\n", "uppercase"),
            ("aaa.com\n# a comment\nbbb.net\n", "a comment"),
            ("aaa.com\nbbb.net", "no trailing newline"),
        ],
    )
    def test_what_fix_produces_passes_check(self, blocklist: Path, content: str, what: str) -> None:
        # The module docstring's claim, one case per fixable problem code. If
        # this ever fails, one of fix and check is wrong and cmd_fix's own
        # re-check would return 3.
        blocklist.write_text(content, encoding="utf-8")
        assert run([UNCHECKED, "--blocklist", str(blocklist), "fix"]) == 0, what
        assert run([UNCHECKED, "--blocklist", str(blocklist), "check"]) == 0, what

    def test_an_unfixable_line_writes_nothing(self, blocklist: Path, capsys) -> None:
        # `not a domain!!` cannot be corrected by machine -- deleting it is a
        # decision about somebody's blocklist. Doing its best here would mean
        # silently dropping an entry a person put in on purpose.
        original = "aaa.com\nnot a domain!!\n"
        blocklist.write_text(original, encoding="utf-8")
        assert run([UNCHECKED, "--blocklist", str(blocklist), "fix"]) == 1
        assert blocklist.read_text(encoding="utf-8") == original
        assert "nothing was written" in capsys.readouterr().err

    def test_a_missing_file_is_not_fixed_into_existence(self, tmp_path: Path) -> None:
        missing = tmp_path / "nope.txt"
        assert run([UNCHECKED, "--blocklist", str(missing), "fix"]) == 2
        assert not missing.exists()

    def test_fix_reports_what_it_removed(self, blocklist: Path, capsys) -> None:
        blocklist.write_text("aaa.com\naaa.com\nbbb.net\n", encoding="utf-8")
        run([UNCHECKED, "--blocklist", str(blocklist), "fix"])
        out = capsys.readouterr().out
        assert "domains in," in out and "out." in out


class TestMatch:
    def test_a_blocked_domain_exits_zero(self, blocklist: Path, capsys) -> None:
        assert run(["--blocklist", str(blocklist), "match", "aaa.com"]) == 0
        assert "blocked by aaa.com" in capsys.readouterr().out

    def test_an_address_is_matched_by_its_domain(self, blocklist: Path, capsys) -> None:
        assert run(["--blocklist", str(blocklist), "match", "someone@aaa.com"]) == 0
        assert "blocked by aaa.com" in capsys.readouterr().out

    def test_an_unblocked_domain_exits_one(self, blocklist: Path, capsys) -> None:
        # Inverted on purpose: "is this blocked" is the question, so a clean
        # address is the non-zero answer. Worth pinning, because it looks like a
        # bug to anybody who has not read cmd_match.
        assert run(["--blocklist", str(blocklist), "match", "example.com"]) == 1
        assert "not blocked" in capsys.readouterr().out


class TestSharedOptionsGoEitherSide:
    """The bug `_shared_parser` exists to avoid.

    Declaring `--blocklist` on the top-level parser *and* on each subparser via
    `parents=` parses it twice: the subcommand's copy lands last carrying its
    default, and a value given before the subcommand is silently discarded. The
    command then runs against the wrong file and reports success about it.

    Only passing the option in both positions can catch that, which is why
    these are two tests and not one.
    """

    def test_before_the_subcommand(self, blocklist: Path, capsys) -> None:
        assert run([UNCHECKED, "--blocklist", str(blocklist), "check"]) == 0
        assert "The blocklist is clean." in capsys.readouterr().out

    def test_after_the_subcommand(self, blocklist: Path, capsys) -> None:
        assert run(["check", UNCHECKED, "--blocklist", str(blocklist)]) == 0
        assert "The blocklist is clean." in capsys.readouterr().out

    def test_the_two_positions_reach_the_same_file(self, tmp_path: Path) -> None:
        # The sharpest form: a file that is *not* clean. If a position were
        # being dropped, the command would fall back to the default blocklist
        # and report on that instead -- which passes a naive "exit 0" assertion.
        dirty = tmp_path / "dirty.txt"
        dirty.write_text("bbb.net\naaa.com\n", encoding="utf-8")
        assert run([UNCHECKED, "--blocklist", str(dirty), "check"]) == 1
        assert run(["check", UNCHECKED, "--blocklist", str(dirty)]) == 1


class TestWithoutAPublicSuffixList:
    def test_an_unchecked_rule_is_a_problem_not_a_clean_bill(self, blocklist: Path, capsys) -> None:
        # This test was written asserting 0 -- the file *is* clean, after all --
        # and the code was right and the assumption wrong. With no cached list,
        # `check` reports `suffixes_unchecked` and exits **1** on a file with no
        # other fault, because the rule it could not evaluate is the one that
        # would block an entire country.
        #
        # That is the distinction this repository keeps having to make: not
        # knowing is its own answer, and it is not "fine". Pinned here so it
        # cannot be softened into a warning by somebody who reads exit 1 on a
        # clean file as a bug.
        assert run(["--blocklist", str(blocklist), "--cache", str(blocklist.parent / "nocache"), "check"]) == 1

        captured = capsys.readouterr()
        assert "PUBLIC SUFFIX RULES WERE NOT CHECKED" in captured.out
        # And the reason has to be actionable rather than a code, so the message
        # names both the command to run and what is at stake.
        assert "No cached public suffix list" in captured.err
        assert "co.uk" in captured.err

    def test_allowing_it_explicitly_is_what_makes_the_file_clean(self, blocklist: Path) -> None:
        # The other side: the exit code moves only because a person said they
        # accept the risk, never because the tool decided the gap did not matter.
        assert run([UNCHECKED, "--blocklist", str(blocklist), "check"]) == 0


class TestUpdate:
    def test_a_failed_suffix_download_is_reported_and_stops(self, blocklist: Path, monkeypatch, capsys) -> None:
        # --suffixes-only touches the network and nothing else, so a failure has
        # to end the command rather than fall through to the blocklist work.
        def explode(_cache):
            raise RuntimeError("no network here")

        monkeypatch.setattr(cli, "download", explode)
        code = run([UNCHECKED, "--blocklist", str(blocklist), "update", "--suffixes-only"])
        assert code == 1
        assert "could not refresh the public suffix list" in capsys.readouterr().err

    def test_a_refusal_to_replace_leaves_the_file_alone(self, blocklist: Path, monkeypatch, capsys) -> None:
        # safe_to_replace is what stops a bad download turning the protection
        # off. Here the fetch comes back nearly empty, which it must refuse.
        original = blocklist.read_text(encoding="utf-8")

        class Result:
            domains = ["aaa.com"]
            per_source = {"http://example.invalid/list": 1}
            errors = ()

        monkeypatch.setattr(cli, "fetch", lambda _sources: Result())
        code = run([UNCHECKED, "--blocklist", str(blocklist), "update", "--skip-suffixes"])
        assert code == 1
        assert blocklist.read_text(encoding="utf-8") == original
        err = capsys.readouterr().err
        assert "Not saved" in err
        assert "untouched" in err
