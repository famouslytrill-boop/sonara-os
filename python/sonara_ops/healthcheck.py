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

    existing_tables = fetch_existing_tables(REQUIRED_TABLES)
    missing_tables = sorted(set(REQUIRED_TABLES) - existing_tables)
    checks.append(
        HealthCheck(
            "required_tables",
            "pass" if not missing_tables else "fail",
            "All required tables exist" if not missing_tables else f"Missing tables: {', '.join(missing_tables)}",
            len(existing_tables) / len(REQUIRED_TABLES),
        )
    )

    rls_status = fetch_rls_status(RLS_TABLES)
    missing_rls = [name for name in RLS_TABLES if not rls_status.get(name)]
    checks.append(
        HealthCheck(
            "rls_enabled",
            "pass" if not missing_rls else "fail",
            "RLS enabled on ops tables" if not missing_rls else f"RLS missing/unknown: {', '.join(missing_rls)}",
            (len(RLS_TABLES) - len(missing_rls)) / len(RLS_TABLES),
        )
    )

    return checks
