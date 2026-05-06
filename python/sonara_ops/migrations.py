from pathlib import Path


def migration_dir() -> Path:
    return Path(__file__).resolve().parents[2] / "supabase" / "migrations"


def list_migrations() -> list[Path]:
    path = migration_dir()
    if not path.exists():
        return []
    return sorted(path.glob("*.sql"))


def schema_report() -> dict[str, object]:
    migrations = list_migrations()
    return {
        "migration_dir": str(migration_dir()),
        "migration_count": len(migrations),
        "migrations": [migration.name for migration in migrations],
        "has_platform_ops_migration": any("platform_infrastructure_ops" in migration.name for migration in migrations),
    }
