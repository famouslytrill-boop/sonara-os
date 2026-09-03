#!/usr/bin/env python3
"""No Python source file may be less than 35% covered by its tests, and every
file that is has to say why.

This is the Python half of the floor `scripts/verify-coverage-floor.mjs` holds
over the JavaScript. The rule is the owner's: every language in this repository,
new and old, meets the same 35% per-file threshold. JavaScript was done first
because that is where the product is; this closes the other half.

## What was here before, and why it is not this

`.github/workflows/dependency-scan.yml` runs four Python jobs and each asserts a
number, so it is easy to read them as coverage gates. They are not. Every one of
those numbers is a **test count** -- "only $ran tests ran in voice-clone, floor
is 24; discovery has gone blind" -- guarding against a suite silently
discovering nothing. That is a real guarantee and a different one. A suite of 97
tests that never imports half its package passes a test-count floor and covers
nothing, and until this script nothing could tell the difference.

## Where the numbers come from

The standard library, with no new dependency, on purpose: `coverage.py` is not
installed here, and putting a gate's own honesty behind a `pip install` is what
the four existing jobs deliberately avoid.

  - **Executed lines** come from `sys.settrace` directly, keyed on each frame's
    `co_filename` and kept only for files under this repository.

    Not `trace.Trace`, and the reason is worth writing down because the first
    version of this script used it and reported four well-tested files at 0%.
    `trace._Ignore` caches its verdict **by bare module name**: `_modname()`
    reduces a path to its basename, and the first file with that basename
    decides for every later one. `sys.prefix` is on the ignore list, so the
    moment a run touches `/usr/lib/python3.11/unittest/runner.py` the name
    `runner` is marked ignored -- and `agentkit/runner.py` is dropped silently
    for the rest of the run. Nothing errors. The file reports 0/204 while
    thirteen tests drive it.

    Every stdlib basename this repository reuses is hit the same way: `config`,
    `tool`, `main`, `errors`, `validate`, `sources`, and `__init__` for every
    package there is. Had that version been trusted green, the register below
    would hold a dozen entries recording well-covered files as untested -- a
    wrong reason inside an exemption, which
    `.claude/skills/checks-that-cannot-lie` names as worse than no exemption.

  - **Executable lines** come from the compiler rather than from a regex.
    `compile()` the source, walk every nested code object's `co_lines()`, and
    take the line numbers it emits code for. That is exactly the set of lines
    that *can* run: a `def` counts, its docstring does not, a multi-line call
    counts once where the compiler attributes it.

    This is stricter and more honest than the JavaScript gate's denominator,
    which drops blank, comment and brace-only lines by matching the text. Here
    nothing is guessed: if the compiler emits no code for a line, the line
    cannot be covered and is not counted against the file.

## Three states, not two

A file with a suite that ran is **measured**. A file with no suite is measured
too, at 0%. A file whose suite could not run here -- pytest, fastapi and httpx
are not installed in this environment and this chain does not install them -- is
**not measured**, and saying it is 0% covered would be a definite claim on the
strength of a run that did not happen. That is the `null` is not `0` rule this
repository applies to customer data, and it applies to its own gates.

So there are two registers. `BELOW_FLOOR` records files that were measured and
are under the floor. `UNMEASURED` records suites this environment cannot run,
naming the import that is missing. Both are two-sided, and `UNMEASURED` is the
one that matters: when CI installs pytest, those suites run, their files are
graded for real, and an `UNMEASURED` entry for a suite that now runs **fails**.
The exemption expires loudly rather than outliving its reason.

## The four ways a register entry fails

Same as the JavaScript gate:

  - a file under the floor that is not in the register;
  - a file in the register that has reached the floor, because a recorded reason
    that no longer describes anything is what the next person reads instead of
    checking;
  - a register entry naming a file nothing measured, so a rename cannot quietly
    retire an exemption;
  - a registered file more than 2 points worse than when it was recorded.

Plus the blindness guard from shape 1 of `.claude/skills/checks-that-cannot-lie`:
measuring far fewer files or lines than the repository holds is a failure, not a
pass.
"""

import importlib.util
import io
import os
import sys
import threading
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
FLOOR = 0.35
REGRESSION_TOLERANCE_POINTS = 2.0

# The interpreter the register's figures were taken on, and the one CI pins.
#
# The denominator is interpreter-dependent, which is not obvious and was worth
# measuring rather than assuming. Comparing `co_lines()` across 3.11, 3.12 and
# 3.13 over these 34 files: 3.12 and 3.13 agree exactly, and 8 files differ from
# 3.11 -- credits.py 220 executable lines against 237, models.py 241 against
# 255, consent.py 91 against 97. As percentages that moves credits.py 5.2 points
# and models.py 2.9, both further than REGRESSION_TOLERANCE_POINTS. So a
# registered file could be reported as having got worse purely because somebody
# ran a different python3.
#
# None of the seventeen registered figures move -- checked file by file on both
# interpreters, and the drift falls entirely on well-covered files that are not
# in the register -- so nothing is wrong today. What follows from it is that the
# regression comparison only means something on the interpreter the figures came
# from. On any other, the floor is still enforced (it is an absolute threshold
# and does not care) and the regression comparison is not applied, and the
# report says so rather than leaving a green run looking like more than it is.
MEASURED_ON = (3, 12)
RUNNING_ON = sys.version_info[:2]

# Every Python suite in this repository, read off the jobs in
# .github/workflows/dependency-scan.yml that actually run them.
#
# `requires` is what the suite needs importable before it can say anything.
# Checked before running rather than after failing, because "the suite errored"
# and "the suite is not installed here" are different findings and only one of
# them is about the code.
SUITES = (
    {
        "root": "tools/agentkit",
        "tests": "tests",
        "runner": "unittest",
        "requires": (),
    },
    {
        "root": "tools/disposable-domains",
        "tests": "tests",
        "runner": "pytest",
        "requires": ("pytest",),
    },
    {
        "root": "tools/voice-clone",
        "tests": "tests",
        "runner": "pytest",
        # `multipart` is python-multipart's import name. It is in
        # requirements.txt and easy to leave out of a venv: without it
        # fastapi raises at request time, not import time, so nine tests
        # error and it reads as a broken consent gate rather than a
        # missing package. Checked here so the message names the cause.
        "requires": ("pytest", "fastapi", "httpx", "multipart"),
    },
)

# Directories holding Python this repository ships or runs, excluding archive/.
SOURCE_ROOTS = ("tools", "python", "backend")

# Measured on 3 September 2026 and under the floor, with what was measured.
BELOW_FLOOR = {
    "tools/agentkit/agentkit/__init__.py": {
        "covered": 0, "total": 12,
        "note": "twelve re-export lines that run at import time, before the tracer is attached; "
                "there is no behaviour here to test",
    },
    "tools/agentkit/agentkit/events.py": {
        "covered": 8, "total": 40,
        "note": "the event records the devui streams; the suite builds two of the seven kinds",
    },
    "python/sonara_ops/__init__.py": {
        "covered": 0, "total": 4, "note": "no suite exists for python/sonara_ops",
    },
    "python/sonara_ops/analytics.py": {
        "covered": 0, "total": 11, "note": "no suite exists for python/sonara_ops",
    },
    "python/sonara_ops/config.py": {
        "covered": 0, "total": 29, "note": "no suite exists for python/sonara_ops",
    },
    "python/sonara_ops/db.py": {
        "covered": 0, "total": 62, "note": "no suite exists for python/sonara_ops",
    },
    "python/sonara_ops/healthcheck.py": {
        "covered": 0, "total": 36, "note": "no suite exists for python/sonara_ops",
    },
    "python/sonara_ops/main.py": {
        "covered": 0, "total": 41, "note": "no suite exists for python/sonara_ops",
    },
    "python/sonara_ops/migrations.py": {
        "covered": 0, "total": 16, "note": "no suite exists for python/sonara_ops",
    },
    "python/sonara_ops/stripe_audit.py": {
        "covered": 0, "total": 7, "note": "no suite exists for python/sonara_ops",
    },
    "python/scripts/db_healthcheck.py": {
        "covered": 0, "total": 4, "note": "a four-line entry point that calls into sonara_ops",
    },
    "python/scripts/export_schema_report.py": {
        "covered": 0, "total": 5, "note": "a five-line entry point that calls into sonara_ops",
    },
    "backend/main.py": {
        "covered": 0, "total": 3,
        "note": "a three-line uvicorn entry point for the FastAPI service under backend/",
    },
    "tools/disposable-domains/disposable_domains/cli.py": {
        "covered": 0, "total": 163,
        "note": "the four blocklist subcommands (check, fix, update, match). The suite tests the "
                "validator and the public-suffix logic underneath them directly, and never through argv",
    },
    "tools/disposable-domains/disposable_domains/__main__.py": {
        "covered": 0, "total": 4,
        "note": "four lines that call cli.main() and exit with its status",
    },
    "tools/voice-clone/voiceclone/openvoice_engine.py": {
        "covered": 29, "total": 85,
        "note": "0.9 points under. Its own first line says it has never been run: written against "
                "OpenVoice's published documentation, on a machine with no GPU and without the "
                "checkpoints. What the suite reaches is the interface it shares with the stub engine",
    },
    "backend/app/main.py": {
        "covered": 0, "total": 262,
        "note": "backend/ is a second application that builds and does not deploy -- vercel.json "
                "bundles only public/, routes/ and lib/. CI compiles it and asserts two routes exist; "
                "nothing exercises it. Whether it should exist is the open question in docs/SPRINT_LOG.md",
    },
}

# Suites this environment cannot run, and the import that is missing. Each entry
# excuses every source file under that root -- see the header on why a file
# whose suite did not run is `not measured` rather than `0% covered`.
UNMEASURED = {
    "tools/disposable-domains": {
        "missing": "pytest",
        "note": "a pytest suite of 44 tests that CI installs and runs (tools-python-suites); "
                "the release chain here installs no Python packages",
    },
    "tools/voice-clone": {
        "missing": "pytest",
        "note": "a pytest suite of 28 tests -- the consent gate AGENTS.md requires -- that CI "
                "installs and runs (tools-python-suites); it also needs fastapi and httpx",
    },
}

# This check has gone blind if it is suddenly seeing far less than is there.
# Both sit below today's figures and far above nothing.
MINIMUM_FILES = 25
MINIMUM_LINES = 2000

failures = []


def fail(message):
    failures.append(message)
    sys.stderr.write("ERROR: %s\n" % message)


def rel(path):
    return str(Path(path).resolve().relative_to(REPO)).replace(os.sep, "/")


def executable_lines(path):
    """The line numbers the compiler emits code for. Nothing else can run."""
    source = path.read_text(encoding="utf8")
    try:
        code = compile(source, str(path), "exec")
    except SyntaxError as error:
        fail("%s does not compile (%s); nothing can measure it" % (rel(path), error))
        return set()
    lines = set()
    seen = set()
    stack = [code]
    while stack:
        current = stack.pop()
        if id(current) in seen:
            continue
        seen.add(id(current))
        for _, _, lineno in current.co_lines():
            if lineno is not None:
                lines.add(lineno)
        for const in current.co_consts:
            if hasattr(const, "co_lines"):
                stack.append(const)
    return lines


def source_files():
    """Python this repository runs. Tests are excluded from the population for
    the same reason tests/ is excluded from the JavaScript gate: a suite that
    covers itself is not evidence about the code it is for."""
    found = []
    for root in SOURCE_ROOTS:
        base = REPO / root
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*.py")):
            parts = path.relative_to(REPO).parts
            if "archive" in parts or "tests" in parts or "__pycache__" in parts:
                continue
            found.append(path)
    return found


def missing_import(suite):
    for name in suite["requires"]:
        if importlib.util.find_spec(name) is None:
            return name
    return None


def make_tracer(hits, repo_prefix):
    def tracer(frame, event, arg):
        # Keyed on co_filename, which is the file the code is really in.
        # `trace.Trace` keys its ignore decisions on the bare basename instead,
        # which is the trap described in this script's header.
        filename = frame.f_code.co_filename
        if filename.startswith(repo_prefix):
            hits.setdefault(filename, set()).add(frame.f_lineno)
        return tracer
    return tracer


def load_unittest_suite(suite, tests):
    """Build the suite, asserting discovery found something.

    `unittest discover` exits 0 when it finds nothing -- a moved directory, a
    renamed file, a missing __init__ -- so a suite that vanished would look here
    like a suite covering nothing, and the register would fill with exemptions
    for a directory nobody noticed was gone.
    """
    loader = unittest.defaultTestLoader
    if (tests / "__init__.py").exists():
        return loader.discover(start_dir=suite["tests"], top_level_dir=".")
    sys.path.insert(0, str(tests))
    names = sorted(f.stem for f in tests.glob("test_*.py"))
    if not names:
        fail("%s/%s holds no test_*.py file; a suite this check expects has gone"
             % (suite["root"], suite["tests"]))
        return None
    return unittest.TestSuite(loader.loadTestsFromName(name) for name in names)


def run_suite(suite, executed):
    """Run one suite under the tracer. Returns (tests_run, measured)."""
    repo_prefix = str(REPO) + os.sep
    root = REPO / suite["root"]
    tests = root / suite["tests"]
    if not tests.is_dir():
        fail("%s has no %s directory; a suite this check expects has moved or gone"
             % (suite["root"], suite["tests"]))
        return 0, False

    absent = missing_import(suite)
    if absent:
        entry = UNMEASURED.get(suite["root"])
        if not entry:
            fail("%s cannot run here -- `import %s` fails -- and it is not in UNMEASURED in "
                 "scripts/verify-python-coverage-floor.py. Record it there, or install what it needs; "
                 "grading its files 0%% would report a run that did not happen."
                 % (suite["root"], absent))
        return 0, False

    hits = {}
    tracer = make_tracer(hits, repo_prefix)
    previous_path = list(sys.path)
    previous_cwd = os.getcwd()
    previous_modules = set(sys.modules)
    os.chdir(root)
    sys.path.insert(0, str(root))
    ran = 0
    ok = False
    try:
        if suite["runner"] == "pytest":
            import pytest
            cases = None
        else:
            cases = load_unittest_suite(suite, tests)
            if cases is None:
                return 0, False

        # threading.settrace as well as sys.settrace: sys.settrace applies only
        # to the calling thread, so a suite that starts one -- voice-clone's app
        # and agentkit's devui both serve HTTP -- would have its worker's lines
        # unrecorded and read here as untested code.
        previous_thread_trace = threading._trace_hook
        threading.settrace(tracer)
        sys.settrace(tracer)
        try:
            if suite["runner"] == "pytest":
                collected = []

                class Count:
                    def pytest_runtest_logreport(self, report):
                        if report.when == "call":
                            collected.append(report.nodeid)

                status = pytest.main([suite["tests"], "-q", "-p", "no:cacheprovider"], plugins=[Count()])
                ran = len(collected)
                ok = status == 0
            else:
                # The suite's own output is captured: several of these tests
                # print, and a wall of their output between this script's
                # findings is how a failure gets scrolled past.
                result = unittest.TextTestRunner(stream=io.StringIO(), verbosity=0).run(cases)
                ran = result.testsRun
                ok = result.wasSuccessful()
        finally:
            sys.settrace(None)
            threading.settrace(previous_thread_trace)
    finally:
        os.chdir(previous_cwd)
        sys.path[:] = previous_path
        # Leaving a suite's modules imported lets the next suite's `import
        # config` resolve to the previous suite's file. These packages have
        # short, colliding module names.
        for name in set(sys.modules) - previous_modules:
            sys.modules.pop(name, None)

    if ran == 0:
        fail("%s: discovery found no tests; a suite that runs nothing cannot report coverage" % suite["root"])
        return 0, False
    if not ok:
        fail("%s: the suite did not pass, so its coverage says nothing. Fix the suite first." % suite["root"])
        return ran, False

    for filename, lines in hits.items():
        try:
            resolved = Path(filename).resolve()
            resolved.relative_to(REPO)
        except (ValueError, OSError):
            continue
        executed.setdefault(str(resolved), set()).update(lines)
    return ran, True


def main():
    executed = {}
    total_tests = 0
    unmeasured_roots = set()
    for suite in SUITES:
        ran, measured = run_suite(suite, executed)
        total_tests += ran
        if not measured:
            unmeasured_roots.add(suite["root"])

    # Whether a suite runs depends on what is installed, so "it ran here" is not
    # something the register can assert. What the register must not do is let a
    # suite go unmeasured everywhere: SONARA_PYTHON_COVERAGE_COMPLETE turns any
    # unmeasured suite into a failure, and CI sets it after installing the two
    # requirements files -- the same shape as SONARA_MIGRATION_REPLAY_REQUIRED,
    # and for the same reason. A check whose skip path is the one that always
    # runs is not a check.
    complete = os.environ.get("SONARA_PYTHON_COVERAGE_COMPLETE") == "1"
    for root in sorted(unmeasured_roots):
        if complete:
            fail("%s was not measured, and SONARA_PYTHON_COVERAGE_COMPLETE is set. Install what its "
                 "suite needs -- pip install -r %s/requirements.txt -- so its files are graded rather "
                 "than excused." % (root, root))
    for root in UNMEASURED:
        if not (REPO / root).is_dir():
            fail("UNMEASURED names %s, which is not a directory. A rename must not retire an exemption "
                 "without anybody deciding to." % root)

    measured = []
    skipped = []
    skipped_lines = 0
    for path in source_files():
        lines = executable_lines(path)
        if not lines:
            continue
        name = rel(path)
        if any(name.startswith(root + "/") for root in unmeasured_roots):
            skipped.append(name)
            skipped_lines += len(lines)
            continue
        hit = executed.get(str(path.resolve()), set()) & lines
        measured.append({"rel": name, "covered": len(hit), "total": len(lines), "ratio": len(hit) / len(lines)})

    # The blindness guard counts every source file this check considered, not
    # only the ones it could grade. Otherwise moving a directory into UNMEASURED
    # would shrink the population and satisfy the guard at the same time, which
    # is the guard defeating itself.
    population = len(measured) + len(skipped)
    if population < MINIMUM_FILES:
        fail("only %d Python source files were found, expected at least %d; this check has gone blind"
             % (population, MINIMUM_FILES))
        return report(measured, skipped, total_tests)

    total_lines = sum(row["total"] for row in measured) + skipped_lines
    if total_lines < MINIMUM_LINES:
        fail("only %d executable Python lines were found, expected at least %d; this check has gone blind"
             % (total_lines, MINIMUM_LINES))
        return report(measured, skipped, total_tests)

    by_path = {row["rel"]: row for row in measured}

    for row in measured:
        entry = BELOW_FLOOR.get(row["rel"])
        percent = row["ratio"] * 100
        if row["ratio"] < FLOOR and not entry:
            fail("%s is %.1f%% covered (%d/%d), under the %g%% floor, and is not in BELOW_FLOOR in "
                 "scripts/verify-python-coverage-floor.py. Either test it, or record it there with what it "
                 "is and why." % (row["rel"], percent, row["covered"], row["total"], FLOOR * 100))
        if row["ratio"] >= FLOOR and entry:
            fail("%s is now %.1f%% covered (%d/%d) and has reached the floor, but is still listed in "
                 "BELOW_FLOOR. Remove its entry -- a recorded reason that no longer describes anything is "
                 "what the next person reads instead of checking."
                 % (row["rel"], percent, row["covered"], row["total"]))
        if entry and RUNNING_ON == MEASURED_ON:
            was = entry["covered"] / entry["total"] * 100
            if was - percent > REGRESSION_TOLERANCE_POINTS:
                fail("%s was %.1f%% when it was recorded and is %.1f%% now, %.1f points worse. The register "
                     "records where things stand; it is not somewhere to put a file to stop it being looked "
                     "at." % (row["rel"], was, percent, was - percent))

    for name in BELOW_FLOOR:
        if name not in by_path:
            if name in skipped:
                # Its suite did not run here, so this run has nothing to say
                # about it either way. The figure in the entry was taken where
                # the suite does run, and CI grades it against that.
                continue
            fail("BELOW_FLOOR names %s, which nothing measured. If it was renamed or deleted, update "
                 "the register -- otherwise a rename retires an exemption without anybody deciding to."
                 % name)

    return report(measured, skipped, total_tests)


def report(measured, skipped, total_tests):
    total_lines = sum(row["total"] for row in measured) or 1
    covered_lines = sum(row["covered"] for row in measured)
    under = sum(1 for row in measured if row["ratio"] < FLOOR)
    unmeasured = (" -- %d files went unmeasured, their suites needing packages this environment does not "
                  "have" % len(skipped)) if skipped else " -- every Python source file was measured"
    interpreter = "on Python %d.%d" % RUNNING_ON
    if RUNNING_ON != MEASURED_ON:
        interpreter += (", not the %d.%d the register was measured on -- the floor still applies, the "
                        "regression comparison does not" % MEASURED_ON)
    population = ("%d files, %d executable lines, %.1f%% covered overall, %d under the %g%% floor against "
                  "%d register entries, from %d tests, %s%s"
                  % (len(measured), sum(row["total"] for row in measured), covered_lines / total_lines * 100,
                     under, FLOOR * 100, len(BELOW_FLOOR), total_tests, interpreter, unmeasured))

    # The word "verified" belongs only on a run that found nothing. Printing it
    # beneath a list of errors is the defect this repository keeps finding.
    if failures:
        sys.stderr.write("\nPython coverage floor check FAILED. Measured %s.\n" % population)
        return 1
    sys.stdout.write("Python coverage floor verified: %s.\n" % population)
    return 0


if __name__ == "__main__":
    sys.exit(main())
