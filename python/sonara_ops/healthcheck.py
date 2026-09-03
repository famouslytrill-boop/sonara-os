from dataclasses import dataclass

from sonara_ops.db import fetch_existing_tables, fetch_rls_status, test_connection


# The tables a health check may demand production has.
#
# Two names were removed on 3 September 2026 because neither could ever pass,
# and nothing had noticed -- this package runs in no workflow, so
# `run_health_checks()` had never been executed anywhere automated.
#
#   stripe_events     is created by no migration and referenced nowhere in
#                     lib/, routes/ or server.js. It is a name, not a table.
#
# A required-table list that names something nothing creates does not report a
# problem with the database; it reports a problem with itself, permanently, in
# language that reads like a real finding. The tests cross-check every name here
# against the migrations so it cannot drift again.
#
# `stripe_customers` was removed here too, on 3 September, and put back the same
# day. The reason given was that it appears in
# 20260805120000_retire_superseded_tables.sql -- which it does, as the **second**
# element of `['billing_customers', 'stripe_customers']`. That array is pairs of
# retired-table and what-replaced-it, so the name appearing in it is what makes
# stripe_customers *live*. Reading the list without reading its shape produced a
# confident, wrong removal of a table the health check should watch.
REQUIRED_TABLES = [
    "stripe_customers",
    "subscriptions",
    "sonara_user_subscriptions",
    "platform_jobs",
    "system_audit_events",
    "db_health_snapshots",
    "creator_activity_events",
]

RLS_TABLES = [
    "platform_jobs",
    "system_audit_events",
    "db_health_snapshots",
    "creator_activity_events",
]


@dataclass(frozen=True)
class HealthCheck:
    name: str
    status: str
    message: str
    score: float | None = None


def run_health_checks() -> list[HealthCheck]:
    checks: list[HealthCheck] = []
    connected, message = test_connection()
    checks.append(HealthCheck("database_connection", "pass" if connected else "warn", message, 1.0 if connected else 0.0))

    if not connected:
        checks.append(HealthCheck("required_tables", "warn", "Skipped table checks until SUPABASE_DB_URL is configured", None))
        checks.append(HealthCheck("rls_enabled", "warn", "Skipped RLS checks until SUPABASE_DB_URL is configured", None))
        return checks

    required = set(REQUIRED_TABLES)
    existing_tables = fetch_existing_tables(REQUIRED_TABLES)
    # Both numbers come from the same intersection. They used to not: the status
    # was computed from `required - existing_tables` while the score was
    # `len(existing_tables) / len(REQUIRED_TABLES)` -- the size of whatever the
    # query returned over the length of a list that may repeat itself. Neither
    # half is safe on its own. A row for a table nobody asked about scores above
    # 1.0, and a duplicate name in REQUIRED_TABLES inflates the denominator so a
    # healthy database scores below 1.0 while the status still reads "pass".
    # The second one is one ordinary edit away, and a dashboard showing 0.88
    # beside "All required tables exist" is the shape this repository keeps
    # finding: a number that disagrees with the sentence next to it.
    present = required & existing_tables
    missing_tables = sorted(required - existing_tables)
    checks.append(
        HealthCheck(
            "required_tables",
            "pass" if not missing_tables else "fail",
            "All required tables exist" if not missing_tables else f"Missing tables: {', '.join(missing_tables)}",
            len(present) / len(required),
        )
    )

    rls_status = fetch_rls_status(RLS_TABLES)
    # `.get()` returns None for a table the query returned no row for, so "RLS is
    # off" and "the table is not there" land in the same list. That is deliberate
    # and the wording says so -- "missing/unknown" rather than a claim to know
    # which -- and every name in RLS_TABLES is also in REQUIRED_TABLES, so an
    # absent one has already been reported by the check above.
    missing_rls = [name for name in dict.fromkeys(RLS_TABLES) if not rls_status.get(name)]
    graded = len(dict.fromkeys(RLS_TABLES))
    checks.append(
        HealthCheck(
            "rls_enabled",
            "pass" if not missing_rls else "fail",
            "RLS enabled on ops tables" if not missing_rls else f"RLS missing/unknown: {', '.join(missing_rls)}",
            (graded - len(missing_rls)) / graded,
        )
    )

    return checks
