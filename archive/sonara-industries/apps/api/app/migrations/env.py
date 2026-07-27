from alembic import context
from app.db.base import Base
from app.db import models  # noqa: F401
from app.db.session import engine

target_metadata = Base.metadata

def run_migrations_online():
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()

run_migrations_online()

