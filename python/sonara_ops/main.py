import json

import typer
from rich.console import Console
from rich.table import Table

from sonara_ops.db import fetch_platform_jobs
from sonara_ops.healthcheck import run_health_checks
from sonara_ops.migrations import schema_report
from sonara_ops.stripe_audit import stripe_audit_summary

app = typer.Typer(help="SONARA OS local and CI operations tooling.")
console = Console()


@app.command()
def health() -> None:
    """Run database and migration health checks without printing secrets."""
    table = Table(title="SONARA OS Database Health")
    table.add_column("Check")
    table.add_column("Status")
    table.add_column("Message")
    table.add_column("Score")

    for check in run_health_checks():
        table.add_row(check.name, check.status, check.message, "" if check.score is None else f"{check.score:.2f}")

    console.print(table)


@app.command("schema-report")
def schema_report_command() -> None:
    """Print a local migration/schema report."""
    console.print_json(json.dumps(schema_report(), default=str))


@app.command("stripe-audit")
def stripe_audit_command() -> None:
    """Print Stripe wiring checks without printing secret values."""
    console.print_json(json.dumps(stripe_audit_summary()))


@app.command("jobs-list")
def jobs_list(limit: int = 20) -> None:
    """List recent platform jobs when database credentials are configured."""
    jobs = fetch_platform_jobs(limit=limit)
    if not jobs:
        console.print("[yellow]No jobs found or SUPABASE_DB_URL is not configured.[/yellow]")
        return

    table = Table(title="Recent Platform Jobs")
    for column in ["id", "job_type", "status", "priority", "created_at", "updated_at"]:
        table.add_column(column)

    for job in jobs:
        table.add_row(*(str(job.get(column, "")) for column in ["id", "job_type", "status", "priority", "created_at", "updated_at"]))

    console.print(table)


if __name__ == "__main__":
    app()
