"""What `run_health_checks` says once a database *is* reachable.

The other test file covers the unconfigured branch, which is the state every CI
job is in. This one covers the branch that actually grades a production
database — and until now nothing did, because reaching it needs a connection.

It does not need a real one. What is worth testing here is not the SQL, which is
four straightforward queries, but the **interpretation**: what a missing table
does to the status, what an absent RLS flag does to the score, and whether a
partial answer is reported as a partial answer. That is where this repository's
recurring defects live, and it is reachable by replacing the three functions
`healthcheck` calls with ones that return a known shape.

`db.py`'s own row handling is covered the same way, one layer lower, with a fake
engine — so the real `text(...)` queries are built and the real row-to-dict and
row-to-set code runs, without a server.

One thing checked and **not** a defect, recorded so it is not re-derived:

    missing_rls = [name for name in RLS_TABLES if not rls_status.get(name)]

`.get()` returns None for a table that is not in the result at all, so "RLS is
off" and "the table does not exist" collapse into one list. That looks like the
absent-read-as-false shape, and it is not, for two reasons the code makes
explicit: the message says "RLS missing/unknown" rather than claiming to know
which, and every RLS table is also a required table, so a table that is absent
has already been reported by the check above. The ambiguity is named rather than
hidden. `test_an_absent_table_is_not_silently_called_rls_off` holds both halves
of that.
"""

import unittest
from contextlib import contextmanager
from unittest import mock

from sonara_ops import healthcheck
from sonara_ops import db as ops_db


def grade(name, checks):
    found = [check for check in checks if check.name == name]
    assert len(found) == 1, f"expected exactly one {name} check, got {len(found)}"
    return found[0]


@contextmanager
def connected(existing=None, rls=None):
    """A reachable database that says exactly what it is told to."""
    existing = healthcheck.REQUIRED_TABLES if existing is None else existing
    rls = {name: True for name in healthcheck.RLS_TABLES} if rls is None else rls
    with mock.patch.object(healthcheck, "test_connection", return_value=(True, "connected")), \
         mock.patch.object(healthcheck, "fetch_existing_tables", return_value=set(existing)), \
         mock.patch.object(healthcheck, "fetch_rls_status", return_value=dict(rls)):
        yield


class TestTheFixtureCanFail(unittest.TestCase):
    def test_a_healthy_database_reports_healthy(self):
        # If this cannot pass, every "it noticed the problem" case below is
        # measuring a harness that always complains.
        with connected():
            checks = healthcheck.run_health_checks()
        self.assertEqual(len(checks), 3, "the connected branch no longer returns three checks")
        for check in checks:
            self.assertEqual(check.status, "pass", f"{check.name} was {check.status} on a database with nothing wrong")
            self.assertEqual(check.score, 1.0, f"{check.name} scored {check.score} on a database with nothing wrong")

    def test_the_required_list_is_worth_grading(self):
        self.assertGreaterEqual(len(healthcheck.REQUIRED_TABLES), 5)
        self.assertGreaterEqual(len(healthcheck.RLS_TABLES), 3)


class TestMissingTables(unittest.TestCase):
    def test_a_missing_table_fails_and_is_named(self):
        absent = healthcheck.REQUIRED_TABLES[0]
        with connected(existing=healthcheck.REQUIRED_TABLES[1:]):
            check = grade("required_tables", healthcheck.run_health_checks())
        self.assertEqual(check.status, "fail")
        self.assertIn(absent, check.message, "the missing table is not named, so the report says nothing actionable")

    def test_the_score_is_the_fraction_present(self):
        # Not a boolean. Somebody reading a dashboard needs to tell one missing
        # table from all of them.
        total = len(healthcheck.REQUIRED_TABLES)
        with connected(existing=healthcheck.REQUIRED_TABLES[1:]):
            check = grade("required_tables", healthcheck.run_health_checks())
        self.assertAlmostEqual(check.score, (total - 1) / total)

        with connected(existing=[]):
            empty = grade("required_tables", healthcheck.run_health_checks())
        self.assertEqual(empty.score, 0.0)
        self.assertEqual(empty.status, "fail")

    def test_a_table_nobody_asked_about_cannot_push_the_score_over_one(self):
        # This failed when first written. The score was
        # `len(existing_tables) / len(REQUIRED_TABLES)` -- the size of whatever
        # came back over the length of the list -- and an extra name scored
        # 1.14. Unreachable today, because the query filters on the names it was
        # given; reachable the moment anything else feeds this function.
        with connected(existing=list(healthcheck.REQUIRED_TABLES) + ["something_else"]):
            check = grade("required_tables", healthcheck.run_health_checks())
        self.assertLessEqual(check.score, 1.0, "an unexpected table inflated the health score past 1.0")

    def test_a_repeated_name_does_not_drag_a_healthy_database_below_one(self):
        # The other half of the same defect, and the half an ordinary edit
        # reaches: a name listed twice used to inflate the denominator while the
        # set difference stayed empty, so a database with nothing wrong scored
        # 0.88 next to the words "All required tables exist".
        repeated = list(healthcheck.REQUIRED_TABLES) + [healthcheck.REQUIRED_TABLES[0]]
        with mock.patch.object(healthcheck, "REQUIRED_TABLES", repeated):
            with connected(existing=repeated):
                check = healthcheck.run_health_checks()[1]
        self.assertEqual(check.status, "pass")
        self.assertEqual(check.score, 1.0,
                         "a duplicated entry in REQUIRED_TABLES scored a healthy database below 1.0")


class TestRowLevelSecurity(unittest.TestCase):
    def test_rls_off_on_one_table_fails_and_names_it(self):
        off = healthcheck.RLS_TABLES[0]
        rls = {name: True for name in healthcheck.RLS_TABLES}
        rls[off] = False
        with connected(rls=rls):
            check = grade("rls_enabled", healthcheck.run_health_checks())
        self.assertEqual(check.status, "fail")
        self.assertIn(off, check.message)

    def test_an_absent_table_is_not_silently_called_rls_off(self):
        # `.get()` returns None for a table missing from the result, so "off"
        # and "not there" land in the same list. That is deliberate and safe
        # here, and both halves of why are asserted: the wording does not claim
        # to know which, and every RLS table is also checked for existence, so
        # an absent one is already reported above.
        with connected(rls={}):
            checks = healthcheck.run_health_checks()
        rls_check = grade("rls_enabled", checks)
        self.assertEqual(rls_check.status, "fail")
        self.assertIn("unknown", rls_check.message.lower(),
                      "the RLS message claims the flag is off when it may be a table that is not there")
        for name in healthcheck.RLS_TABLES:
            self.assertIn(name, healthcheck.REQUIRED_TABLES,
                          f"{name} is graded for RLS but never checked for existence, so an absent table "
                          "would be reported only as an RLS failure")

    def test_the_score_is_the_fraction_protected(self):
        total = len(healthcheck.RLS_TABLES)
        rls = {name: True for name in healthcheck.RLS_TABLES}
        rls[healthcheck.RLS_TABLES[0]] = False
        with connected(rls=rls):
            check = grade("rls_enabled", healthcheck.run_health_checks())
        self.assertAlmostEqual(check.score, (total - 1) / total)


class TestReadingRows(unittest.TestCase):
    """`db.py`'s row handling, with a fake engine so the real queries are built."""

    def _engine(self, rows):
        connection = mock.MagicMock()
        connection.execute.return_value = rows
        engine = mock.MagicMock()
        engine.connect.return_value.__enter__.return_value = connection
        engine.connect.return_value.__exit__.return_value = False
        return engine, connection

    def test_an_empty_request_asks_the_database_nothing(self):
        # Not a correctness nicety: `= any('{}')` is a round trip to learn
        # something the caller already knew.
        with mock.patch.object(ops_db, "get_engine") as engine:
            self.assertEqual(ops_db.fetch_existing_tables([]), set())
            self.assertEqual(ops_db.fetch_rls_status([]), {})
            engine.assert_not_called()

    def test_existing_tables_comes_back_as_the_names_that_were_there(self):
        engine, connection = self._engine([("platform_jobs",), ("system_audit_events",)])
        with mock.patch.object(ops_db, "get_engine", return_value=engine):
            found = ops_db.fetch_existing_tables(["platform_jobs", "system_audit_events", "gone"])
        self.assertEqual(found, {"platform_jobs", "system_audit_events"})
        self.assertNotIn("gone", found, "a table the database did not return was reported as present")
        sql = str(connection.execute.call_args[0][0])
        self.assertIn("information_schema.tables", sql)
        self.assertIn("table_schema = 'public'", sql, "the existence query is not scoped to the public schema")

    def test_rls_status_keeps_false_apart_from_absent(self):
        # The row says False; the dict says False. A table with no row is simply
        # not a key, which is what lets the caller tell the two apart if it ever
        # needs to.
        engine, _ = self._engine([("platform_jobs", True), ("system_audit_events", False)])
        with mock.patch.object(ops_db, "get_engine", return_value=engine):
            status = ops_db.fetch_rls_status(["platform_jobs", "system_audit_events", "absent"])
        self.assertEqual(status["platform_jobs"], True)
        self.assertEqual(status["system_audit_events"], False)
        self.assertNotIn("absent", status, "a table with no row was given a value it does not have")

    def test_platform_jobs_are_returned_newest_first_and_bounded(self):
        row = mock.MagicMock()
        row._mapping = {"id": 1, "job_type": "sync", "status": "queued"}
        engine, connection = self._engine([row])
        with mock.patch.object(ops_db, "get_engine", return_value=engine):
            jobs = ops_db.fetch_platform_jobs(limit=5)
        self.assertEqual(jobs, [{"id": 1, "job_type": "sync", "status": "queued"}])
        sql = str(connection.execute.call_args[0][0])
        self.assertIn("order by created_at desc", sql, "the job list is not ordered, so 'recent' means nothing")
        self.assertIn("limit :limit", sql, "the job list is unbounded")
        self.assertEqual(connection.execute.call_args[0][1], {"limit": 5}, "the limit is not passed as a parameter")

    def test_every_query_binds_its_values_rather_than_formatting_them(self):
        # These take table names from a caller. Building the SQL with an f-string
        # would be an injection in an ops tool that runs with a superuser URL.
        source = ops_db.__file__
        with open(source, encoding="utf8") as handle:
            text = handle.read()
        self.assertNotIn('f"""', text, "db.py builds SQL with an f-string")
        self.assertNotIn("format(", text, "db.py builds SQL with .format()")
        self.assertIn(":table_names", text, "the table-name queries no longer bind their parameter")


if __name__ == "__main__":
    unittest.main()
