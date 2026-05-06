from collections.abc import Iterable
from contextlib import contextmanager
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from sonara_ops.config import get_settings


def get_engine() -> Engine | None:
    settings = get_settings()
    if not settings.supabase_db_url:
        return None
    return create_engine(settings.supabase_db_url, pool_pre_ping=True)


@contextmanager
def connect():
    engine = get_engine()
    if engine is None:
        yield None
        return
    with engine.connect() as connection:
        yield connection


def test_connection() -> tuple[bool, str]:
    try:
        with connect() as connection:
            if connection is None:
                return False, "SUPABASE_DB_URL is not configured"
            value = connection.execute(text("select 1")).scalar_one()
            return value == 1, "connected"
    except Exception as exc:
        return False, exc.__class__.__name__


def fetch_existing_tables(table_names: Iterable[str]) -> set[str]:
    names = list(table_names)
    if not names:
        return set()

    with connect() as connection:
        if connection is None:
            return set()
        result = connection.execute(
            text(
                """
                select table_name
                from information_schema.tables
                where table_schema = 'public'
                  and table_name = any(:table_names)
                """
            ),
            {"table_names": names},
        )
        return {str(row[0]) for row in result}


def fetch_rls_status(table_names: Iterable[str]) -> dict[str, bool]:
    names = list(table_names)
    if not names:
        return {}

    with connect() as connection:
        if connection is None:
            return {}
        result = connection.execute(
            text(
                """
                select relname, relrowsecurity
                from pg_class
                join pg_namespace on pg_namespace.oid = pg_class.relnamespace
                where pg_namespace.nspname = 'public'
                  and relname = any(:table_names)
                """
            ),
            {"table_names": names},
        )
        return {str(row[0]): bool(row[1]) for row in result}


def fetch_platform_jobs(limit: int = 20) -> list[dict[str, Any]]:
    with connect() as connection:
        if connection is None:
            return []
        result = connection.execute(
            text(
                """
                select id, job_type, status, priority, created_at, updated_at
                from public.platform_jobs
                order by created_at desc
                limit :limit
                """
            ),
            {"limit": limit},
        )
        return [dict(row._mapping) for row in result]
