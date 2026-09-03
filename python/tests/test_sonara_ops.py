"""What `python/sonara_ops` does, checked for the first time.

This package had **no tests and no workflow**. Eleven declared dependencies, a
CLI entry point, a health check that grades the production database — and
nothing in `.github/workflows` installs it, imports it, compiles it or runs it.
`backend/` at least has `backend-dependencies` asserting it builds; this had
nothing, which is the same argument the agentkit CI job makes one level up: a
test suite nothing runs is a check that cannot fail, and a *package* nothing
runs is worse, because it looks like tooling somebody relies on.

Two things that could never have passed were found by writing this file, and
both are in `REQUIRED_TABLES` — the list `run_health_checks()` uses to decide
whether production is healthy:

  stripe_customers  retired in 20260805120000_retire_superseded_tables.sql
  stripe_events     created by no migration, named nowhere in lib/ or routes/

A required-table list naming something nothing creates does not report a problem
with the database. It reports a problem with itself, for ever, in language that
reads like a real finding. Both are removed, and `test_health_tables_exist`
below cross-checks the list against the migration files so the next name that
stops existing fails here instead.

Everything here runs without a database. `SUPABASE_DB_URL` is deliberately not
set, because the useful question about this package is what it does when it is
not configured — that is the state every developer and every CI job is in.
"""

import re
import unittest
from pathlib import Path

from sonara_ops import analytics, config, healthcheck, migrations, stripe_audit
from sonara_ops import db as ops_db

REPO = Path(__file__).resolve().parents[2]
MIGRATIONS = REPO / "supabase" / "migrations"
RETIRE_FILE = MIGRATIONS / "20260805120000_retire_superseded_tables.sql"


def tables_created_by_migrations() -> set[str]:
    """Every `public.<name>` a migration creates."""
    found: set[str] = set()
    for path in MIGRATIONS.glob("*.sql"):
        text = path.read_text(encoding="utf8", errors="replace")
        found |= set(re.findall(r"create table (?:if not exists )?public\.([a-z_0-9]+)", text))
    return found


def tables_retired() -> set[str]:
    if not RETIRE_FILE.exists():
        return set()
    return set(re.findall(r"'([a-z_0-9]+)'", RETIRE_FILE.read_text(encoding="utf8", errors="replace")))


class TestTheFixtureCanFail(unittest.TestCase):
    """Shape 1: a check satisfied by measuring nothing."""

    def test_the_migrations_are_where_this_thinks_they_are(self):
        self.assertTrue(MIGRATIONS.is_dir(), "the migrations directory moved; every cross-check below is vacuous")
        created = tables_created_by_migrations()
        self.assertGreater(len(created), 60, f"only {len(created)} tables parsed from the migrations; this check has gone blind")
        self.assertGreater(len(tables_retired()), 10, "the retired list parsed as almost nothing; the negative check below proves little")

    def test_the_required_list_is_not_empty(self):
        self.assertGreaterEqual(len(healthcheck.REQUIRED_TABLES), 5, "REQUIRED_TABLES has shrunk to almost nothing")
        self.assertGreaterEqual(len(healthcheck.RLS_TABLES), 3, "RLS_TABLES has shrunk to almost nothing")


class TestHealthTablesExist(unittest.TestCase):
    """The finding, kept as a check."""

    def test_every_required_table_is_created_by_a_migration(self):
        created = tables_created_by_migrations()
        for table in healthcheck.REQUIRED_TABLES:
            self.assertIn(
                table,
                created,
                f"REQUIRED_TABLES names {table}, which no migration creates. The health check would report it "
                "missing from production for ever, and the message would read like a real finding",
            )

    def test_no_required_table_has_been_retired(self):
        retired = tables_retired()
        for table in healthcheck.REQUIRED_TABLES:
            self.assertNotIn(
                table,
                retired,
                f"REQUIRED_TABLES names {table}, which 20260805120000_retire_superseded_tables.sql removed on "
                "purpose. Demanding a table somebody deliberately deleted is a check that can only fail",
            )

    def test_every_rls_table_is_also_a_required_table(self):
        # Asking whether row level security is on for a table nothing checks the
        # existence of answers a question about a table that may not be there.
        for table in healthcheck.RLS_TABLES:
            self.assertIn(table, healthcheck.REQUIRED_TABLES, f"{table} is checked for RLS but not for existence")


class TestWithNoDatabaseConfigured(unittest.TestCase):
    """What this package does in the state every CI job is actually in."""

    def test_a_missing_url_is_reported_rather_than_raised(self):
        connected, message = ops_db.test_connection()
        self.assertFalse(connected)
        self.assertIsInstance(message, str)
        self.assertTrue(message, "a failed connection reported an empty reason")

    def test_the_failure_never_carries_the_connection_string(self):
        # `test_connection` returns `exc.__class__.__name__` and not the
        # exception's message, on purpose: a SQLAlchemy connection error prints
        # the URL it tried, and the URL is a password. The same rule the crawler
        # applies to fetch errors.
        _, message = ops_db.test_connection()
        for leak in ("postgres://", "postgresql://", "@", "password"):
            self.assertNotIn(leak, message, f"the connection failure message carries {leak!r}")

    def test_health_checks_warn_rather_than_claim_health(self):
        checks = healthcheck.run_health_checks()
        self.assertGreaterEqual(len(checks), 3, "run_health_checks returned almost nothing")
        names = {check.name for check in checks}
        self.assertIn("database_connection", names)
        # Not configured is not healthy, and it is not broken either.
        for check in checks:
            self.assertIn(check.status, {"pass", "warn", "fail"}, f"{check.name} returned status {check.status!r}")
            self.assertNotEqual(
                check.status, "pass",
                f"{check.name} passed with no database configured, which is a health report about nothing",
            )
            self.assertTrue(check.message, f"{check.name} gave no reason")

    def test_the_stripe_audit_says_it_is_unconfigured(self):
        summary = stripe_audit.stripe_audit_summary()
        self.assertFalse(summary["stripe_secret_configured"])
        self.assertGreaterEqual(len(summary["checks"]), 3, "the audit checklist is empty")


class TestRedaction(unittest.TestCase):
    def test_absent_and_present_are_different_words(self):
        # "missing" and "configured" are three states, not two: no value, a
        # value too short to show any of, and a value with a shape worth showing.
        self.assertEqual(config.redact(None), "missing")
        self.assertEqual(config.redact(""), "missing")
        self.assertEqual(config.redact("short"), "configured")
        self.assertEqual(config.redact("12345678"), "configured")

    def test_a_long_secret_is_never_returned_whole(self):
        # Assembled at run time rather than written as a literal.
        #
        # The first draft used a realistic-looking Stripe live key, and GitHub
        # push protection refused the push -- correctly: the string matched
        # Stripe's live-key format, and a repository that carries one teaches
        # people to click past that warning. AGENTS.md says do not commit
        # secrets, and a fake one shaped exactly like a real one is the same
        # problem with none of the value. What this test needs is a long opaque
        # value, and any long opaque value will do.
        secret = "-".join(["FIXTURE", "NOT", "A", "KEY"]) + "-" + "0123456789abcdef" * 2
        shown = config.redact(secret)
        # Every assertion carries its own message. The first draft left this one
        # bare, and when the probe broke `redact` the test failed with
        # "'sk_live...' != ..." -- correct, and it named the value rather than
        # the problem. A failure that does not say what went wrong sends the
        # next person to read the assertion instead of the finding.
        self.assertNotEqual(shown, secret, "redact returned the secret whole")
        self.assertNotIn(secret, shown, "redact returned something containing the whole secret")
        self.assertLess(len(shown), len(secret), "redact returned something at least as long as the secret")
        self.assertIn("...", shown, "redact returned no elision mark, so nothing shows the value was shortened")

    def test_the_boundary_is_where_it_says_it_is(self):
        # Nine characters is the first length that shows any of the value, and
        # it shows six of nine. That is the trade-off as written; the test is
        # here so changing it is a decision rather than a slip.
        self.assertEqual(config.redact("123456789"), "123...789")


class TestAnalytics(unittest.TestCase):
    def test_an_empty_series_is_zero_rather_than_an_error(self):
        self.assertEqual(analytics.activity_score([]), 0.0)

    def test_negative_counts_are_floored_rather_than_subtracted(self):
        # A negative event count is not a real measurement; letting it drag the
        # mean down would report less activity than nothing.
        self.assertEqual(analytics.activity_score([-5, 10]), 5.0)
        self.assertEqual(analytics.activity_score([-1, -1, -1]), 0.0)

    def test_the_mean_is_the_mean(self):
        self.assertEqual(analytics.activity_score([1, 2, 3]), 2)
        self.assertEqual(analytics.activity_score([1, 2]), 1.5)

    def test_no_jobs_at_all_is_zero_and_not_a_division(self):
        # 0/0. The repository's recurring defect one shape over: a rate computed
        # from nothing must not be an exception and must not be 1.0 either.
        self.assertEqual(analytics.job_success_rate(0, 0), 0.0)
        self.assertEqual(analytics.job_success_rate(-1, -1), 0.0)

    def test_a_real_rate(self):
        self.assertEqual(analytics.job_success_rate(3, 1), 0.75)
        self.assertEqual(analytics.job_success_rate(1, 0), 1.0)
        self.assertEqual(analytics.job_success_rate(0, 4), 0.0)


class TestSettings(unittest.TestCase):
    def test_the_two_has_properties_read_the_values_beside_them(self):
        # `has_database_url` and `has_stripe_secret` are what every caller uses
        # instead of touching the raw value, which is the point: a caller that
        # reads the secret to decide whether it is set is a caller one edit away
        # from printing it.
        blank = config.OpsSettings(SUPABASE_DB_URL=None, STRIPE_SECRET_KEY=None)
        self.assertFalse(blank.has_database_url)
        self.assertFalse(blank.has_stripe_secret)

        filled = config.OpsSettings(
            SUPABASE_DB_URL="postgresql://user:pw@host:5432/db",
            STRIPE_SECRET_KEY="FIXTURE-NOT-A-KEY-0123456789",
        )
        self.assertTrue(filled.has_database_url)
        self.assertTrue(filled.has_stripe_secret)

    def test_an_empty_string_is_not_a_configured_value(self):
        # "" is falsy and must read as absent. A settings object that called an
        # empty string configured would send every caller down the connected
        # path with nothing to connect to.
        empty = config.OpsSettings(SUPABASE_DB_URL="", STRIPE_SECRET_KEY="")
        self.assertFalse(empty.has_database_url)
        self.assertFalse(empty.has_stripe_secret)

    def test_get_settings_is_cached_so_the_env_is_read_once(self):
        self.assertIs(config.get_settings(), config.get_settings())


class TestTheCommandLine(unittest.TestCase):
    """The four commands, run for real with no database configured.

    A CLI that raises rather than reporting is worse than one that says it is
    not set up: somebody running `sonara-ops health` to find out whether the
    database is reachable gets a traceback and no answer to the question.
    """

    def setUp(self):
        from typer.testing import CliRunner

        from sonara_ops.main import app

        self.runner = CliRunner()
        self.app = app

    def test_every_command_exits_zero_without_a_database(self):
        for command in ("health", "schema-report", "stripe-audit", "jobs-list"):
            with self.subTest(command=command):
                result = self.runner.invoke(self.app, [command])
                self.assertEqual(
                    result.exit_code, 0,
                    f"`{command}` exited {result.exit_code} with no database configured; "
                    f"it should report the state, not fail. {result.output[-400:]}",
                )
                self.assertTrue(result.output.strip(), f"`{command}` printed nothing at all")

    def test_no_command_prints_a_secret(self):
        # The whole reason `redact` exists. Asserted against the real output of
        # every command rather than against the function in isolation.
        for command in ("health", "schema-report", "stripe-audit", "jobs-list"):
            with self.subTest(command=command):
                output = self.runner.invoke(self.app, [command]).output
                # Values that can only be a secret. `service_role` was in this
                # list and matched the migration *filename*
                # 20260727024500_service_role_extension_grants.sql printed by
                # schema-report -- a pattern loose enough to match a filename,
                # reporting a leak that was not there. The third time that shape
                # has come up today.
                for leak in ("sk_live_", "sk_test_", "postgresql://", "postgres://", "eyJhbGciOi"):
                    self.assertNotIn(leak, output, f"`{command}` printed {leak!r}")

    def test_health_says_it_could_not_check_rather_than_that_all_is_well(self):
        # Three states again: with nothing configured the table must not read as
        # a healthy database. "connected" is the exact word `test_connection`
        # returns on success, so its absence is the check.
        output = self.runner.invoke(self.app, ["health"]).output
        self.assertIn("database_connection", output, "the health table does not name the connection check")
        self.assertNotIn("connected", output, "health reported a connected database with no URL configured")


class TestMigrationReporting(unittest.TestCase):
    def test_it_finds_the_repository_migrations(self):
        listed = migrations.list_migrations()
        self.assertGreater(len(listed), 60, f"only {len(listed)} migrations found; the path in migrations.py has drifted")
        self.assertTrue(all(path.suffix == ".sql" for path in listed))

    def test_the_list_is_sorted_because_order_is_what_a_migration_is(self):
        listed = [path.name for path in migrations.list_migrations()]
        self.assertEqual(listed, sorted(listed), "migrations came back unsorted; a schema report in the wrong order is misleading")

    def test_the_report_counts_what_it_lists(self):
        report = migrations.schema_report()
        self.assertEqual(report["migration_count"], len(report["migrations"]))
        self.assertEqual(report["migration_count"], len(migrations.list_migrations()))
        self.assertTrue(str(report["migration_dir"]).endswith("supabase/migrations"))

    def test_it_notices_the_platform_ops_migration(self):
        self.assertTrue(
            migrations.schema_report()["has_platform_ops_migration"],
            "007_platform_infrastructure_ops.sql was not found; the flag is derived from a filename and the file moved",
        )


if __name__ == "__main__":
    unittest.main()
